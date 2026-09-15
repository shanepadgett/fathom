import type { Accessor } from "solid-js";
import type {
  LanguageServerStatus,
  RegisteredLanguageServerStatus,
} from "../../sdk/editor.ts";
import type { Transport } from "../transport.ts";
import { createEffect, createSignal, onCleanup } from "solid-js";

function createStatus<T>(
  transport: Transport,
  projectId: Accessor<string | undefined>,
  method: string,
  unavailable: (message: string) => T,
  parameters?: Accessor<Record<string, unknown>>,
) {
  const [status, setStatus] = createSignal<T>();
  let version = 0;
  let disposed = false;

  async function refresh() {
    const id = projectId();
    const requestVersion = ++version;
    if (!id) return;
    let next: T;
    try {
      next = await transport.request<T>(method, {
        ...parameters?.(),
        projectId: id,
      });
    } catch (error) {
      next = unavailable(
        error instanceof Error ? error.message : String(error),
      );
    }
    if (!disposed && version === requestVersion && projectId() === id) {
      setStatus(() => next);
    }
  }

  createEffect(() => {
    projectId();
    setStatus(undefined);
    void refresh();
  });
  const unsubscribe = transport.onEvent((event) => {
    if (event.projectId && event.projectId !== projectId()) return;
    if (event.type === "disconnected") {
      ++version;
      setStatus(() => unavailable("Disconnected from Fathom"));
    } else if (
      ["diagnostics", "language-server", "environment", "connected"].includes(
        event.type,
      )
    ) void refresh();
  });
  onCleanup(() => {
    disposed = true;
    ++version;
    unsubscribe();
  });
  return status;
}

function unavailable(message: string): LanguageServerStatus {
  return {
    name: "Language server",
    running: false,
    errors: 0,
    warnings: 0,
    error: message,
  };
}

export function createLanguageServer(
  transport: Transport,
  projectId: Accessor<string | undefined>,
  path?: Accessor<string | undefined>,
) {
  return createStatus(
    transport,
    projectId,
    "lsp.status",
    unavailable,
    () => path?.() ? { path: path() } : {},
  );
}

export function createLanguageServers(
  transport: Transport,
  projectId: Accessor<string | undefined>,
) {
  return createStatus<RegisteredLanguageServerStatus[]>(
    transport,
    projectId,
    "lsp.servers",
    (message) => [{
      ...unavailable(message),
      id: "connection",
      priority: 0,
      languages: {},
      state: "unavailable",
    }],
  );
}
