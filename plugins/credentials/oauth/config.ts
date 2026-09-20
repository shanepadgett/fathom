export interface OAuthConfig {
  clientId: string;
  authorizeUrl: string;
  tokenUrl: string;
  redirectUri: string;
  scope: string;
  /** Token exchange encoding; defaults to form. */
  format?: "json" | "form";
  /** Additional authorization URL parameters. */
  extra?: Record<string, string>;
  accountId?(tokens: {
    accessToken: string;
    idToken?: string;
  }): string | undefined;
}
