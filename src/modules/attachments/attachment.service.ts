import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENV } from '../../common/constants/config-globals';
import { AttachmentUrlDto } from '../../common/dto/proactive-message.dto';
import { firstNonEmpty } from '../../common/utils/env.utils';
import { FileStorageService } from './file-storage.service';

/** An attachment ready to be sent: the bot re-serves the file from its own URL. */
export interface ResolvedAttachment {
  url: string;
  name: string;
  contentType: string;
  size: number;
}

const DEFAULT_MAX_SIZE_MB = 20;
const DOWNLOAD_TIMEOUT_MS = 30_000;

/**
 * Downloads attachment files from user-provided URLs, validates them and
 * stores them so the bot can serve them from its own public endpoint
 * (Teams loads attachment URLs server-side, so they must be publicly reachable).
 */
@Injectable()
export class AttachmentService {
  private readonly logger = new Logger(AttachmentService.name);
  private readonly maxSizeBytes: number;
  private readonly allowedHosts: string[] | null;

  constructor(
    private readonly configService: ConfigService,
    private readonly fileStorage: FileStorageService,
  ) {
    const maxSizeMb = Number(
      configService.get<string>(ENV.ATTACHMENT_MAX_SIZE_MB) ?? DEFAULT_MAX_SIZE_MB,
    );
    this.maxSizeBytes = maxSizeMb * 1024 * 1024;

    const allowed = firstNonEmpty(configService.get<string>(ENV.ATTACHMENT_ALLOWED_HOSTS));
    this.allowedHosts = allowed
      ? allowed
          .split(',')
          .map((host) => host.trim())
          .filter(Boolean)
      : null;
  }

  /** Resolves every attachment; throws with a clear message on the first failure. */
  async resolveAll(attachments: AttachmentUrlDto[]): Promise<ResolvedAttachment[]> {
    if (attachments.length === 0) return [];
    return Promise.all(attachments.map((attachment) => this.resolve(attachment)));
  }

  async resolve(attachment: AttachmentUrlDto): Promise<ResolvedAttachment> {
    const url = this.validateUrl(attachment.url);

    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new BadRequestException(
        `No se pudo descargar el adjunto (HTTP ${response.status}): ${attachment.url}`,
      );
    }

    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > this.maxSizeBytes) {
      throw new BadRequestException(
        `El adjunto supera el tamaño máximo de ${this.maxSizeBytes / (1024 * 1024)} MB.`,
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > this.maxSizeBytes) {
      throw new BadRequestException(
        `El adjunto supera el tamaño máximo de ${this.maxSizeBytes / (1024 * 1024)} MB.`,
      );
    }
    if (buffer.length === 0) {
      throw new BadRequestException(`El adjunto está vacío: ${attachment.url}`);
    }

    const contentType =
      firstNonEmpty(attachment.contentType) ??
      response.headers.get('content-type')?.split(';')[0] ??
      'application/octet-stream';
    const name = sanitizeFileName(firstNonEmpty(attachment.name) ?? nameFromUrl(url) ?? 'archivo');

    const id = this.fileStorage.save(buffer, name, contentType);
    this.logger.debug(`Attachment stored (${buffer.length} bytes): ${name}`);

    return {
      url: `${this.publicBaseUrl}/api/files/${id}`,
      name,
      contentType,
      size: buffer.length,
    };
  }

  private validateUrl(rawUrl: string): URL {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new BadRequestException(`La URL del adjunto no es válida: ${rawUrl}`);
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new BadRequestException(`Solo se permiten URLs http/https para adjuntos: ${rawUrl}`);
    }

    if (this.allowedHosts && !this.allowedHosts.includes(url.host)) {
      throw new BadRequestException(`El host ${url.host} no está permitido para adjuntos.`);
    }

    return url;
  }

  private get publicBaseUrl(): string {
    const baseUrl = firstNonEmpty(this.configService.get<string>(ENV.PUBLIC_BASE_URL));
    if (!baseUrl) {
      throw new BadRequestException(
        'La variable PUBLIC_BASE_URL no está configurada; es necesaria para enviar adjuntos.',
      );
    }
    return baseUrl.replace(/\/+$/, '');
  }
}

/** Derives a file name from the last URL path segment, or null. */
function nameFromUrl(url: URL): string | null {
  const segment = url.pathname.split('/').filter(Boolean).pop();
  if (!segment) return null;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Removes path separators and control characters from a file name. */
function sanitizeFileName(name: string): string {
  const sanitized = name
    .split('')
    .filter((char) => char > '\u001f' && !/[\\/<>:"|?*]/.test(char))
    .join('')
    .trim();
  return sanitized.length > 200 ? sanitized.slice(0, 200) : sanitized || 'archivo';
}
