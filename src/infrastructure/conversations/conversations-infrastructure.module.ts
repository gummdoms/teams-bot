import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationReferenceEntity } from '../../domain/conversations/entities/conversation-reference.entity';
import { CONVERSATION_REPOSITORY } from '../../domain/conversations/repositories/conversation-repository.port';
import { TypeOrmConversationRepository } from './conversation-reference.repository';

@Module({
  imports: [TypeOrmModule.forFeature([ConversationReferenceEntity])],
  providers: [{ provide: CONVERSATION_REPOSITORY, useClass: TypeOrmConversationRepository }],
  exports: [CONVERSATION_REPOSITORY],
})
export class ConversationsInfrastructureModule {}
