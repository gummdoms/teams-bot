import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { APP_NAME, APP_VERSION } from '../constants/config-globals';

/** Configures the Swagger UI documentation at "{prefix}/docs". */
export function setupSwagger(app: INestApplication, prefix: string): void {
  const config = new DocumentBuilder()
    .setTitle(APP_NAME)
    .setDescription(
      'Bot de Microsoft Teams para el envío de mensajes proactivos. ' +
        'Permite buscar usuarios en Microsoft Entra ID y enviar notificaciones a uno o varios correos.',
    )
    .setVersion(APP_VERSION)
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'x-api-key')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${prefix}/docs`, app, document);
}
