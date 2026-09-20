import { decode, T, request } from "@fathom/sdk";
import type { Credential } from "../contract.ts";
import type { OAuthConfig } from "./config.ts";

const DEFAULT_TOKEN_LIFETIME_SECONDS = 3600;

const TokenResponse = T.Object({
  access_token: T.String({ minLength: 1 }),
  refresh_token: T.Optional(T.String({ minLength: 1 })),
  expires_in: T.Optional(T.Number()),
  id_token: T.Optional(T.String()),
});

/**
 * Decode JWT metadata without signature verification; return {} if malformed.
 * Never use for authorization.
 */
export function claims(token: string): Record<string, unknown> {
  try {
    const raw = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");

    return decode(
      T.Record(T.String(), T.Unknown()),
      JSON.parse(atob(raw.padEnd(Math.ceil(raw.length / 4) * 4, "="))),
    );
  } catch {
    return {};
  }
}

export async function exchange(
  config: OAuthConfig,
  fields: Record<string, string>,
  signal: AbortSignal,
  previous?: Extract<Credential, { kind: "oauth" }>,
): Promise<Credential> {
  const body = { client_id: config.clientId, ...fields };

  const response = await request(
    config.tokenUrl,
    {
      method: "POST",
      headers: {
        "content-type":
          config.format === "json"
            ? "application/json"
            : "application/x-www-form-urlencoded",
      },
      body:
        config.format === "json"
          ? JSON.stringify(body)
          : new URLSearchParams(body),
    },
    signal,
    0,
  );

  const tokens = decode(TokenResponse, await response.json());
  const refreshToken = tokens.refresh_token ?? previous?.refreshToken;

  if (!refreshToken) {
    throw new Error("Provider did not issue a refresh token");
  }

  const tokenClaims = claims(tokens.access_token);

  const exp =
    typeof tokenClaims.exp === "number"
      ? tokenClaims.exp * 1000
      : Date.now() +
        (tokens.expires_in ?? DEFAULT_TOKEN_LIFETIME_SECONDS) * 1000;

  return {
    kind: "oauth",
    accessToken: tokens.access_token,
    refreshToken,
    expiresAt: exp,
    accountId:
      config.accountId?.({
        accessToken: tokens.access_token,
        idToken: tokens.id_token,
      }) ?? previous?.accountId,
  };
}

export function refreshOAuth(
  config: OAuthConfig,
  credential: Extract<Credential, { kind: "oauth" }>,
  signal: AbortSignal,
): Promise<Credential> {
  return exchange(
    config,
    { grant_type: "refresh_token", refresh_token: credential.refreshToken },
    signal,
    credential,
  );
}
