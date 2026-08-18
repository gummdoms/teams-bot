import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConversationReferenceEntity } from '../../domain/conversations/entities/conversation-reference.entity';
import type {
  ConversationReferenceData,
  ConversationRepositoryPort,
} from '../../domain/conversations/repositories/conversation-repository.port';

/** TypeORM implementation of the conversation repository port. */
@Injectable()
export class TypeOrmConversationRepository implements ConversationRepositoryPort {
  constructor(
    @InjectRepository(ConversationReferenceEntity)
    private readonly repository: Repository<ConversationReferenceEntity>,
  ) {}

  async upsert(data: ConversationReferenceData): Promise<ConversationReferenceEntity> {
    const existing = await this.repository.findOneBy({ aadObjectId: data.aadObjectId });

    if (existing) {
      Object.assign(existing, data);
      return this.repository.save(existing);
    }

    return this.repository.save(this.repository.create(data));
  }

  async findByAadObjectId(aadObjectId: string): Promise<ConversationReferenceEntity | null> {
    return this.repository.findOneBy({ aadObjectId });
  }

  async findByEmail(email: string): Promise<ConversationReferenceEntity | null> {
    return this.repository.findOneBy({ email });
  }

  async findByConversationId(conversationId: string): Promise<ConversationReferenceEntity | null> {
    return this.repository.findOneBy({ conversationId });
  }

  async removeByConversationId(conversationId: string): Promise<boolean> {
    const result = await this.repository.delete({ conversationId });
    return (result.affected ?? 0) > 0;
  }

  async list(): Promise<ConversationReferenceEntity[]> {
    return this.repository.find({ order: { createdAt: 'DESC' } });
  }

  async setOptOut(aadObjectId: string, optOut: boolean): Promise<boolean> {
    const result = await this.repository.update({ aadObjectId }, { optOut });
    return (result.affected ?? 0) > 0;
  }
}
