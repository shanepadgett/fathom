import { decode, delay, request, T } from "@fathom/sdk";
import type { Credential, LoginUi } from "@fathom/credentials/contract";
import { exchange, type OAuthConfig } from "@fathom/credentials/oauth";

const DEFAULT_POLL_INTERVAL_SECONDS = 5;
const DEVICE_LOGIN_TIMEOUT_MS = 15 * 60_000;

/** OpenAI's device protocol: codex-rs/login/src/device_code_auth.rs. */
export async function loginOpenAIDevice(
  config: OAuthConfig,
  ui: LoginUi,
  signal: AbortSignal,
): Promise<Credential> {
  const issuer = new URL(config.authorizeUrl).origin;
  const base = `${issuer}/api/accounts/deviceauth`;

  const initial = await request(
    `${base}/usercode`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: config.clientId }),
    },
    signal,
    0,
  );

  const result = decode(
    T.Object({
      device_auth_id: T.String(),
      user_code: T.Optional(T.String()),
      usercode: T.Optional(T.String()),
      interval: T.Optional(T.Union([T.String(), T.Number()])),
    }),
    await initial.json(),
  );

  const code = result.user_code ?? result.usercode;

  if (!code) {
    throw new Error("Provider did not return a device code");
  }

  ui.notify({
    message:
      "Open the sign-in page and enter this code. Device login may need to be enabled in your ChatGPT security settings.",
    url: `${issuer}/codex/device`,
    code,
  });

  const interval =
    Math.max(1, Number(result.interval) || DEFAULT_POLL_INTERVAL_SECONDS) *
    1000;

  const until = Date.now() + DEVICE_LOGIN_TIMEOUT_MS;

  while (Date.now() < until) {
    await delay(interval, signal);

    const response = await fetch(`${base}/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        device_auth_id: result.device_auth_id,
        user_code: code,
      }),
      signal,
    });

    if (response.status === 403 || response.status === 404) {
      await response.body?.cancel();
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Device login failed (HTTP ${response.status})`);
    }

    const token = decode(
      T.Object({ authorization_code: T.String(), code_verifier: T.String() }),
      await response.json(),
    );

    return await exchange(
      config,
      {
        grant_type: "authorization_code",
        code: token.authorization_code,
        code_verifier: token.code_verifier,
        redirect_uri: `${issuer}/deviceauth/callback`,
      },
      signal,
    );
  }

  throw new Error("Device login expired. Start again.");
}
