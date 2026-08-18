import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Activity,
  ActivityTypes,
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication,
  ConversationParameters,
  ConversationReference,
  Request,
  Response,
  TurnContext,
} from 'botbuilder';
import { ENV } from '../../common/constants/config-globals';
import { firstNonEmpty } from '../../common/utils/env.utils';
import { ConversationReferenceEntity } from '../../domain/conversations/entities/conversation-reference.entity';
import type { ResolvedAttachment } from '../attachments/attachment.service';

/** Parameters required to create a new one-on-one conversation. */
export interface CreateConversationParams {
  aadObjectId: string;
  tenantId: string;
  serviceUrl: string;
}

/**
 * Wraps the CloudAdapter (Bot Framework) and exposes the operations needed to
 * process incoming activities and send proactive messages.
 */
@Injectable()
export class TeamsBotAdapter {
  private readonly logger = new Logger(TeamsBotAdapter.name);
  private readonly appId: string;
  private readonly appName: string;
  private readonly oauthScope: string;

  readonly adapter: CloudAdapter;

  constructor(configService: ConfigService) {
    this.appId = configService.getOrThrow<string>(ENV.MICROSOFT_APP_ID);
    const appPassword = configService.getOrThrow<string>(ENV.MICROSOFT_APP_PASSWORD);
    const tenantId = firstNonEmpty(
      configService.get<string>(ENV.MICROSOFT_APP_TENANT_ID),
      configService.get<string>(ENV.GRAPH_TENANT_ID),
    );
    this.appName =
      firstNonEmpty(configService.get<string>(ENV.MICROSOFT_APP_NAME)) ?? 'Oberon360 Bot';
    this.oauthScope =
      firstNonEmpty(configService.get<string>(ENV.BOT_FRAMEWORK_OAUTH_SCOPE)) ??
      'https://api.botframework.com';

    const botFrameworkAuthentication = new ConfigurationBotFrameworkAuthentication({
      MicrosoftAppId: this.appId,
      MicrosoftAppPassword: appPassword,
      // Omit the tenant key when unknown so the library applies its own default
      // instead of interpolating "undefined" into the authority URL.
      ...(tenantId ? { MicrosoftAppTenantId: tenantId } : {}),
      // Both values must be set together: the auth factory switches to the
      // parameterized path when any of them is present, and a missing login
      // URL makes MSAL fail with "empty_url_error" when acquiring the bot token.
      ToChannelFromBotLoginUrl: 'https://login.microsoftonline.com',
      ToChannelFromBotOAuthScope: this.oauthScope,
    });

    this.adapter = new CloudAdapter(botFrameworkAuthentication);
    this.adapter.onTurnError = (context, error) => this.handleTurnError(context, error);
  }

  /** Bot id in the Bot Framework format "28:<app-id>". */
  get botId(): string {
    return `28:${this.appId}`;
  }

  /** Processes an incoming HTTP activity from the Bot Framework channel. */
  process(
    req: Request,
    res: Response,
    logic: (context: TurnContext) => Promise<void>,
  ): Promise<void> {
    return this.adapter.process(req, res, logic);
  }

  /**
   * Creates a one-on-one conversation with a user.
   * The conversation id is captured from the turn created by the adapter.
   */
  async createConversation(params: CreateConversationParams): Promise<{ id: string }> {
    const conversationParameters: ConversationParameters = {
      isGroup: false,
      bot: { id: this.botId, name: this.appName },
      members: [{ id: params.aadObjectId, name: '' }],
      channelData: { tenant: { id: params.tenantId } },
    };

    let conversationId = '';
    await this.adapter.createConversationAsync(
      this.appId,
      'msteams',
      params.serviceUrl,
      this.oauthScope,
      conversationParameters,
      async (context) => {
        conversationId = context.activity.conversation?.id ?? '';
      },
    );

    if (!conversationId) {
      throw new Error('Conversation creation returned no conversation id.');
    }

    return { id: conversationId };
  }

  /** Sends a proactive message to a stored conversation reference. */
  async sendProactiveMessage(
    reference: ConversationReferenceEntity,
    text: string,
    attachments: ResolvedAttachment[] = [],
  ): Promise<string | null> {
    let activityId: string | null = null;

    const activity: Partial<Activity> = {
      type: ActivityTypes.Message,
      text,
      attachments: attachments.map((attachment) => ({
        contentType: attachment.contentType,
        contentUrl: attachment.url,
        name: attachment.name,
      })),
    };

    const conversationReference: Partial<ConversationReference> = {
      activityId: reference.activityId ?? undefined,
      user: { id: reference.aadObjectId, name: '' },
      bot: { id: reference.botId, name: '' },
      conversation: {
        id: reference.conversationId,
        name: '',
        isGroup: false,
        conversationType: 'personal',
      },
      channelId: reference.channelId,
      serviceUrl: reference.serviceUrl,
    };

    await this.adapter.continueConversationAsync(
      this.appId,
      conversationReference,
      this.oauthScope,
      async (context) => {
        const response = await context.sendActivity(activity);
        activityId = response?.id ?? null;
      },
    );

    return activityId;
  }

  private async handleTurnError(context: TurnContext, error: Error): Promise<void> {
    this.logger.error(`Turn error: ${error.message}`, error.stack);
    try {
      await context.sendActivity(
        'Lo siento, ocurrió un error inesperado. Inténtalo de nuevo más tarde.',
      );
    } catch (sendError) {
      this.logger.error('Failed to notify the user about the turn error.', sendError.stack);
    }
  }
}
