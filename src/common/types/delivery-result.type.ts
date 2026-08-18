/**
 * Delivery states for proactive messages.
 * - SENT: the message was delivered.
 * - USER_NOT_FOUND: no Entra ID user matched the email.
 * - NOT_INSTALLED: the bot app is not installed for the user (403 ForbiddenOperationException).
 * - BLOCKED: the user blocked, muted or uninstalled the bot (403 MessageWritesBlocked).
 * - OPTED_OUT: the user opted out of proactive notifications.
 * - ERROR: unexpected delivery failure.
 */
export type DeliveryStatus =
  'SENT' | 'USER_NOT_FOUND' | 'NOT_INSTALLED' | 'BLOCKED' | 'OPTED_OUT' | 'ERROR';

/** Result of a single recipient delivery attempt. */
export interface RecipientResult {
  email: string;
  status: DeliveryStatus;
  message?: string;
  aadObjectId?: string;
  conversationId?: string;
  activityId?: string;
}

/** Aggregate response for a proactive broadcast. */
export interface SendProactiveResponse {
  total: number;
  sent: number;
  failed: number;
  results: RecipientResult[];
}
