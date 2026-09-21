import { createSignal } from "solid-js";
import {
  type ApiClient,
  type ApiShape,
  type ApiToken,
  decode,
  type Dispose,
  EventEnvelopeSchema,
  T,
} from "@fathom/sdk";
import type { ClientApi } from "@fathom/sdk/ui";
import { delay, readSse } from "@fathom/sdk";

const RECONNECT_DELAY_MS = 1000;

type ConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "unauthorized"
  | "disconnected";

export class BrowserClient implements ClientApi {
  private listeners = new Map<string, Set<(value: unknown) => void>>();
  private resets = new Set<() => void>();
  private controller = new AbortController();
  private epoch = "";
  private cursor = 0;
  private setConnection: (state: ConnectionState) => void;
  readonly connection: () => ConnectionState;

  constructor(
    private token: string,
    private onContracts: (ids: string[]) => Promise<void>,
  ) {
    const [state, setState] = createSignal<ConnectionState>("connecting");
    this.connection = state;
    this.setConnection = setState;
  }

  async request(
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal
        ? AbortSignal.any([signal, this.controller.signal])
        : this.controller.signal,
    });

    const result: unknown = await response.json();

    if (!response.ok) {
      throw new Error(
        result &&
          typeof result === "object" &&
          "error" in result &&
          typeof result.error === "string"
          ? result.error
          : `HTTP ${response.status}`,
      );
    }

    return result;
  }

  api<S extends ApiShape>(token: ApiToken<S>): ApiClient<S> {
    // Each member follows its operation schema; Object.fromEntries loses that mapping.
    return Object.fromEntries(
      Object.entries(token.operations).map(([key, op]) => [
        key,
        op.kind === "event"
          ? {
              subscribe: (fn: (value: unknown) => void) =>
                this.subscribe(`${token.id}.${key}`, (value) =>
                  fn(decode(op.schema, value)),
                ),
            }
          : async (input: unknown, signal?: AbortSignal) =>
              decode(
                op.output,
                await this.request(
                  `/api/x/${token.id}/${key}`,
                  decode(op.input, input),
                  signal,
                ),
              ),
      ]),
    ) as ApiClient<S>;
  }

  subscribe(type: string, fn: (value: unknown) => void): Dispose {
    let group = this.listeners.get(type);

    if (!group) {
      group = new Set();
      this.listeners.set(type, group);
    }

    group.add(fn);

    return () => {
      group.delete(fn);

      if (!group.size) {
        this.listeners.delete(type);
      }
    };
  }

  onReset(fn: () => void): Dispose {
    this.resets.add(fn);

    return () => {
      this.resets.delete(fn);
    };
  }

  async connect() {
    while (!this.controller.signal.aborted) {
      try {
        const response = await fetch(
          `/api/events?epoch=${encodeURIComponent(this.epoch)}&cursor=${this.cursor}`,
          {
            headers: { authorization: `Bearer ${this.token}` },
            signal: this.controller.signal,
          },
        );

        if (!response.ok) {
          if (response.status === 401) {
            this.setConnection("unauthorized");

            return;
          }

          throw new Error("Connection failed");
        }

        if (!response.body) {
          throw new Error("Event stream unavailable");
        }

        this.setConnection("connected");

        for await (const frame of readSse(response.body)) {
          const envelope = decode(EventEnvelopeSchema, JSON.parse(frame.data));

          if (envelope.type === "reset") {
            const snapshot = decode(
              T.Object({
                contracts: T.Array(T.String()),
                plugins: T.Array(T.Unknown()),
              }),
              envelope.payload,
            );

            await this.onContracts(snapshot.contracts);

            for (const reset of this.resets) {
              try {
                reset();
              } catch {
                // An observer cannot break reconnect.
              }
            }
          } else if (envelope.type === "contracts") {
            await this.onContracts(
              decode(T.Array(T.String()), envelope.payload),
            );
          }

          for (const fn of this.listeners.get(envelope.type) ?? []) {
            try {
              fn(envelope.payload);
            } catch {
              // Invalid plugin events are isolated.
            }
          }

          this.epoch = envelope.epoch;
          this.cursor = envelope.cursor;
        }
      } catch {
        if (this.controller.signal.aborted) {
          return;
        }
      }

      this.setConnection("reconnecting");

      try {
        await delay(RECONNECT_DELAY_MS, this.controller.signal);
      } catch {
        return;
      }
    }
  }

  close() {
    this.controller.abort();
    this.setConnection("disconnected");
  }
}
