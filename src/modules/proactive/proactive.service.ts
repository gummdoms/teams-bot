import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENV, TEAMS_CHANNEL_ID } from '../../common/constants/config-globals';
import { messages } from '../../common/constants/messages';
import { ProactiveMessageDto } from '../../common/dto/proactive-message.dto';
import type {
  RecipientResult,
  SendProactiveResponse,
} from '../../common/types/delivery-result.type';
import { firstNonEmpty } from '../../common/utils/env.utils';
import { ConversationReferenceEntity } from '../../domain/conversations/entities/conversation-reference.entity';
import { CONVERSATION_REPOSITORY } from '../../domain/conversations/repositories/conversation-repository.port';
import type { ConversationRepositoryPort } from '../../domain/conversations/repositories/conversation-repository.port';
import { TeamsBotAdapter } from '../bot/bot.adapter';
import { GraphService } from '../graph/graph.service';
import { classifyProactiveError, ProactiveErrorKind } from './proactive-error.classifier';

interface DeliveryTarget {
  id: string;
  tenantId: string;
}

const DEFAULT_SERVICE_URL = 'https://smba.trafficmanager.net/teams/';

/**
 * Sends proactive messages to users resolved by email.
 *
 * Teams does not support proactive messages addressed by email or UPN, so the
 * email is resolved to the Entra user id via Microsoft Graph, a one-on-one
 * conversation is created (when needed) and the message is delivered through
 * the Bot Framework. Every recipient reports an individual delivery status.
 */
@Injectable()
export class ProactiveService {
  private readonly logger = new Logger(ProactiveService.name);

  constructor(
    private readonly adapter: TeamsBotAdapter,
    private readonly graphService: GraphService,
    private readonly configService: ConfigService,
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: ConversationRepositoryPort,
  ) {}

  /** Sends a proactive message to one or more recipients and aggregates results. */
  async sendToEmails(dto: ProactiveMessageDto): Promise<SendProactiveResponse> {
    const emails = [...new Set(dto.emails.map((email) => email.trim().toLowerCase()))];

    const results: RecipientResult[] = [];
    for (const email of emails) {
      results.push(await this.deliverToEmail(email, dto.text, dto.installIfMissing ?? false));
    }

    const sent = results.filter((result) => result.status === 'SENT').length;
    return { total: results.length, sent, failed: results.length - sent, results };
  }

  private async deliverToEmail(
    email: string,
    text: string,
    installIfMissing: boolean,
  ): Promise<RecipientResult> {
    const stored = await this.conversationRepository.findByEmail(email);

    if (stored?.optOut) {
      return {
        email,
        status: 'OPTED_OUT',
        message: messages.proactive.optedOut,
        aadObjectId: stored.aadObjectId,
      };
    }

    const target: DeliveryTarget | null = stored
      ? { id: stored.aadObjectId, tenantId: stored.tenantId }
      : await this.resolveUser(email);

    if (!target) {
      return { email, status: 'USER_NOT_FOUND', message: messages.proactive.userNotFound };
    }

    try {
      const reference = stored ?? (await this.createAndStoreConversation(target, email));
      const activityId = await this.adapter.sendProactiveMessage(reference, text);
      return {
        email,
        status: 'SENT',
        aadObjectId: target.id,
        conversationId: reference.conversationId,
        activityId: activityId ?? undefined,
      };
    } catch (error) {
      const kind = classifyProactiveError(error);

      if (kind === 'NOT_INSTALLED') {
        await this.forgetStaleReference(stored);
        if (installIfMissing) {
          return this.installAndRetry(email, text, target);
        }
      }

      if (kind === 'USER_NOT_FOUND') {
        await this.forgetStaleReference(stored);
      }

      this.logger.warn(
        `Proactive delivery to ${email} failed (${kind}): ${this.errorMessage(error)}`,
      );
      return { email, status: kind, message: this.messageFor(kind), aadObjectId: target.id };
    }
  }

  /** Resolves the email to an Entra user and its tenant. */
  private async resolveUser(email: string): Promise<DeliveryTarget | null> {
    const user = await this.graphService.getUserByEmail(email);
    if (!user) return null;
    return { id: user.id, tenantId: this.resolveTenantId() };
  }

  private async createAndStoreConversation(
    target: DeliveryTarget,
    email: string,
  ): Promise<ConversationReferenceEntity> {
    const serviceUrl = this.configService.get<string>(ENV.TEAMS_SERVICE_URL) ?? DEFAULT_SERVICE_URL;

    const resource = await this.adapter.createConversation({
      aadObjectId: target.id,
      tenantId: target.tenantId,
      serviceUrl,
    });

    return this.conversationRepository.upsert({
      aadObjectId: target.id,
      email,
      tenantId: target.tenantId,
      conversationId: resource.id,
      serviceUrl,
      channelId: TEAMS_CHANNEL_ID,
      botId: this.adapter.botId,
      activityId: null,
      optOut: false,
    });
  }

  /** Attempts proactive installation via Graph and retries the delivery once. */
  private async installAndRetry(
    email: string,
    text: string,
    target: DeliveryTarget,
  ): Promise<RecipientResult> {
    try {
      await this.graphService.installAppForUser(target.id);
      const reference = await this.createAndStoreConversation(target, email);
      const activityId = await this.adapter.sendProactiveMessage(reference, text);
      return {
        email,
        status: 'SENT',
        aadObjectId: target.id,
        conversationId: reference.conversationId,
        activityId: activityId ?? undefined,
      };
    } catch (error) {
      this.logger.warn(`Proactive installation for ${email} failed: ${this.errorMessage(error)}`);
      return {
        email,
        status: 'NOT_INSTALLED',
        message: messages.proactive.notInstalled,
        aadObjectId: target.id,
      };
    }
  }

  /** Removes stored references that are stale (bot uninstalled / user deleted). */
  private async forgetStaleReference(stored: ConversationReferenceEntity | null): Promise<void> {
    if (!stored) return;
    try {
      await this.conversationRepository.removeByConversationId(stored.conversationId);
    } catch (error) {
      this.logger.warn(
        `Unable to remove stale conversation reference: ${this.errorMessage(error)}`,
      );
    }
  }

  private resolveTenantId(): string {
    return (
      firstNonEmpty(
        this.configService.get<string>(ENV.GRAPH_TENANT_ID),
        this.configService.get<string>(ENV.MICROSOFT_APP_TENANT_ID),
      ) ?? 'common'
    );
  }

  private messageFor(kind: ProactiveErrorKind): string {
    switch (kind) {
      case 'NOT_INSTALLED':
        return messages.proactive.notInstalled;
      case 'BLOCKED':
        return messages.proactive.blocked;
      case 'USER_NOT_FOUND':
        return messages.proactive.userNotFound;
      default:
        return messages.proactive.error;
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
