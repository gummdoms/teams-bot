import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { FileStorageService } from './file-storage.service';

/**
 * Serves stored attachments so Teams can load them.
 * Intentionally public (no API key): Teams fetches content URLs server-side.
 * Security relies on unguessable UUID ids plus a short TTL.
 */
@ApiTags('Adjuntos')
@Controller('files')
export class AttachmentsController {
  constructor(private readonly fileStorage: FileStorageService) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Sirve un archivo adjunto almacenado',
    description:
      'Endpoint público usado por Teams para cargar los adjuntos de los mensajes. Las URLs contienen ids aleatorios y expiran por TTL.',
  })
  getFile(@Param('id') id: string, @Res() res: Response): void {
    const file = this.fileStorage.get(id);
    if (!file) {
      throw new NotFoundException('El archivo no existe o ya expiró.');
    }

    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    );
    res.sendFile(file.path);
  }
}
