import { Module } from '@nestjs/common';
import { ConversationsInfrastructureModule } from '../../infrastructure/conversations/conversations-infrastructure.module';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { GraphModule } from '../graph/graph.module';
import { ProactiveModule } from '../proactive/proactive.module';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';

@Module({
  imports: [ProactiveModule, GraphModule, ConversationsInfrastructureModule],
  controllers: [MessagingController],
  providers: [MessagingService, ApiKeyGuard],
})
export class MessagingModule {}
