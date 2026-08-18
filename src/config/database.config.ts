import { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleAsyncOptions, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ENV } from '../common/constants/config-globals';

/** PostgreSQL TypeORM configuration derived from environment variables. */
export const typeOrmAsyncConfig: TypeOrmModuleAsyncOptions = {
  inject: [ConfigService],
  useFactory: (configService: ConfigService): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: configService.getOrThrow<string>(ENV.DB_HOST),
    port: configService.getOrThrow<number>(ENV.DB_PORT),
    database: configService.getOrThrow<string>(ENV.DB_NAME),
    username: configService.getOrThrow<string>(ENV.DB_USER),
    password: configService.getOrThrow<string>(ENV.DB_PASSWORD),
    ssl: configService.get<boolean>(ENV.DB_SSL) ? { rejectUnauthorized: false } : false,
    synchronize: configService.get<boolean>(ENV.DB_SYNCHRONIZE) === true,
    logging: configService.get<string>(ENV.NODE_ENV) === 'development',
    autoLoadEntities: true,
  }),
};
