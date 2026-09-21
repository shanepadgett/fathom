import {
  createEffect,
  createResource,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { createStore, produce, reconcile } from "solid-js/store";
import type { ApiClient, Static } from "@fathom/sdk";
import type {
  CredentialsApi,
  LoginState,
  ProviderStatusSchema,
} from "@fathom/credentials/contract";
import type { ClientApi } from "@fathom/sdk/ui";

type ProviderStatus = Static<typeof ProviderStatusSchema>;

interface Connections {
  providers: ProviderStatus[];
  logins: Record<string, LoginState>;
  /** Id of the login most recently reported for each provider. */
  latest: Record<string, string>;
}

export function createConnections(props: {
  auth: ApiClient<typeof CredentialsApi.operations>;
  client: ClientApi;
}) {
  const [state, setState] = createStore<Connections>({
    providers: [],
    logins: {},
    latest: {},
  });

  const [actionError, setActionError] = createSignal("");
  const [busy, setBusy] = createSignal("");

  async function load(): Promise<Connections> {
    const auth = props.auth;

    const [providers, logins] = await Promise.all([
      auth.status({}),
      auth.logins({}),
    ]);

    return {
      providers,
      logins: Object.fromEntries(logins.map((login) => [login.id, login])),
      latest: Object.fromEntries(
        logins.map((login) => [login.provider, login.id]),
      ),
    };
  }

  const [loaded, { refetch }] = createResource(load);

  createEffect(() => {
    if (loaded.state === "ready") {
      setState(reconcile(loaded()));
    }
  });

  const error = () =>
    actionError() || (loaded.error ? String(loaded.error) : "");

  const action = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setActionError("");

    try {
      await fn();
      await refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };

  const loginFor = (provider: string): LoginState | undefined => {
    const pending = Object.values(state.logins).find(
      (login) =>
        login.provider === provider &&
        (login.state === "waiting" || login.state === "working"),
    );

    const latest = state.latest[provider];

    return pending ?? (latest ? state.logins[latest] : undefined);
  };

  onMount(() => {
    onCleanup(
      props.auth.changed.subscribe(() => {
        void refetch();
      }),
    );

    onCleanup(
      props.auth.loginChanged.subscribe((login) => {
        setState(
          produce((current) => {
            current.logins[login.id] = login;
            current.latest[login.provider] = login.id;
          }),
        );

        if (login.state === "connected") {
          void refetch();
        }
      }),
    );

    onCleanup(props.client.onReset(() => void refetch()));
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

  function open(provider: string, id: string) {
    const auth = props.auth;

    return action(provider, () => auth.open({ id }));
  }

  return {
    providers: () => state.providers,
    error,
    busy,
    loginFor,
    login,
    connect,
    remove,
    reply,
    cancel,
    open,
  };
}
