import {
  command,
  defineApi,
  defineRegistry,
  defineService,
  event,
  query,
  type Static,
  T,
} from "@fathom/sdk";

const MAX_LOGIN_REPLY_LENGTH = 16_384;

export const CredentialSchema = T.Union([
  T.Object(
    { kind: T.Literal("api-key"), key: T.String({ minLength: 1 }) },
    {
      additionalProperties: false,
    },
  ),
  T.Object(
    {
      kind: T.Literal("oauth"),
      accessToken: T.String({ minLength: 1 }),
      refreshToken: T.String({ minLength: 1 }),
      /** Unix time in milliseconds; providers may subtract a refresh margin. */
      expiresAt: T.Number(),
      accountId: T.Optional(T.String()),
    },
    { additionalProperties: false },
  ),
]);

export type Credential = Static<typeof CredentialSchema>;

export const LoginStateSchema = T.Object({
  id: T.String(),
  provider: T.String(),
  method: T.String(),
  state: T.Union([
    T.Literal("working"),
    T.Literal("waiting"),
    T.Literal("connected"),
    T.Literal("failed"),
    T.Literal("cancelled"),
  ]),
  message: T.String(),
  url: T.Optional(T.String()),
  code: T.Optional(T.String()),
  prompt: T.Optional(T.String()),
});

export type LoginState = Static<typeof LoginStateSchema>;

export interface LoginUi {
  /** Public login status only; never include access tokens or refresh tokens. */
  notify(value: { message: string; url?: string; code?: string }): void;
  /** Wait for a secret reply. Only one prompt may be pending per login session. */
  prompt(message: string): Promise<string>;
}

/** Provider-owned authentication. Honor cancellation and release flow resources. */
export interface LoginFlow {
  provider: string;
  label: string;
  methods: { id: string; label: string }[];
  login(method: string, ui: LoginUi, signal: AbortSignal): Promise<Credential>;
  refresh?(
    credential: Extract<Credential, { kind: "oauth" }>,
    signal: AbortSignal,
  ): Promise<Credential>;
}

export const Logins = defineRegistry<LoginFlow>("fathom.credentials.logins", {
  key: (entry) => entry.provider,
});

export const Credentials = defineService<{
  /**
   * Backend-only secret access. Returns undefined if missing or being removed.
   * May refresh and persist tokens; concurrent callers share that refresh.
   * Caller cancellation does not cancel a shared refresh. Refresh failures reject.
   */
  get(provider: string, signal: AbortSignal): Promise<Credential | undefined>;
}>("fathom.credentials");

export const ProviderStatusSchema = T.Object({
  id: T.String(),
  label: T.String(),
  connected: T.Boolean(),
  kind: T.Optional(T.String()),
  expiresAt: T.Optional(T.Number()),
  methods: T.Array(T.Object({ id: T.String(), label: T.String() })),
});

const Empty = T.Object({}, { additionalProperties: false });

/** UI login controls and status; saved credentials are never returned. */
export const CredentialsApi = defineApi("fathom.credentials.api", {
  status: query({ input: Empty, output: T.Array(ProviderStatusSchema) }),
  logins: query({ input: Empty, output: T.Array(LoginStateSchema) }),
  login: command({
    input: T.Object(
      { provider: T.String(), method: T.String() },
      { additionalProperties: false },
    ),
    output: T.Object({ id: T.String() }),
  }),
  reply: command({
    input: T.Object(
      {
        id: T.String(),
        value: T.String({ minLength: 1, maxLength: MAX_LOGIN_REPLY_LENGTH }),
      },
      {
        additionalProperties: false,
      },
    ),
    output: Empty,
  }),
  cancel: command({
    input: T.Object({ id: T.String() }, { additionalProperties: false }),
    output: Empty,
  }),
  /** Open the login's sign-in page in the system browser, never in the app window. */
  open: command({
    input: T.Object({ id: T.String() }, { additionalProperties: false }),
    output: Empty,
  }),
  remove: command({
    input: T.Object({ provider: T.String() }, { additionalProperties: false }),
    output: Empty,
  }),
  changed: event(T.Object({})),
  loginChanged: event(LoginStateSchema),
});
