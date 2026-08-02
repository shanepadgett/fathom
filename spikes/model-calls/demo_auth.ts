import { isJsonObject } from "./src/json.ts";
import { Authorizer, ModelError } from "./src/types.ts";

type Provider = "openai-codex" | "anthropic" | "xai";
type OAuthCredential = { type: "oauth"; access: string; expires: number };
type HeaderBuilder = (access: string) => HeadersInit;

const CLAUDE_CODE_IDENTITY = "You are Claude Code, Anthropic's official CLI for Claude.";

export function piOpenAICodexAuthorizer(path = defaultPath()): Authorizer {
  return piOAuthAuthorizer("openai-codex", path, (access) => ({
    Authorization: `Bearer ${access}`,
    "chatgpt-account-id": codexAccountId(access),
    originator: "pi",
  }));
}

export function piAnthropicModelOptions(path = defaultPath()): {
  auth: Authorizer;
  requiredSystemPrompt: string;
} {
  return {
    auth: piOAuthAuthorizer("anthropic", path, (access) => ({
      Authorization: `Bearer ${access}`,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "claude-code-20250219,oauth-2025-04-20",
      "anthropic-dangerous-direct-browser-access": "true",
      "user-agent": "claude-cli/2.1.75",
      "x-app": "cli",
    })),
    requiredSystemPrompt: CLAUDE_CODE_IDENTITY,
  };
}

export function piXaiAuthorizer(path = defaultPath()): Authorizer {
  return piOAuthAuthorizer("xai", path, (access) => ({ Authorization: `Bearer ${access}` }));
}

function piOAuthAuthorizer(provider: Provider, path: string, build: HeaderBuilder): Authorizer {
  return {
    async requestAuth(signal?: AbortSignal): Promise<{ headers: HeadersInit }> {
      if (signal?.aborted) throw new ModelError("aborted", "Authentication was aborted");
      let info: Deno.FileInfo;
      let parsed: unknown;
      try {
        info = await Deno.lstat(path);
        if (!info.isFile || info.isSymlink) throw new Error("not a regular file");
        if (info.mode !== null && (info.mode & 0o077) !== 0) throw new Error("unsafe permissions");
        parsed = JSON.parse(await Deno.readTextFile(path));
      } catch (error) {
        throw new ModelError(
          "auth",
          `Pi OAuth credential for ${provider} is unavailable or unsafe; refresh or log in through Pi`,
          { cause: error },
        );
      }
      const value = isJsonObject(parsed) ? parsed[provider] : undefined;
      if (!isOAuthCredential(value)) {
        throw new ModelError(
          "auth",
          `Pi OAuth credential for ${provider} is missing or invalid; refresh or log in through Pi`,
        );
      }
      if (value.expires <= Date.now()) {
        throw new ModelError(
          "auth",
          `Pi OAuth credential for ${provider} is expired; refresh or log in through Pi`,
        );
      }
      try {
        return { headers: build(value.access) };
      } catch (error) {
        throw new ModelError(
          "auth",
          `Pi OAuth credential for ${provider} cannot authorize this route; refresh or log in through Pi`,
          { cause: error },
        );
      }
    },
  };
}

function codexAccountId(access: string): string {
  const parts = access.split(".");
  if (parts.length !== 3) throw new Error("invalid access token shape");
  const payload = JSON.parse(
    new TextDecoder().decode(Uint8Array.fromBase64(parts[1], { alphabet: "base64url" })),
  ) as unknown;
  if (!isJsonObject(payload)) throw new Error("invalid access token payload");
  const auth = payload["https://api.openai.com/auth"];
  if (!isJsonObject(auth) || typeof auth.chatgpt_account_id !== "string") {
    throw new Error("missing account claim");
  }
  return auth.chatgpt_account_id;
}

function isOAuthCredential(value: unknown): value is OAuthCredential {
  return isJsonObject(value) && value.type === "oauth" && typeof value.access === "string" &&
    value.access.length > 0 && typeof value.expires === "number" && Number.isFinite(value.expires);
}

function defaultPath(): string {
  const home = Deno.env.get("HOME");
  if (!home) {
    throw new ModelError("auth", "HOME is unavailable; cannot locate Pi OAuth credentials");
  }
  return `${home}/.pi/agent/auth.json`;
}
