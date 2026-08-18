import { Module } from '@nestjs/common';
import { ConversationsInfrastructureModule } from '../../infrastructure/conversations/conversations-infrastructure.module';
import { BotModule } from '../bot/bot.module';
import { GraphModule } from '../graph/graph.module';
import { ProactiveService } from './proactive.service';

@Module({
  imports: [BotModule, GraphModule, ConversationsInfrastructureModule],
  providers: [ProactiveService],
  exports: [ProactiveService],
})
export class ProactiveModule {}
