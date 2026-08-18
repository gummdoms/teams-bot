import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AttachmentService } from './attachment.service';
import { FileStorageService } from './file-storage.service';

describe('AttachmentService', () => {
  let storageDir: string;
  let service: AttachmentService;

  const configValues: Record<string, string | undefined> = {
    PUBLIC_BASE_URL: 'https://bot.example.com',
    FILE_STORAGE_DIR: '',
    ATTACHMENT_MAX_SIZE_MB: '1',
    ATTACHMENT_ALLOWED_HOSTS: '',
  };

  beforeEach(() => {
    storageDir = mkdtempSync(join(tmpdir(), 'teambot-attach-'));
    configValues.FILE_STORAGE_DIR = storageDir;

    const configService = {
      get: jest.fn((key: string) => configValues[key] ?? undefined),
    } as unknown as ConfigService;

    service = new AttachmentService(configService, new FileStorageService(configService));
  });

  afterEach(() => {
    rmSync(storageDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('downloads a file, stores it and returns a public URL', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: { 'content-type': 'image/png', 'content-length': '4' },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await service.resolve({ url: 'https://ejemplo.com/logo.png' });

    expect(result.contentType).toBe('image/png');
    expect(result.name).toBe('logo.png');
    expect(result.size).toBe(4);
    expect(result.url).toMatch(/^https:\/\/bot\.example\.com\/api\/files\/[0-9a-f-]{36}$/);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'ejemplo.com' }),
      expect.objectContaining({ redirect: 'follow' }),
    );
  });

  it('uses the provided name and contentType when given', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'application/octet-stream' },
      }),
    ) as unknown as typeof fetch;

    const result = await service.resolve({
      url: 'https://ejemplo.com/file.bin',
      name: 'informe.pdf',
      contentType: 'application/pdf',
    });

    expect(result.name).toBe('informe.pdf');
    expect(result.contentType).toBe('application/pdf');
  });

  it('rejects non-http(s) schemes', async () => {
    await expect(service.resolve({ url: 'ftp://ejemplo.com/file' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects invalid URLs', async () => {
    await expect(service.resolve({ url: 'esto-no-es-una-url' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects failed downloads', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response('not found', { status: 404 })) as unknown as typeof fetch;

    await expect(service.resolve({ url: 'https://ejemplo.com/missing.png' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects files larger than the configured limit', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response('x'.repeat(2 * 1024 * 1024), {
        status: 200,
        headers: { 'content-length': String(2 * 1024 * 1024) },
      }),
    ) as unknown as typeof fetch;

    await expect(service.resolve({ url: 'https://ejemplo.com/big.bin' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects hosts outside the allowlist when configured', async () => {
    configValues.ATTACHMENT_ALLOWED_HOSTS = 'permited.example.com';
    const configService = {
      get: jest.fn((key: string) => configValues[key] ?? undefined),
    } as unknown as ConfigService;
    service = new AttachmentService(configService, new FileStorageService(configService));

    await expect(service.resolve({ url: 'https://blocked.example.com/file' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('requires PUBLIC_BASE_URL when sending attachments', async () => {
    configValues.PUBLIC_BASE_URL = '';
    const configService = {
      get: jest.fn((key: string) => configValues[key] ?? undefined),
    } as unknown as ConfigService;
    service = new AttachmentService(configService, new FileStorageService(configService));

    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(new Uint8Array([1]), { status: 200 }),
      ) as unknown as typeof fetch;

    await expect(service.resolve({ url: 'https://ejemplo.com/file' })).rejects.toThrow(
      BadRequestException,
    );
  });
});
