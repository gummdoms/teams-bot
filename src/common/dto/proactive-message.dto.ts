import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

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
    description:
      'Si es true, cuando el bot no esté instalado para un usuario se intenta instalarlo de forma proactiva vía Microsoft Graph antes de reintentar el envío.',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'El campo "installIfMissing" debe ser un booleano.' })
  installIfMissing?: boolean;
}
