import { Module } from '@nestjs/common';
import { ConversationsInfrastructureModule } from '../../infrastructure/conversations/conversations-infrastructure.module';
import { AttachmentsModule } from '../attachments/attachments.module';
import { BotModule } from '../bot/bot.module';
import { GraphModule } from '../graph/graph.module';
import { ProactiveService } from './proactive.service';

@Module({
  imports: [BotModule, GraphModule, ConversationsInfrastructureModule, AttachmentsModule],
  providers: [ProactiveService],
  exports: [ProactiveService],
})
export class ProactiveModule {}
