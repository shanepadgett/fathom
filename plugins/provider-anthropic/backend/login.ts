import type { LoginFlow } from "@fathom/credentials/contract";
import {
  loginPkce,
  type OAuthConfig,
  refreshOAuth,
} from "@fathom/credentials/oauth";

// The provider uses a hosted callback; users paste its code#state into Fathom.
const oauth: OAuthConfig = {
  clientId: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
  authorizeUrl: "https://claude.ai/oauth/authorize",
  tokenUrl: "https://platform.claude.com/v1/oauth/token",
  redirectUri: "https://console.anthropic.com/oauth/code/callback",
  scope: "org:create_api_key user:profile user:inference",
  format: "json",
  extra: { code: "true" },
};

export const loginFlow: LoginFlow = {
  provider: "anthropic",
  label: "Anthropic",
  methods: [
    { id: "browser", label: "Sign in with Claude" },
    {
      id: "api-key",
      label: "Use API key",
    },
  ],

  async login(method, ui, signal) {
    if (method === "api-key") {
      return {
        kind: "api-key",
        key: (await ui.prompt("Anthropic API key")).trim(),
      };
    }

    if (method === "browser") {
      return await loginPkce(oauth, ui, signal, "paste");
    }

    throw new Error("Unknown login method");
  },

  refresh: (credential, signal) => refreshOAuth(oauth, credential, signal),
};
