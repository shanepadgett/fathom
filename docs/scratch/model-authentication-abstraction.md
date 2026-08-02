# Model authentication abstraction

Scope: authentication required to make model calls. This stops before agent sessions, tools, or other harness behavior.

## Why this is separate

Authentication has its own lifecycle: interactive login, secret storage, token refresh, logout, and conversion into request headers. Protocol adapters should not own that lifecycle, and model callers should not know whether a request uses an API key or OAuth.

The useful call path is:

```text
ModelTarget
  -> CredentialManager resolves target.authProfile
  -> AuthProfile refreshes if needed and produces request headers
  -> target.protocol sends the model request to target.baseUrl
```

## What the references do

### Vercel AI SDK

Vercel accepts an API key, Anthropic bearer token, custom headers, or custom transport when constructing a provider. It formats request authentication but does not log users in, refresh OAuth, or store credentials.

This is a good protocol-adapter boundary. OAuth lifecycle must be supplied elsewhere.

### Mastra

Mastra resolves explicit keys, environment variables, gateway credentials, and custom headers during model acquisition. It keeps secrets out of serialized tracing. It still expects usable credentials rather than owning provider subscription OAuth.

Useful lesson: credential resolution belongs beside model selection, below agent behavior.

### pi

Pi has the complete split:

- `CredentialStore` persists a tagged API-key or OAuth credential.
- provider auth owns `login`, `refresh`, and conversion to request auth.
- auth resolution refreshes expiring OAuth under an atomic store operation.
- resolved auth is applied immediately before protocol invocation.

This is the strongest reference, but it is broader than needed. Ambient cloud credentials, many OAuth providers, dynamic catalogs, and per-credential endpoint discovery can be omitted.

## Desired OAuth routes

### OpenAI GPT-5.6

Pi treats subscription OAuth as a distinct service route:

```text
ChatGPT Plus/Pro OAuth
  -> https://chatgpt.com/backend-api
  -> openai-codex-responses protocol
```

It is not the public OpenAI Responses API with a different bearer token. Requests need an account ID extracted from the access-token JWT plus Codex-specific headers and transport behavior.

Pi keeps an explicit Codex model list and reports verified support for:

- `gpt-5.6-luna`
- `gpt-5.6-sol`
- `gpt-5.6-terra`

It deliberately has no bare `gpt-5.6` **Codex** alias. Models.dev does list bare `gpt-5.6` for OpenAI's API, alongside Luna, Sol, and Terra; that is a different provider route and does not establish ChatGPT subscription access. Browser PKCE and headless device-code login are supported. Refresh tokens rotate and must be written back atomically.

**Boundary decision:** OpenAI Codex is its own route and protocol adapter. Do not hide it behind an `openai` adapter selected only by credential type.

### Anthropic Claude

Pi uses Claude Pro/Max OAuth authorization, exchanges and refreshes tokens through Anthropic's platform OAuth endpoint, then calls the Anthropic Messages API. OAuth requests differ from API-key requests in authorization headers and required beta flags.

The desired Haiku, Sonnet, and Opus targets are known to work through Claude subscriptions. The OAuth implementation does not need model discovery or entitlement filtering.

**Boundary decision:** one Anthropic Messages protocol adapter is enough, but API-key and OAuth auth profiles must produce different base headers. Avoid pi's token-prefix detection; preserve credential kind explicitly.

### xAI Grok 4.5

Pi implements xAI device-code OAuth for SuperGrok or X Premium. Its requested scope includes API and Grok CLI access. The resulting bearer token is sent to `https://api.x.ai/v1`, and `grok-4.5` is routed through OpenAI Responses rather than Chat Completions.

Grok 4.5 is known to work through the intended subscription. The implementation does not need dynamic entitlement filtering.

**Boundary decision:** reuse the OpenAI Responses message/stream machinery, with a small xAI route wrapper for endpoint, auth, and xAI-specific options.

## Model support boundary

In a general SDK, these are separate concerns:

1. **Adapter support:** harness knows how to encode and decode the model's protocol.
2. **OAuth scope:** token is permitted to request inference.
3. **Account entitlement:** provider currently allows that account to use that model.

Models.dev is the right source for static model facts: provider availability, provider model ID, capabilities, limits, and pricing. Its direct OpenAI, Anthropic, and xAI records currently describe API-key environments; it does not model the separate ChatGPT, Claude Pro/Max, or SuperGrok subscription OAuth routes.

Only first is fully answerable from that catalog. For this personal framework, desired subscription entitlements are a known input rather than something the software must discover. Provider rejection still needs a clear runtime error, but no entitlement abstraction or dynamic discovery system is justified.

## Minimal types

```ts
interface ModelTarget {
  id: string;
  provider: 'openai-codex' | 'anthropic' | 'xai';
  protocol: 'openai-codex-responses' | 'anthropic-messages' | 'openai-responses';
  baseUrl: string;
  authProfile: string;
}

type Credential =
  | { type: 'api-key'; value: string }
  | { type: 'oauth'; access: string; refresh: string; expiresAt: number };

interface AuthProfile {
  login(interaction: AuthInteraction): Promise<Credential>;
  refresh(credential: Credential, signal?: AbortSignal): Promise<Credential>;
  toRequestAuth(credential: Credential): Promise<{ headers: Record<string, string> }>;
}

interface CredentialStore {
  read(profile: string): Promise<Credential | undefined>;
  modify(
    profile: string,
    update: (current: Credential | undefined) => Promise<Credential | undefined>,
  ): Promise<Credential | undefined>;
  delete(profile: string): Promise<void>;
}
```

Actual implementation should use separate API-key and OAuth profile types so API keys do not pretend to support refresh. Shared shape above shows placement, not final TypeScript.

`modify` is intentionally stronger than `get` plus `set`. OAuth providers can rotate refresh tokens. Concurrent requests must not refresh the same token independently and overwrite the newer credential.

## Resolution policy

1. Explicit per-process credential override, if supplied.
2. Stored credential for target auth profile.
3. Environment API key, only when no stored credential exists.
4. Otherwise report that login is required.

Refresh several minutes before expiry. If refresh fails, preserve stored credential, report authentication failure, and require explicit re-login. Do not silently switch from failed OAuth to an environment API key; that can change billing account and available models.

## Storage boundary

Pi stores one credential per provider in a locked JSON file. Parent directory is owner-only and file mode is `0600`. Refresh happens while holding store's read-modify-write lock.

For a personal local CLI, same design is an acceptable first version with a named ceiling: filesystem permissions protect plaintext tokens, but they are not encrypted at rest. Upgrade path is an OS keychain-backed `CredentialStore`; model and auth interfaces should not change.

Never put tokens, authorization headers, refresh responses, or credential-bearing model configuration into traces or session transcripts.

## Login interaction boundary

The three routes need only two flow styles:

- browser PKCE with loopback callback and manual-code fallback
- device code for headless login

Keep UI outside auth profiles through a tiny interaction port for opening/displaying URLs, showing device codes, asking for manual input, and cancellation. OAuth implementations can remain Node-only because this harness is a local CLI.

## Initial implementation decision

Build three explicit auth profiles and three explicit model routes:

- OpenAI Codex OAuth + Codex Responses
- Anthropic OAuth + Anthropic Messages
- xAI OAuth + OpenAI Responses

API-key profiles can be added alongside them with little code. No generic provider registry, OAuth discovery framework, dynamic model catalog, or universal auth scheme is needed.

Run one authenticated text-and-tool smoke test for each desired model target to verify adapter behavior, not to discover entitlement.
