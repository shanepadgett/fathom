import { createSignal, onCleanup, onMount } from "solid-js";
import type { ApiClient, Static } from "@fathom/sdk";
import type {
  CredentialsApi,
  LoginState,
  ProviderStatusSchema,
} from "@fathom/credentials/contract";
import type { ClientApi } from "@fathom/sdk/ui";

type ProviderStatus = Static<typeof ProviderStatusSchema>;

export function createConnections(props: {
  auth: ApiClient<typeof CredentialsApi.operations>;
  client: ClientApi;
}) {
  const [providers, setProviders] = createSignal<ProviderStatus[]>([]);
  const [logins, setLogins] = createSignal<LoginState[]>([]);
  const [error, setError] = createSignal("");
  const [busy, setBusy] = createSignal("");

  async function refresh() {
    try {
      setProviders(await props.auth.status({}));
      setLogins(await props.auth.logins({}));
    } catch (e) {
      setError(String(e));
    }
  }

  const action = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError("");

    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };

  const loginFor = (id: string) =>
    logins().find(
      (l) =>
        l.provider === id && (l.state === "waiting" || l.state === "working"),
    ) ?? [...logins()].reverse().find((l) => l.provider === id);

  onMount(() => {
    void refresh();
  });

  onMount(() => {
    onCleanup(
      props.auth.changed.subscribe(() => {
        void refresh();
      }),
    );

    onCleanup(
      props.auth.loginChanged.subscribe((login) => {
        setLogins((old) => [...old.filter((l) => l.id !== login.id), login]);

        if (login.state === "connected") {
          void refresh();
        }
      }),
    );

    onCleanup(props.client.onReset(() => void refresh()));
  });

  function login(provider: string, method: string) {
    const auth = props.auth;

    return action(provider, () => auth.login({ provider, method }));
  }

  /** Reference API key form: one submit starts the login and sends the key. */
  function connect(provider: string, method: string, value: string) {
    const auth = props.auth;

    return action(provider, async () => {
      const { id } = await auth.login({ provider, method });

      await auth.reply({ id, value });
    });
  }

  function remove(provider: string) {
    const auth = props.auth;

    return action(provider, () => auth.remove({ provider }));
  }

  function reply(provider: string, id: string, value: string) {
    const auth = props.auth;

    return action(provider, () => auth.reply({ id, value }));
  }

  function cancel(provider: string, id: string) {
    const auth = props.auth;

    return action(provider, () => auth.cancel({ id }));
  }

  return {
    providers,
    error,
    busy,
    loginFor,
    login,
    connect,
    remove,
    reply,
    cancel,
  };
}
