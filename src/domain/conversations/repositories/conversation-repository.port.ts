import type { ConversationReferenceEntity } from '../entities/conversation-reference.entity';

/** Data required to persist a conversation reference. */
export interface ConversationReferenceData {
  aadObjectId: string;
  email: string | null;
  tenantId: string;
  conversationId: string;
  serviceUrl: string;
  channelId: string;
  botId: string;
  activityId: string | null;
  optOut: boolean;
}

/** Port that isolates the persistence layer of conversation references. */
export interface ConversationRepositoryPort {
  upsert(data: ConversationReferenceData): Promise<ConversationReferenceEntity>;
  findByAadObjectId(aadObjectId: string): Promise<ConversationReferenceEntity | null>;
  findByEmail(email: string): Promise<ConversationReferenceEntity | null>;
  findByConversationId(conversationId: string): Promise<ConversationReferenceEntity | null>;
  removeByConversationId(conversationId: string): Promise<boolean>;
  list(): Promise<ConversationReferenceEntity[]>;
  setOptOut(aadObjectId: string, optOut: boolean): Promise<boolean>;
}

/** Dependency injection token for the conversation repository port. */
export const CONVERSATION_REPOSITORY = Symbol('CONVERSATION_REPOSITORY');
