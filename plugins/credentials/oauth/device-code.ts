import { decode, request, T } from "@fathom/sdk";
import { delay } from "@std/async";
import type { Credential, LoginUi } from "@fathom/credentials/contract";

const DEFAULT_TOKEN_LIFETIME_SECONDS = 3600;
const MIN_POLL_INTERVAL_MS = 1000;
const DEFAULT_POLL_INTERVAL_MS = 5000;
const SLOW_DOWN_INCREMENT_MS = 5000;
const MAX_TIMER_DELAY_MS = 2_147_483_647;

const FORM_HEADERS = {
  accept: "application/json",
  "content-type": "application/x-www-form-urlencoded",
};

export interface DeviceCodeConfig {
  clientId: string;
  deviceCodeUrl: string;
  tokenUrl: string;
  scope: string;
  referrer?: string;
  /** Milliseconds subtracted from token expiry to refresh early. Defaults to zero. */
  refreshSkewMs?: number;
}

const DeviceResponse = T.Object({
  device_code: T.String({ minLength: 1 }),
  user_code: T.String({ minLength: 1 }),
  verification_uri: T.String({ minLength: 1 }),
  verification_uri_complete: T.Optional(T.String()),
  expires_in: T.Number({ exclusiveMinimum: 0 }),
  interval: T.Optional(T.Unknown()),
});

const TokenResponse = T.Object({
  access_token: T.String({ minLength: 1 }),
  refresh_token: T.Optional(T.String({ minLength: 1 })),
  expires_in: T.Optional(T.Number({ exclusiveMinimum: 0 })),
});

const ErrorResponse = T.Object({
  error: T.Optional(T.String()),
  interval: T.Optional(T.Unknown()),
});

async function readJson(response: Response, signal: AbortSignal) {
  try {
    return await response.json();
  } catch {
    signal.throwIfAborted();
    throw new Error(
      `Device authorization returned invalid JSON (HTTP ${response.status})`,
    );
  }
}

function postForm(
  url: string,
  fields: Record<string, string>,
  signal: AbortSignal,
  retries?: number,
) {
  return request(
    url,
    {
      method: "POST",
      headers: FORM_HEADERS,
      body: new URLSearchParams(fields),
    },
    signal,
    retries,
  );
}

function verificationUrl(value: string) {
  const url = new URL(value);

  if (url.protocol !== "https:") {
    throw new Error("Device authorization returned an unsafe sign-in URL");
  }

  return url.href;
}

function credentials(
  config: DeviceCodeConfig,
  body: unknown,
  previousRefreshToken?: string,
): Credential {
  const token = decode(TokenResponse, body);
  const refreshToken = token.refresh_token ?? previousRefreshToken;

  if (!refreshToken) {
    throw new Error("Provider did not issue a refresh token");
  }

  return {
    kind: "oauth",
    accessToken: token.access_token,
    refreshToken,
    expiresAt:
      Date.now() +
      (token.expires_in ?? DEFAULT_TOKEN_LIFETIME_SECONDS) * 1000 -
      (config.refreshSkewMs ?? 0),
  };
}

/** Poll RFC 8628 authorization until success, denial, expiry, or cancellation. */
export async function loginDeviceCode(
  config: DeviceCodeConfig,
  ui: LoginUi,
  signal: AbortSignal,
): Promise<Credential> {
  signal.throwIfAborted();

  const response = await postForm(
    config.deviceCodeUrl,
    {
      client_id: config.clientId,
      scope: config.scope,
      ...(config.referrer ? { referrer: config.referrer } : {}),
    },
    signal,
  );

  const device = decode(DeviceResponse, await readJson(response, signal));
  const fallbackUrl = verificationUrl(device.verification_uri);

  const url = device.verification_uri_complete
    ? verificationUrl(device.verification_uri_complete)
    : fallbackUrl;

  const deadline = Date.now() + device.expires_in * 1000;

  const lifetime = AbortSignal.timeout(
    Math.min(MAX_TIMER_DELAY_MS, Math.ceil(device.expires_in * 1000)),
  );

  const pollingSignal = AbortSignal.any([signal, lifetime]);

  let interval =
    typeof device.interval === "number" &&
    Number.isFinite(device.interval) &&
    device.interval > 0
      ? Math.max(MIN_POLL_INTERVAL_MS, device.interval * 1000)
      : DEFAULT_POLL_INTERVAL_MS;

  ui.notify({
    message:
      "Open the sign-in page and authorize this device. Fathom will finish connecting automatically.",
    url,
    code: device.user_code,
  });

  try {
    while (Date.now() < deadline) {
      await delay(Math.min(interval, deadline - Date.now()), {
        signal: pollingSignal,
      });

      if (Date.now() >= deadline) {
        break;
      }

      // RFC 8628 reports pending, slow_down, and denial as HTTP 400 bodies,
      // so the poll reads the body instead of going through request().
      const result = await fetch(config.tokenUrl, {
        method: "POST",
        headers: FORM_HEADERS,
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          client_id: config.clientId,
          device_code: device.device_code,
        }),
        signal: pollingSignal,
      });

      const body = await readJson(result, pollingSignal);

      if (result.ok) {
        return credentials(config, body);
      }

      const error = decode(ErrorResponse, body);

      if (error.error === "authorization_pending") {
        continue;
      }

      if (error.error === "slow_down") {
        interval =
          typeof error.interval === "number" &&
          Number.isFinite(error.interval) &&
          error.interval > 0
            ? Math.max(interval + SLOW_DOWN_INCREMENT_MS, error.interval * 1000)
            : interval + SLOW_DOWN_INCREMENT_MS;

        continue;
      }

      if (
        error.error === "access_denied" ||
        error.error === "authorization_denied"
      ) {
        throw new Error("Device authorization was denied");
      }

      if (error.error === "expired_token") {
        throw new Error("Device code expired. Start login again.");
      }

      throw new Error(`Device token polling failed (HTTP ${result.status})`);
    }
  } catch (error) {
    if (error !== lifetime.reason) {
      throw error;
    }
  }

  throw new Error("Device code expired. Start login again.");
}

export async function refreshDeviceCode(
  config: DeviceCodeConfig,
  credential: Extract<Credential, { kind: "oauth" }>,
  signal: AbortSignal,
): Promise<Credential> {
  const response = await postForm(
    config.tokenUrl,
    {
      grant_type: "refresh_token",
      client_id: config.clientId,
      refresh_token: credential.refreshToken,
    },
    signal,
    0,
  );

  return credentials(
    config,
    await readJson(response, signal),
    credential.refreshToken,
  );
}
