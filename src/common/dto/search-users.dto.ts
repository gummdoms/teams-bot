import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/** Query parameters to search users in Microsoft Entra ID. */
export class SearchUsersDto {
  @ApiProperty({
    description:
      'Texto a buscar: coincide con el inicio del correo, el UPN o el nombre para mostrar.',
    example: 'juan',
  })
  @IsString({ message: 'El parámetro "q" debe ser un texto.' })
  @IsNotEmpty({ message: 'El parámetro "q" no puede estar vacío.' })
  @MinLength(2, { message: 'El parámetro "q" debe tener al menos 2 caracteres.' })
  @MaxLength(256, { message: 'El parámetro "q" supera la longitud máxima.' })
  q: string;
}
