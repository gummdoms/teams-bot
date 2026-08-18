import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** A file attachment delivered with the proactive message. */
export class AttachmentUrlDto {
  @ApiProperty({
    description:
      'URL del archivo (http/https). El bot lo descarga, lo valida y lo sirve desde su propio endpoint público.',
    example: 'https://ejemplo.com/aviso.pdf',
  })
  @IsUrl({ require_tld: false }, { message: 'La URL del adjunto no es válida.' })
  @MaxLength(2048, { message: 'La URL del adjunto supera la longitud máxima.' })
  url: string;

  @ApiPropertyOptional({
    description: 'Nombre del archivo (por defecto se toma de la URL).',
    example: 'aviso.pdf',
  })
  @IsOptional()
  @IsString({ message: 'El campo "name" del adjunto debe ser un texto.' })
  @MaxLength(255, { message: 'El nombre del adjunto supera la longitud máxima.' })
  name?: string;

  @ApiPropertyOptional({
    description: 'Tipo MIME del archivo (por defecto se detecta del servidor remoto).',
    example: 'application/pdf',
  })
  @IsOptional()
  @IsString({ message: 'El campo "contentType" del adjunto debe ser un texto.' })
  @MaxLength(100, { message: 'El contentType del adjunto supera la longitud máxima.' })
  contentType?: string;
}

/** Payload to send a proactive message to one or more users by email. */
export class ProactiveMessageDto {
  @ApiProperty({
    description: 'Lista de correos de los destinatarios.',
    example: ['usuario@empresa.com', 'otro@empresa.com'],
  })
  @IsArray({ message: 'El campo "emails" debe ser una lista de correos.' })
  @ArrayNotEmpty({ message: 'Debe especificar al menos un correo en "emails".' })
  @IsEmail({}, { each: true, message: 'Uno de los correos en "emails" no es válido.' })
  @MaxLength(320, {
    each: true,
    message: 'Uno de los correos en "emails" supera la longitud máxima.',
  })
  emails: string[];

  @ApiProperty({
    description: 'Texto del mensaje a enviar (soporta formato Markdown de Teams).',
    example: 'Hola, este es un aviso importante de Oberon 360.',
  })
  @IsString({ message: 'El campo "text" debe ser un texto.' })
  @IsNotEmpty({ message: 'El campo "text" no puede estar vacío.' })
  @MaxLength(4000, { message: 'El campo "text" supera los 4000 caracteres permitidos.' })
  text: string;

  @ApiPropertyOptional({
    type: [AttachmentUrlDto],
    description:
      'Archivos adjuntos (imágenes, documentos, etc.). El bot descarga cada URL, valida tamaño y tipo, y la adjunta al mensaje.',
  })
  @IsOptional()
  @IsArray({ message: 'El campo "attachments" debe ser una lista de adjuntos.' })
  @ValidateNested({ each: true })
  @Type(() => AttachmentUrlDto)
  attachments?: AttachmentUrlDto[];

  @ApiPropertyOptional({
    description:
      'Si es true, cuando el bot no esté instalado para un usuario se intenta instalarlo de forma proactiva vía Microsoft Graph antes de reintentar el envío.',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'El campo "installIfMissing" debe ser un booleano.' })
  installIfMissing?: boolean;
}
