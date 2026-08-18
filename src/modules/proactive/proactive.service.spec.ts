import { ConfigService } from '@nestjs/config';
import { ConversationReferenceEntity } from '../../domain/conversations/entities/conversation-reference.entity';
import type { ConversationRepositoryPort } from '../../domain/conversations/repositories/conversation-repository.port';
import type { TeamsBotAdapter } from '../bot/bot.adapter';
import type { GraphService } from '../graph/graph.service';
import { classifyProactiveError } from './proactive-error.classifier';
import { ProactiveService } from './proactive.service';

describe('classifyProactiveError', () => {
  it('classifies 403 ForbiddenOperationException as NOT_INSTALLED', () => {
    const error = {
      statusCode: 403,
      message: 'ForbiddenOperationException',
      response: {
        status: 403,
        bodyAsText: JSON.stringify({ message: 'ForbiddenOperationException', code: 'Forbidden' }),
      },
    };
    expect(classifyProactiveError(error)).toBe('NOT_INSTALLED');
  });

  it('classifies 403 MessageWritesBlocked as BLOCKED', () => {
    const error = {
      statusCode: 403,
      message: JSON.stringify({ subCode: 'MessageWritesBlocked', details: 'Thread is blocked.' }),
    };
    expect(classifyProactiveError(error)).toBe('BLOCKED');
  });

  it('classifies 404 user not found as USER_NOT_FOUND', () => {
    const error = { statusCode: 404, message: 'NotFound' };
    expect(classifyProactiveError(error)).toBe('USER_NOT_FOUND');
  });

  it('classifies generic errors as ERROR', () => {
    expect(classifyProactiveError(new Error('boom'))).toBe('ERROR');
  });
});

describe('ProactiveService', () => {
  const adapter = {
    botId: '28:00000000-0000-0000-0000-000000000000',
    createConversation: jest.fn(),
    sendProactiveMessage: jest.fn(),
  };
  const graphService = {
    getUserByEmail: jest.fn(),
    installAppForUser: jest.fn(),
  };
  const configService = {
    get: jest.fn((key: string) =>
      key === 'TEAMS_SERVICE_URL' ? 'https://smba.trafficmanager.net/teams/' : undefined,
    ),
  };
  const conversationRepository = {
    findByEmail: jest.fn(),
    findByAadObjectId: jest.fn(),
    findByConversationId: jest.fn(),
    upsert: jest.fn(),
    removeByConversationId: jest.fn(),
    list: jest.fn(),
    setOptOut: jest.fn(),
  };

  let service: ProactiveService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProactiveService(
      adapter as unknown as TeamsBotAdapter,
      graphService as unknown as GraphService,
      configService as unknown as ConfigService,
      conversationRepository as unknown as ConversationRepositoryPort,
    );
  });

  const storedReference = {
    id: 'ref-1',
    aadObjectId: 'aad-1',
    email: 'user@corp.com',
    tenantId: 'tenant-1',
    conversationId: 'conv-1',
    serviceUrl: 'https://smba.trafficmanager.net/teams/',
    channelId: 'msteams',
    botId: '28:00000000-0000-0000-0000-000000000000',
    activityId: null,
    optOut: false,
  } as ConversationReferenceEntity;

  it('sends to a stored conversation reference', async () => {
    conversationRepository.findByEmail.mockResolvedValue(storedReference);
    adapter.sendProactiveMessage.mockResolvedValue('activity-1');

    const result = await service.sendToEmails({
      emails: ['user@corp.com'],
      text: 'Hola',
    });

    expect(result.total).toBe(1);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.results[0].status).toBe('SENT');
    expect(result.results[0].activityId).toBe('activity-1');
    expect(adapter.sendProactiveMessage).toHaveBeenCalledWith(storedReference, 'Hola');
    expect(graphService.getUserByEmail).not.toHaveBeenCalled();
  });

  it('deduplicates repeated emails', async () => {
    conversationRepository.findByEmail.mockResolvedValue(storedReference);
    adapter.sendProactiveMessage.mockResolvedValue('activity-1');

    const result = await service.sendToEmails({
      emails: ['User@Corp.com', 'user@corp.com'],
      text: 'Hola',
    });

    expect(result.total).toBe(1);
  });

  it('returns USER_NOT_FOUND when the email does not exist in Entra ID', async () => {
    conversationRepository.findByEmail.mockResolvedValue(null);
    graphService.getUserByEmail.mockResolvedValue(null);

    const result = await service.sendToEmails({
      emails: ['ghost@corp.com'],
      text: 'Hola',
    });

    expect(result.results[0].status).toBe('USER_NOT_FOUND');
    expect(adapter.sendProactiveMessage).not.toHaveBeenCalled();
  });

  it('returns OPTED_OUT when the user opted out and does not send', async () => {
    conversationRepository.findByEmail.mockResolvedValue({
      ...storedReference,
      optOut: true,
    });

    const result = await service.sendToEmails({
      emails: ['user@corp.com'],
      text: 'Hola',
    });

    expect(result.results[0].status).toBe('OPTED_OUT');
    expect(adapter.sendProactiveMessage).not.toHaveBeenCalled();
  });

  it('creates the conversation when no stored reference exists and sends', async () => {
    conversationRepository.findByEmail.mockResolvedValue(null);
    graphService.getUserByEmail.mockResolvedValue({
      id: 'aad-2',
      displayName: 'User Two',
      mail: 'user2@corp.com',
      userPrincipalName: 'user2@corp.com',
    });
    adapter.createConversation.mockResolvedValue({ id: 'conv-2', activityId: 'a-2' });
    conversationRepository.upsert.mockResolvedValue({
      ...storedReference,
      aadObjectId: 'aad-2',
      conversationId: 'conv-2',
    });
    adapter.sendProactiveMessage.mockResolvedValue('activity-2');

    const result = await service.sendToEmails({
      emails: ['user2@corp.com'],
      text: 'Hola',
    });

    expect(adapter.createConversation).toHaveBeenCalledWith({
      aadObjectId: 'aad-2',
      tenantId: 'common',
      serviceUrl: 'https://smba.trafficmanager.net/teams/',
    });
    expect(conversationRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv-2', email: 'user2@corp.com' }),
    );
    expect(result.results[0].status).toBe('SENT');
  });

  it('reports NOT_INSTALLED when the app is not installed for the user', async () => {
    conversationRepository.findByEmail.mockResolvedValue(storedReference);
    adapter.sendProactiveMessage.mockRejectedValue({
      statusCode: 403,
      message: 'ForbiddenOperationException',
    });

    const result = await service.sendToEmails({
      emails: ['user@corp.com'],
      text: 'Hola',
    });

    expect(result.results[0].status).toBe('NOT_INSTALLED');
    expect(conversationRepository.removeByConversationId).toHaveBeenCalledWith('conv-1');
  });

  it('installs the app and retries when installIfMissing is true', async () => {
    conversationRepository.findByEmail.mockResolvedValue(storedReference);
    adapter.sendProactiveMessage
      .mockRejectedValueOnce({ statusCode: 403, message: 'ForbiddenOperationException' })
      .mockResolvedValueOnce('activity-retry');
    graphService.installAppForUser.mockResolvedValue(undefined);

    const result = await service.sendToEmails({
      emails: ['user@corp.com'],
      text: 'Hola',
      installIfMissing: true,
    });

    expect(graphService.installAppForUser).toHaveBeenCalledWith('aad-1');
    expect(result.results[0].status).toBe('SENT');
    expect(adapter.sendProactiveMessage).toHaveBeenCalledTimes(2);
  });

  it('reports BLOCKED when the user blocked or uninstalled the bot', async () => {
    conversationRepository.findByEmail.mockResolvedValue(storedReference);
    adapter.sendProactiveMessage.mockRejectedValue({
      statusCode: 403,
      message: JSON.stringify({ subCode: 'MessageWritesBlocked' }),
    });

    const result = await service.sendToEmails({
      emails: ['user@corp.com'],
      text: 'Hola',
    });

    expect(result.results[0].status).toBe('BLOCKED');
  });

  it('reports ERROR for unexpected delivery failures', async () => {
    conversationRepository.findByEmail.mockResolvedValue(storedReference);
    adapter.sendProactiveMessage.mockRejectedValue(new Error('network down'));

    const result = await service.sendToEmails({
      emails: ['user@corp.com'],
      text: 'Hola',
    });

    expect(result.results[0].status).toBe('ERROR');
  });
});
