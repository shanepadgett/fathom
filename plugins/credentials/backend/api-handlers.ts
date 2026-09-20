import type { CredentialStore } from "./store.ts";
import type { Handlers, Registry } from "@fathom/sdk";
import type { CredentialsApi, LoginFlow } from "@fathom/credentials/contract";
import type { CredentialAccess } from "./credential-access.ts";
import type { LoginSessions } from "./login-sessions.ts";

export function createCredentialHandlers(
  store: CredentialStore,
  logins: Registry<LoginFlow>,
  access: CredentialAccess,
  sessions: LoginSessions,
): Handlers<typeof CredentialsApi.operations> {
  return {
    status: () =>
      logins.entries().map(({ value: flow }) => {
        const credential = store.get(flow.provider);

        return {
          id: flow.provider,
          label: flow.label,
          connected: !!credential,
          kind: credential?.kind,
          expiresAt:
            credential?.kind === "oauth" ? credential.expiresAt : undefined,
          methods: flow.methods,
        };
      }),

    logins: () => sessions.list(),
    login: (input) => sessions.login(input),

    reply: ({ id, value }) => {
      sessions.reply(id, value);

      return {};
    },

    cancel: async ({ id }) => {
      await sessions.cancel(id);

      return {};
    },

    remove: async ({ provider }) => {
      await access.remove(provider, () => sessions.cancelProvider(provider));

      return {};
    },
  };
}
