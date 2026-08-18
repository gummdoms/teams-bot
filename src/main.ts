import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { setupSwagger } from './common/utils/setup-swagger';
import { ENV } from './common/constants/config-globals';

const CORS_METHODS = 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS';
const CORS_HEADERS = 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-api-key';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Main');
  const configService = app.get(ConfigService);

  // Helmet CSP is relaxed so the Swagger UI can render its inline styles/scripts.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'script-src': ["'self'", "'unsafe-inline'"],
          'style-src': ["'self'", "'unsafe-inline'"],
        },
      },
    }),
  );
  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ limit: '5mb', extended: true }));

  app.setGlobalPrefix('api');

  setupSwagger(app, 'api');

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: true,
    methods: CORS_METHODS,
    allowedHeaders: CORS_HEADERS,
    credentials: true,
    optionsSuccessStatus: 204,
  });

  const port = configService.get<number>(ENV.PORT) ?? 3000;
  await app.listen(port);

  logger.log(`Server is running on port ${port}`);
  logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
  logger.log(`Bot endpoint: http://localhost:${port}/api/messages`);
}
void bootstrap();
