/** User representation returned by Microsoft Graph. */
export interface GraphUser {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  jobTitle?: string | null;
  companyName?: string | null;
}

/** Teams app entry returned inside the installedApps payload. */
export interface InstalledTeamsApp {
  teamsApp?: {
    id: string;
    externalId: string;
    displayName?: string;
  } | null;
}
