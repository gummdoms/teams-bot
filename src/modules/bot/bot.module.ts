import { Module } from '@nestjs/common';
import { ConversationsInfrastructureModule } from '../../infrastructure/conversations/conversations-infrastructure.module';
import { GraphModule } from '../graph/graph.module';
import { BotActivitiesService } from './bot.activities.service';
import { TeamsBotAdapter } from './bot.adapter';
import { BotController } from './bot.controller';

@Module({
  imports: [ConversationsInfrastructureModule, GraphModule],
  controllers: [BotController],
  providers: [TeamsBotAdapter, BotActivitiesService],
  exports: [TeamsBotAdapter],
})
export class BotModule {}
