import type { Registry, Scope } from "@fathom/sdk";
import type { Credential, LoginFlow } from "@fathom/credentials/contract";
import type { CredentialStore } from "./store.ts";

const REFRESH_AHEAD_MS = 60_000;
const REFRESH_TIMEOUT_MS = 60_000;

export type CredentialAccess = ReturnType<typeof createCredentialAccess>;

export function createCredentialAccess(
  store: CredentialStore,
  logins: Registry<LoginFlow>,
  scope: Scope,
  changed: () => void,
) {
  const refreshes = new Map<string, Promise<Credential>>();
  const removing = new Set<string>();

  function assertAvailable(provider: string) {
    if (removing.has(provider)) {
      throw new Error("Connection is being removed");
    }
  }

  return {
    assertAvailable,

    async save(provider: string, credential: Credential, signal: AbortSignal) {
      signal.throwIfAborted();
      // Let older refresh writes finish before replacing the saved credential.
      await refreshes.get(provider)?.catch(() => {});
      signal.throwIfAborted();
      await store.write(provider, credential);
    },

    async remove(provider: string, cancelLogin: () => Promise<void>) {
      assertAvailable(provider);
      removing.add(provider);

      try {
        await cancelLogin();
        await refreshes.get(provider)?.catch(() => {});
        await store.write(provider, undefined);
        changed();
      } finally {
        removing.delete(provider);
      }
    },

    async get(provider: string, signal: AbortSignal) {
      signal.throwIfAborted();

      if (removing.has(provider)) {
        return undefined;
      }

      const credential = store.get(provider);

      if (
        !credential ||
        credential.kind === "api-key" ||
        credential.expiresAt > Date.now() + REFRESH_AHEAD_MS
      ) {
        return credential;
      }

      let flight = refreshes.get(provider);

      if (!flight) {
        const lease = logins.lease(provider);

        if (!lease?.value.refresh) {
          lease?.release();
          throw new Error("Please reconnect this provider");
        }

        flight = (async () => {
          using _activeLease = lease;

          try {
            const next = await lease.value.refresh!(
              credential,
              AbortSignal.any([
                scope.signal,
                lease.signal,
                AbortSignal.timeout(REFRESH_TIMEOUT_MS),
              ]),
            );

            await store.write(provider, next);
            changed();

            return next;
          } finally {
            refreshes.delete(provider);
          }
        })();

        refreshes.set(provider, flight);
      }

      const result = await flight;
      // A caller's cancellation must not cancel refresh work shared by others.
      signal.throwIfAborted();

      return result;
    },
  };
}
