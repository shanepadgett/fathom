import type { LoginFlow } from "@fathom/credentials/contract";
import { loginOpenAIDevice } from "./device.ts";
import {
  claims,
  loginPkce,
  type OAuthConfig,
  refreshOAuth,
} from "@fathom/credentials/oauth";

const oauth: OAuthConfig = {
  accountId({ accessToken, idToken }) {
    const identity = claims(idToken ?? accessToken);
    const access = claims(accessToken);

    const auth =
      identity["https://api.openai.com/auth"] ??
      access["https://api.openai.com/auth"];

    if (
      auth &&
      typeof auth === "object" &&
      "chatgpt_account_id" in auth &&
      typeof auth.chatgpt_account_id === "string"
    ) {
      return auth.chatgpt_account_id;
    }

    return undefined;
  },

  clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
  authorizeUrl: "https://auth.openai.com/oauth/authorize",
  tokenUrl: "https://auth.openai.com/oauth/token",
  redirectUri: "http://localhost:1455/auth/callback",
  scope: "openid profile email offline_access",
  extra: {
    id_token_add_organizations: "true",
    codex_cli_simplified_flow: "true",
    originator: "codex_cli_rs",
  },
};

export const loginFlow: LoginFlow = {
  provider: "openai",
  label: "OpenAI",
  methods: [
    { id: "browser", label: "Sign in with ChatGPT" },
    {
      id: "device",
      label: "Use device code",
    },
    { id: "api-key", label: "Use API key" },
  ],

  async login(method, ui, signal) {
    if (method === "api-key") {
      return {
        kind: "api-key",
        key: (await ui.prompt("OpenAI API key")).trim(),
      };
    }

    if (method === "device") {
      return await loginOpenAIDevice(oauth, ui, signal);
    }

    if (method === "browser") {
      return await loginPkce(oauth, ui, signal, "loopback");
    }

    throw new Error("Unknown login method");
  },

  refresh: (credential, signal) => refreshOAuth(oauth, credential, signal),
};
