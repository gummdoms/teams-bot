import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivityTypes, TurnContext } from 'botbuilder';
import { ENV, TEAMS_CHANNEL_ID } from '../../common/constants/config-globals';
import { messages } from '../../common/constants/messages';
import { firstNonEmpty } from '../../common/utils/env.utils';
import { CONVERSATION_REPOSITORY } from '../../domain/conversations/repositories/conversation-repository.port';
import type { ConversationRepositoryPort } from '../../domain/conversations/repositories/conversation-repository.port';
import { GraphService } from '../graph/graph.service';
import { TeamsBotAdapter } from './bot.adapter';

/**
 * Handles the bot activities: install/uninstall events and message commands.
 * Conversation references are persisted so proactive messages can be sent later.
 */
@Injectable()
export class BotActivitiesService {
  private readonly logger = new Logger(BotActivitiesService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly adapter: TeamsBotAdapter,
    private readonly graphService: GraphService,
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: ConversationRepositoryPort,
  ) {}

  /** Entry point invoked for every activity received by the bot. */
  async onTurn(context: TurnContext): Promise<void> {
    const activity = context.activity;
    if (!activity) return;

    switch (activity.type) {
      case ActivityTypes.Message:
        return this.onMessage(context);
      case ActivityTypes.ConversationUpdate:
        return this.onConversationUpdate(context);
      case ActivityTypes.InstallationUpdate:
        return this.onInstallationUpdate(context);
      default:
        return;
    }
  }

  private async onConversationUpdate(context: TurnContext): Promise<void> {
    const activity = context.activity;
    const botId = activity.recipient?.id;

    if (botId && activity.membersAdded?.some((member) => member.id === botId)) {
      return this.onInstalled(context);
    }
    if (botId && activity.membersRemoved?.some((member) => member.id === botId)) {
      return this.onUninstalled(context);
    }
  }

  private async onInstallationUpdate(context: TurnContext): Promise<void> {
    const action = context.activity.action;
    if (action === 'add') return this.onInstalled(context);
    if (action === 'remove') return this.onUninstalled(context);
  }

  /** Persists the conversation reference and greets the user on install. */
  private async onInstalled(context: TurnContext): Promise<void> {
    const activity = context.activity;
    const reference = TurnContext.getConversationReference(activity);
    const aadObjectId = activity.from?.aadObjectId;
    const tenantId = activity.channelData?.tenant?.id;
    const conversationId = reference.conversation?.id;

    if (!aadObjectId || !tenantId || !conversationId) {
      this.logger.warn('Install event missing required data; conversation reference not stored.');
      return;
    }

    let email: string | null = null;
    try {
      const user = await this.graphService.getUserById(aadObjectId);
      email = user?.mail ?? null;
    } catch (error) {
      this.logger.debug(
        `Could not resolve the email for user ${aadObjectId}: ${this.errorMessage(error)}`,
      );
    }

    const isPersonalChat =
      !activity.channelData?.team &&
      (activity.conversation?.conversationType === 'personal' ||
        !activity.conversation?.conversationType);

    if (isPersonalChat) {
      await this.conversationRepository.upsert({
        aadObjectId,
        email,
        tenantId,
        conversationId,
        serviceUrl: reference.serviceUrl ?? this.defaultServiceUrl,
        channelId: reference.channelId ?? TEAMS_CHANNEL_ID,
        botId: reference.bot?.id ?? this.adapter.botId,
        activityId: reference.activityId ?? null,
        optOut: false,
      });
      await context.sendActivity(messages.bot.welcome(activity.from?.name));
    } else {
      const teamName = activity.channelData?.team?.name;
      await context.sendActivity(
        `¡Hola! 👋 Soy el bot de notificaciones de **Oberon 360**. Gracias por agregarme a ${teamName ? `**${teamName}**` : 'este canal'}.`,
      );
    }
  }

  /** Removes the stored conversation reference when the bot is uninstalled. */
  private async onUninstalled(context: TurnContext): Promise<void> {
    const conversationId = context.activity.conversation?.id;
    if (!conversationId) return;

    const removed = await this.conversationRepository.removeByConversationId(conversationId);
    if (removed) {
      this.logger.debug(`Removed conversation reference ${conversationId}`);
    }
  }

  /** Responds to simple chat commands (help, opt-out, opt-in, greeting). */
  private async onMessage(context: TurnContext): Promise<void> {
    const text = (context.activity.text ?? '').trim().toLowerCase();
    const aadObjectId = context.activity.from?.aadObjectId;

    switch (text) {
      case 'optout':
      case '/optout':
      case 'no recibir':
      case 'darme de baja':
        if (aadObjectId) {
          await this.conversationRepository.setOptOut(aadObjectId, true);
        }
        await context.sendActivity(messages.bot.optOutConfirmed);
        return;
      case 'optin':
      case '/optin':
      case 'recibir':
      case 'reactivar':
        if (aadObjectId) {
          await this.conversationRepository.setOptOut(aadObjectId, false);
        }
        await context.sendActivity(messages.bot.optInConfirmed);
        return;
      case 'hola':
      case 'hola bot':
      case 'saludos':
      case 'buenas':
        await context.sendActivity(messages.bot.greeting);
        return;
      case 'ayuda':
      case 'help':
      case '/ayuda':
      case 'menu':
      default:
        await context.sendActivity(messages.bot.help);
        return;
    }
  }

  private get defaultServiceUrl(): string {
    return (
      firstNonEmpty(this.configService.get<string>(ENV.TEAMS_SERVICE_URL)) ??
      'https://smba.trafficmanager.net/teams/'
    );
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
