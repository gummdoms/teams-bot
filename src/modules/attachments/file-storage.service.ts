import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { ENV } from '../../common/constants/config-globals';
import { firstNonEmpty } from '../../common/utils/env.utils';

interface StoredFileMetadata {
  name: string;
  contentType: string;
  size: number;
  createdAt: string;
}

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Persists downloaded attachments on local disk with a TTL and exposes them
 * through the bot's public endpoint. Files are unguessable UUIDs, so a public
 * GET route is safe while the short TTL limits exposure.
 */
@Injectable()
export class FileStorageService implements OnModuleInit {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly storageDir: string;
  private readonly ttlMs: number;

  constructor(configService: ConfigService) {
    this.storageDir = resolve(
      firstNonEmpty(configService.get<string>(ENV.FILE_STORAGE_DIR)) ?? './uploads',
    );
    const ttlHours = Number(configService.get<string>(ENV.ATTACHMENT_TTL_HOURS) ?? 24);
    this.ttlMs = ttlHours * 3_600_000;
    mkdirSync(this.storageDir, { recursive: true });
  }

  onModuleInit(): void {
    const timer = setInterval(() => this.cleanupExpired(), CLEANUP_INTERVAL_MS);
    timer.unref();
  }

  /** Stores the file and returns its id (the public URL suffix). */
  save(buffer: Buffer, name: string, contentType: string): string {
    const id = randomUUID();
    writeFileSync(join(this.storageDir, id), buffer);
    const metadata: StoredFileMetadata = {
      name,
      contentType,
      size: buffer.length,
      createdAt: new Date().toISOString(),
    };
    writeFileSync(join(this.storageDir, `${id}.json`), JSON.stringify(metadata));
    return id;
  }

  /** Reads a stored file and its metadata, or null when missing/expired. */
  get(id: string): { path: string; name: string; contentType: string } | null {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
      return null;
    }
    const filePath = join(this.storageDir, id);
    const metadataPath = join(this.storageDir, `${id}.json`);
    if (!existsSync(filePath) || !existsSync(metadataPath)) return null;

    let metadata: StoredFileMetadata;
    try {
      metadata = JSON.parse(readFileSync(metadataPath, 'utf8')) as StoredFileMetadata;
    } catch {
      return null;
    }

    return { path: filePath, name: metadata.name, contentType: metadata.contentType };
  }

  /** Removes files older than the TTL and returns the number removed. */
  cleanupExpired(): number {
    let removed = 0;
    const now = Date.now();
    for (const entry of readdirSync(this.storageDir)) {
      if (entry.endsWith('.json')) continue;
      const filePath = join(this.storageDir, entry);
      try {
        if (now - statSync(filePath).mtimeMs > this.ttlMs) {
          rmSync(filePath);
          rmSync(`${filePath}.json`, { force: true });
          removed += 1;
        }
      } catch (error) {
        this.logger.warn(`Failed to clean up attachment ${entry}: ${this.errorMessage(error)}`);
      }
    }
    if (removed > 0) {
      this.logger.debug(`Removed ${removed} expired attachment(s).`);
    }
    return removed;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
