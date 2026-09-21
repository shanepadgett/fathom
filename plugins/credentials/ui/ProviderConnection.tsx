import { createSignal, For, Show } from "solid-js";
import type { Static } from "@fathom/sdk";
import type {
  LoginState,
  ProviderStatusSchema,
} from "@fathom/credentials/contract";
import { Button, Field, Icon, Input, SettingsSection } from "@fathom/sdk/ui";
import { LoginStatus } from "./LoginStatus.tsx";

const monogram = (label: string) => label.slice(0, 1);

export function ProviderConnection(props: {
  provider: Static<typeof ProviderStatusSchema>;
  login?: LoginState;
  busy: boolean;
  onLogin: (method: string) => void;
  onConnect: (method: string, value: string) => void;
  onRemove: () => void;
  onReply: (id: string, value: string) => void;
  onCancel: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const [key, setKey] = createSignal("");

  const apiKey = () =>
    props.provider.methods.find((method) => method.id === "api-key");

  const signIn = () =>
    props.provider.methods.filter((method) => method.id !== "api-key");

  const pending = () =>
    props.login?.state === "waiting" || props.login?.state === "working";

  const oauth = () => props.provider.kind === "oauth";

  const methods = () => (
    <>
      <For each={signIn()}>
        {(method) => (
          <div class="flex flex-wrap items-center justify-between gap-4 py-4">
            <span class="text-sm">{method.label}</span>
            <Button
              variant="secondary"
              disabled={props.busy || pending()}
              onClick={() => props.onLogin(method.id)}
            >
              <Icon name="arrow-square-out" />
              {method.label}
            </Button>
          </div>
        )}
      </For>
      <Show when={signIn().length}>
        <div class="my-6 flex items-center gap-3 type-micro">
          <span class="h-px flex-1 bg-line" />
          OR
          <span class="h-px flex-1 bg-line" />
        </div>
      </Show>
      <Show when={apiKey()}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const value = key().trim();

            if (!value || !apiKey()) {
              return;
            }

            props.onConnect("api-key", value);
            setKey("");
          }}
        >
          <Field id="provider-api-key" label="API key">
            <div class="flex items-center gap-3">
              <Input
                id="provider-api-key"
                class="flex-1"
                type="password"
                autocomplete="off"
                required
                placeholder="Paste API key"
                value={key()}
                disabled={props.busy}
                onInput={(event) => setKey(event.currentTarget.value)}
              />
              <Button type="submit" variant="primary" disabled={props.busy}>
                Connect
              </Button>
            </div>
          </Field>
        </form>
      </Show>
    </>
  );

  return (
    <SettingsSection>
      <header class="mb-8 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface font-mono text-lg">
            {monogram(props.provider.label)}
          </span>
          <h1 class="type-title">{props.provider.label}</h1>
        </div>
        <span class="inline-flex items-center gap-2 type-description">
          {props.provider.connected
            ? `Connected · ${
                props.provider.kind === "oauth" ? "OAuth" : "API key"
              }`
            : "Not connected"}
        </span>
      </header>
      <section aria-label="Connection">
        <Show
          when={props.provider.connected && !pending()}
          fallback={methods()}
        >
          <div class="flex flex-wrap items-center justify-between gap-4 py-4">
            <span class="text-sm">
              {oauth() ? "Signed in with OAuth" : "Connected with an API key"}
            </span>
            <Button
              variant="secondary"
              disabled={props.busy}
              onClick={() => props.onRemove()}
            >
              {oauth() ? "Sign out" : "Remove key"}
            </Button>
          </div>
        </Show>
        <Show
          when={props.login?.state === "connected" ? undefined : props.login}
          keyed
        >
          {(login) => (
            <LoginStatus
              login={login}
              busy={props.busy}
              onReply={(value) => props.onReply(login.id, value)}
              onCancel={() => props.onCancel(login.id)}
              onOpen={() => props.onOpen(login.id)}
            />
          )}
        </Show>
      </section>
    </SettingsSection>
  );
}
