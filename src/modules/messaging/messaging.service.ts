import { Inject, Injectable } from '@nestjs/common';
import type {
  ConversationListItem,
  UserSearchResult,
} from '../../common/types/user-search-result.type';
import type { SendProactiveResponse } from '../../common/types/delivery-result.type';
import { ProactiveMessageDto } from '../../common/dto/proactive-message.dto';
import { CONVERSATION_REPOSITORY } from '../../domain/conversations/repositories/conversation-repository.port';
import type { ConversationRepositoryPort } from '../../domain/conversations/repositories/conversation-repository.port';
import { GraphService } from '../graph/graph.service';
import { ProactiveService } from '../proactive/proactive.service';

/** Orchestrates the REST API: user search and proactive message delivery. */
@Injectable()
export class MessagingService {
  constructor(
    private readonly proactiveService: ProactiveService,
    private readonly graphService: GraphService,
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: ConversationRepositoryPort,
  ) {}

  /** Searches Entra users and indicates whether the bot can message each one. */
  async searchUsers(query: string): Promise<UserSearchResult[]> {
    const [users, storedReferences] = await Promise.all([
      this.graphService.searchUsers(query),
      this.conversationRepository.list(),
    ]);

    const storedByAadObjectId = new Map(
      storedReferences.map((reference) => [reference.aadObjectId, reference]),
    );

    const results = await Promise.all(
      users.map(async (user) => {
        const hasConversation = storedByAadObjectId.has(user.id);
        const botInstalled = hasConversation
          ? true
          : await this.graphService.isAppInstalledForUser(user.id);

        return {
          id: user.id,
          displayName: user.displayName,
          mail: user.mail,
          userPrincipalName: user.userPrincipalName,
          jobTitle: user.jobTitle ?? null,
          hasConversation,
          botInstalled,
          canReceiveProactiveMessages: hasConversation || botInstalled === true,
        } satisfies UserSearchResult;
      }),
    );

    return results;
  }

  /** Sends a proactive message to the given recipients. */
  sendProactiveMessage(dto: ProactiveMessageDto): Promise<SendProactiveResponse> {
    return this.proactiveService.sendToEmails(dto);
  }

  /** Lists the stored conversation references (administration). */
  async listConversations(): Promise<ConversationListItem[]> {
    const references = await this.conversationRepository.list();
    return references.map((reference) => ({
      aadObjectId: reference.aadObjectId,
      email: reference.email,
      tenantId: reference.tenantId,
      conversationId: reference.conversationId,
      channelId: reference.channelId,
      optOut: reference.optOut,
      createdAt: reference.createdAt,
      updatedAt: reference.updatedAt,
    }));
  }
}
