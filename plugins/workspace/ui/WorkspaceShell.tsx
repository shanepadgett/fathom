import "./WorkspaceShell.css";
import { Slot, type ClientApi, type Contribution } from "@fathom/sdk/ui";
import type { Registry } from "@fathom/sdk";

export function WorkspaceShell(props: {
  client: ClientApi;
  panels: Registry<Contribution<Record<string, never>>>;
}) {
  return (
    <main class="app">
      <header class="masthead">
        <div>
          <div class="wordmark">
            fathom<span class="dot">.</span>
          </div>
          <p>Provider workbench</p>
        </div>
        <div class="connection">
          <span
            classList={{ live: props.client.connection() === "connected" }}
          />
          {props.client.connection()}
        </div>
      </header>
      <div class="intro">
        <span class="eyebrow">BASELINE / 01</span>
        <h1>Connect your providers.</h1>
        <p>Save a connection, choose a model, and make a first request.</p>
      </div>
      <Slot registry={props.panels} context={{}} />
      <footer>Local workspace · Credentials stay on this machine</footer>
    </main>
  );
}
