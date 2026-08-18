import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { ENV } from '../../common/constants/config-globals';
import { firstNonEmpty } from '../../common/utils/env.utils';

const TOKEN_REFRESH_BUFFER_MS = 60_000;

/**
 * Acquires Microsoft Graph access tokens using the OAuth 2.0 client
 * credentials flow. Tokens are cached in memory until near expiration.
 */
@Injectable()
export class MsalService {
  private readonly logger = new Logger(MsalService.name);
  private readonly client: ConfidentialClientApplication;
  private readonly scopes: string[];
  private accessToken: string | null = null;
  private expiresAt = 0;

  constructor(configService: ConfigService) {
    const tenantId =
      firstNonEmpty(
        configService.get<string>(ENV.GRAPH_TENANT_ID),
        configService.get<string>(ENV.MICROSOFT_APP_TENANT_ID),
      ) ?? 'common';
    const clientId =
      firstNonEmpty(
        configService.get<string>(ENV.GRAPH_CLIENT_ID),
        configService.get<string>(ENV.MICROSOFT_APP_ID),
      ) ?? '';
    const clientSecret =
      firstNonEmpty(
        configService.get<string>(ENV.GRAPH_CLIENT_SECRET),
        configService.get<string>(ENV.MICROSOFT_APP_PASSWORD),
      ) ?? '';
    const authority =
      configService.get<string>(ENV.GRAPH_AUTHORITY) ?? 'https://login.microsoftonline.com';

    this.client = new ConfidentialClientApplication({
      auth: { clientId, clientSecret, authority: `${authority}/${tenantId}` },
    });

    this.scopes = [
      configService.get<string>(ENV.GRAPH_SCOPE) ?? 'https://graph.microsoft.com/.default',
    ];
  }

  /** Returns a valid access token, acquiring or refreshing it when needed. */
  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.expiresAt - TOKEN_REFRESH_BUFFER_MS) {
      return this.accessToken;
    }

    const response = await this.client.acquireTokenByClientCredential({
      scopes: this.scopes,
    });

    if (!response?.accessToken) {
      this.logger.error('Microsoft Graph token acquisition returned no access token.');
      throw new InternalServerErrorException(
        'No se pudo obtener el token de acceso de Microsoft Graph.',
      );
    }

    this.accessToken = response.accessToken;
    this.expiresAt = response.expiresOn?.getTime() ?? Date.now() + 3_600_000;

    this.logger.debug('Microsoft Graph access token acquired.');
    return this.accessToken;
  }
}
