import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GraphUser, InstalledTeamsApp } from '../../common/types/graph-user.type';
import { ENV } from '../../common/constants/config-globals';
import { firstNonEmpty } from '../../common/utils/env.utils';
import { MsalService } from '../../shared/msal/msal.service';

const USER_SELECT_FIELDS = 'id,displayName,mail,userPrincipalName,jobTitle,companyName';
const MAX_SEARCH_RESULTS = 10;

/** Escapes a value for use inside an OData single-quoted string. */
function odataEscape(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Microsoft Graph client: user search/resolution and Teams app installation.
 * All calls use application permissions (client credentials flow).
 */
@Injectable()
export class GraphService {
  private readonly logger = new Logger(GraphService.name);

  constructor(
    private readonly msalService: MsalService,
    private readonly configService: ConfigService,
  ) {}

  /** Searches users whose mail, UPN or display name starts with the query. */
  async searchUsers(query: string, limit = MAX_SEARCH_RESULTS): Promise<GraphUser[]> {
    const escaped = odataEscape(query.trim());
    const filter = [
      `startswith(userPrincipalName,'${escaped}')`,
      `startswith(mail,'${escaped}')`,
      `startswith(displayName,'${escaped}')`,
    ].join(' or ');

    const url = new URL(`${this.graphBaseUrl}/users`);
    url.searchParams.set('$filter', filter);
    url.searchParams.set('$select', USER_SELECT_FIELDS);
    url.searchParams.set('$top', String(limit));

    const data = await this.get<{ value: GraphUser[] }>(url);
    return data.value ?? [];
  }

  /** Resolves a user by UPN or primary SMTP address. */
  async getUserByEmail(email: string): Promise<GraphUser | null> {
    const escaped = odataEscape(email.trim().toLowerCase());
    const filter = `userPrincipalName eq '${escaped}' or mail eq '${escaped}'`;

    const url = new URL(`${this.graphBaseUrl}/users`);
    url.searchParams.set('$filter', filter);
    url.searchParams.set('$select', USER_SELECT_FIELDS);
    url.searchParams.set('$top', '1');

    const data = await this.get<{ value: GraphUser[] }>(url);
    return data.value?.[0] ?? null;
  }

  /** Resolves a user by its Microsoft Entra object id. */
  async getUserById(aadObjectId: string): Promise<GraphUser | null> {
    const url = new URL(`${this.graphBaseUrl}/users/${encodeURIComponent(aadObjectId)}`);
    url.searchParams.set('$select', USER_SELECT_FIELDS);
    return this.get<GraphUser>(url);
  }

  /**
   * Checks whether the Teams app is installed for a user.
   * Returns null when the check cannot be performed (missing Graph permission).
   */
  async isAppInstalledForUser(userId: string): Promise<boolean | null> {
    try {
      const manifestAppId = this.configService.get<string>(ENV.MANIFEST_APP_ID);
      if (!manifestAppId) return null;

      const url = new URL(
        `${this.graphBaseUrl}/users/${encodeURIComponent(userId)}/teamwork/installedApps`,
      );
      url.searchParams.set('$expand', 'teamsApp($select=id,externalId,displayName)');
      url.searchParams.set('$top', '100');

      const data = await this.get<{ value: InstalledTeamsApp[] }>(url);
      return (data.value ?? []).some((app) => app.teamsApp?.externalId === manifestAppId);
    } catch (error) {
      this.logger.warn(
        `Unable to check Teams app installation for user ${userId}: ${this.errorMessage(error)}`,
      );
      return null;
    }
  }

  /** Installs the Teams app for a user (proactive installation). */
  async installAppForUser(userId: string): Promise<void> {
    const catalogId =
      this.configService.get<string>(ENV.TEAMS_APP_CATALOG_ID) ??
      (await this.resolveTeamsAppCatalogId());

    if (!catalogId) {
      throw new Error('Unable to resolve the Teams app catalog id for proactive installation.');
    }

    const url = new URL(
      `${this.graphBaseUrl}/users/${encodeURIComponent(userId)}/teamwork/installedApps`,
    );
    await this.post(url, {
      'teamsApp@odata.bind': `https://graph.microsoft.com/v1.0/appCatalogs/teamsApps/${catalogId}`,
    });
  }

  /** Looks up the Teams catalog id of the app declared in the manifest. */
  private async resolveTeamsAppCatalogId(): Promise<string | null> {
    const manifestAppId = this.configService.get<string>(ENV.MANIFEST_APP_ID);
    if (!manifestAppId) return null;

    const url = new URL(`${this.graphBaseUrl}/appCatalogs/teamsApps`);
    url.searchParams.set('$filter', `externalId eq '${odataEscape(manifestAppId)}'`);
    url.searchParams.set('$select', 'id,externalId,displayName');

    const data = await this.get<{ value: Array<{ id: string }> }>(url);
    return data.value?.[0]?.id ?? null;
  }

  private get graphBaseUrl(): string {
    return (
      firstNonEmpty(this.configService.get<string>(ENV.GRAPH_BASE_URL)) ??
      'https://graph.microsoft.com/v1.0'
    );
  }

  private async get<T>(url: URL): Promise<T> {
    const token = await this.msalService.getAccessToken();
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ConsistencyLevel: 'eventual',
      },
    });
    return this.handleResponse<T>(response);
  }

  private async post<T = void>(url: URL, body: Record<string, unknown>): Promise<T> {
    const token = await this.msalService.getAccessToken();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(response);
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Graph API error ${response.status}: ${body.slice(0, 500)}`);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
