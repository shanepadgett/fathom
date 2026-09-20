import type { Registry, Scope } from "@fathom/sdk";
import type { Credentials } from "@fathom/credentials/contract";
import type { Llm, Provider } from "@fathom/llm/contract";

const MODEL_CATALOG_TIMEOUT_MS = 60_000;
const MODEL_STREAM_TIMEOUT_MS = 5 * 60_000;

export type LlmService = NonNullable<(typeof Llm)["_type"]>;

export function createLlmService(
  providers: Registry<Provider>,
  credentials: NonNullable<(typeof Credentials)["_type"]>,
  scope: Scope,
): LlmService {
  const select = (provider: string) => {
    const lease = providers.lease(provider);

    if (!lease) {
      throw new Error("Provider stopping");
    }

    return lease;
  };

  const llm: LlmService = {
    async models(provider, signal) {
      using lease = select(provider);

      const combined = AbortSignal.any([
        signal,
        lease.signal,
        scope.signal,
        AbortSignal.timeout(MODEL_CATALOG_TIMEOUT_MS),
      ]);

      const credential = await credentials.get(provider, combined);

      if (!credential) {
        throw new Error("Connect this provider first");
      }

      return await lease.value.models(credential, combined);
    },

    async *stream(opts, signal) {
      using lease = select(opts.provider);

      const combined = AbortSignal.any([
        signal,
        lease.signal,
        scope.signal,
        AbortSignal.timeout(MODEL_STREAM_TIMEOUT_MS),
      ]);

      const credential = await credentials.get(opts.provider, combined);

      if (!credential) {
        throw new Error("Connect this provider first");
      }

      yield* lease.value.stream(opts, credential, combined);
    },
  };

  return llm;
}
