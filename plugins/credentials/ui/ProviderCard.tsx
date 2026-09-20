import "./ProviderCard.css";
import { For, Show } from "solid-js";
import type { Static } from "@fathom/sdk";
import type {
  LoginState,
  ProviderStatusSchema,
} from "@fathom/credentials/contract";
import { LoginStatus } from "./LoginStatus.tsx";

export function ProviderCard(props: {
  provider: Static<typeof ProviderStatusSchema>;
  login?: LoginState;
  busy: boolean;
  onLogin: (method: string) => void;
  onRemove: () => void;
  onReply: (id: string, value: string) => void;
  onCancel: (id: string) => void;
}) {
  return (
    <article class="provider-card">
      <div class="card-heading">
        <div class="provider-icon">{props.provider.label.slice(0, 1)}</div>
        <div>
          <h3>{props.provider.label}</h3>
          <span classList={{ saved: props.provider.connected }}>
            {props.provider.connected
              ? `Saved · ${props.provider.kind === "oauth" ? "OAuth" : "API key"}`
              : "Not connected"}
          </span>
        </div>
      </div>
      <div class="login-methods">
        <For each={props.provider.methods}>
          {(method) => (
            <button
              type="button"
              disabled={
                props.busy ||
                ["waiting", "working"].includes(props.login?.state ?? "")
              }
              onClick={() => props.onLogin(method.id)}
            >
              {method.label}
              <span>↗</span>
            </button>
          )}
        </For>
      </div>
      <Show when={props.provider.connected}>
        <button
          type="button"
          class="text-button"
          disabled={props.busy}
          onClick={() => props.onRemove()}
        >
          Remove saved connection
        </button>
      </Show>
      <Show when={props.login} keyed>
        {(login) => (
          <LoginStatus
            login={login}
            busy={props.busy}
            onReply={(value) => props.onReply(login.id, value)}
            onCancel={() => props.onCancel(login.id)}
          />
        )}
      </Show>
    </article>
  );
}
