import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmAsyncConfig } from './config/database.config';
import { envValidationSchema } from './config/env.validation';
import { ConversationsInfrastructureModule } from './infrastructure/conversations/conversations-infrastructure.module';
import { BotModule } from './modules/bot/bot.module';
import { GraphModule } from './modules/graph/graph.module';
import { HealthModule } from './modules/health/health.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { ProactiveModule } from './modules/proactive/proactive.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
    ConversationsInfrastructureModule,
    HealthModule,
    GraphModule,
    BotModule,
    ProactiveModule,
    MessagingModule,
  ],
})
export class AppModule {}
