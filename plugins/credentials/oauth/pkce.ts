import type { Credential, LoginUi } from "../contract.ts";
import type { OAuthConfig } from "./config.ts";
import { exchange } from "./token-exchange.ts";

const VERIFIER_RANDOM_BYTES = 48;
const STATE_RANDOM_BYTES = 32;

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

/**
 * Request browser authorization and validate callback state before exchanging tokens.
 * Loopback mode also accepts pasted callbacks; its local server closes on exit.
 */
export async function loginPkce(
  config: OAuthConfig,
  ui: LoginUi,
  signal: AbortSignal,
  mode: "loopback" | "paste",
): Promise<Credential> {
  signal.throwIfAborted();

  const verifier = base64url(
    crypto.getRandomValues(new Uint8Array(VERIFIER_RANDOM_BYTES)),
  );

  const challenge = base64url(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    ),
  );

  const state = base64url(
    crypto.getRandomValues(new Uint8Array(STATE_RANDOM_BYTES)),
  );

  const url = new URL(config.authorizeUrl);

  for (const [key, value] of Object.entries({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scope,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    ...config.extra,
  })) {
    url.searchParams.set(key, value);
  }

  let server: Deno.HttpServer | undefined;
  let resolveCode!: (code: string) => void;

  const callback = new Promise<string>((resolve) => {
    resolveCode = resolve;
  });

  function parse(value: string) {
    let code: string | undefined;
    let receivedState: string | undefined;

    if (value.startsWith("http")) {
      const result = new URL(value);
      code = result.searchParams.get("code") ?? undefined;
      receivedState = result.searchParams.get("state") ?? undefined;

      if (result.searchParams.has("error")) {
        throw new Error("Provider declined authorization");
      }
    } else {
      [code, receivedState] = value.trim().split("#");
    }

    if (!code || receivedState !== state) {
      throw new Error(
        "Invalid callback or state. Paste the complete callback URL or code#state.",
      );
    }

    return code;
  }

  const aborted = new Promise<never>((_, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    callback.finally(() => signal.removeEventListener("abort", abort));
  });

  try {
    if (mode === "loopback") {
      const redirect = new URL(config.redirectUri);

      try {
        server = Deno.serve(
          {
            hostname: "127.0.0.1",
            port: Number(redirect.port),
            onListen: () => {},
          },
          (req) => {
            const incoming = new URL(req.url);

            if (incoming.pathname !== redirect.pathname) {
              return new Response("Not found", { status: 404 });
            }

            try {
              const code = parse(req.url);
              resolveCode(code);

              return new Response(
                "Login received. Return to Fathom to see the connection status.",
                {
                  headers: {
                    "content-type": "text/plain",
                    "cache-control": "no-store",
                  },
                },
              );
            } catch {
              return new Response(
                "Invalid login callback. Return to Fathom and try again.",
                {
                  status: 400,
                },
              );
            }
          },
        );
      } catch (e) {
        if (e instanceof Deno.errors.AddrInUse) {
          throw new Error(
            `Login port ${redirect.port} is busy. Close the other login flow or use device code.`,
          );
        }

        throw e;
      }
    }

    ui.notify({
      message:
        mode === "loopback"
          ? "Sign in in your browser. Fathom is listening for the callback."
          : "Sign in, then paste the authorization code from the provider.",
      url: url.href,
    });

    const pasted = ui
      .prompt(
        mode === "loopback"
          ? "If the callback does not arrive, paste the full callback URL."
          : "Paste the complete code#state from the provider.",
      )
      .then(parse);

    const code = await Promise.race([callback, pasted, aborted]);

    return await exchange(
      config,
      {
        grant_type: "authorization_code",
        code,
        code_verifier: verifier,
        redirect_uri: config.redirectUri,
        ...(config.format === "json" ? { state } : {}),
      },
      signal,
    );
  } finally {
    resolveCode("");
    await server?.shutdown();
  }
}
