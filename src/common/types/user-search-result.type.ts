/** Result of a user search that indicates whether the bot can message the user. */
export interface UserSearchResult {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  jobTitle: string | null;
  /** A conversation reference already exists (previously installed / messaged). */
  hasConversation: boolean;
  /** Whether the Teams app is installed for the user (null = could not be determined). */
  botInstalled: boolean | null;
  /** True when the bot is able to send proactive messages to the user right now. */
  canReceiveProactiveMessages: boolean;
}

/** Stored conversation reference exposed for administration. */
export interface ConversationListItem {
  aadObjectId: string;
  email: string | null;
  tenantId: string;
  conversationId: string;
  channelId: string;
  optOut: boolean;
  createdAt: Date;
  updatedAt: Date;
}
