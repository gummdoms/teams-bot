/** Classified delivery failure kinds. */
export type ProactiveErrorKind = 'NOT_INSTALLED' | 'BLOCKED' | 'USER_NOT_FOUND' | 'ERROR';

interface ExtractedErrorInfo {
  status?: number;
  message: string;
}

/**
 * Classifies delivery errors based on the Bot Framework / Teams semantics:
 * - 403 + ForbiddenOperationException: the bot app is not installed for the user.
 * - 403 + MessageWritesBlocked: the user blocked, muted or uninstalled the bot.
 * - 404: the user does not exist in the tenant.
 */
export function classifyProactiveError(error: unknown): ProactiveErrorKind {
  const { status, message } = extractErrorInfo(error);

  if (status === 403) {
    if (message.includes('ForbiddenOperationException')) return 'NOT_INSTALLED';
    if (message.includes('MessageWritesBlocked')) return 'BLOCKED';
    return 'ERROR';
  }

  if (status === 404 && (message.includes('NotFound') || message.includes('user'))) {
    return 'USER_NOT_FOUND';
  }

  return 'ERROR';
}

/** Flattens the error object and its embedded response payloads. */
function extractErrorInfo(error: unknown): ExtractedErrorInfo {
  if (!error || typeof error !== 'object') {
    return { message: '' };
  }

  const e = error as Record<string, unknown>;
  const response = e.response as Record<string, unknown> | undefined;
  const status = (e.statusCode ?? response?.status) as number | undefined;

  const parts: string[] = [];
  const push = (value: unknown) => {
    if (typeof value === 'string') parts.push(value);
    else if (value !== undefined && value !== null) parts.push(JSON.stringify(value));
  };

  push(e.message);
  push(e.body);
  push(e.bodyAsText);
  if (response) {
    push(response.data);
    push(response.bodyAsText);
  }

  return { status, message: parts.join(' ') };
}
