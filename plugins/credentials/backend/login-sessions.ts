import type { Registry, Scope } from "@fathom/sdk";
import type { LoginFlow, LoginState } from "@fathom/credentials/contract";
import type { CredentialAccess } from "./credential-access.ts";

const LOGIN_HISTORY_LIMIT = 50;
const LOGIN_TIMEOUT_MS = 15 * 60_000;

interface LoginSession {
  state: LoginState;
  controller: AbortController;
  pendingReply?: {
    resolve(value: string): void;
    reject(error: unknown): void;
  };
  done?: Promise<void>;
}

export type LoginSessions = ReturnType<typeof createLoginSessions>;

export function createLoginSessions(
  logins: Registry<LoginFlow>,
  scope: Scope,
  access: CredentialAccess,
  notify: (state: LoginState) => void,
  connected: () => void,
) {
  const sessions = new Map<string, LoginSession>();
  const publish = (session: LoginSession) => notify(session.state);

  function active(provider: string) {
    return [...sessions.values()].find(
      (s) =>
        s.state.provider === provider &&
        ["waiting", "working"].includes(s.state.state),
    );
  }

  async function cancel(id: string) {
    const session = sessions.get(id);

    if (!session) {
      throw new Error("Unknown login");
    }

    session.controller.abort();

    session.pendingReply?.reject(
      new DOMException("Login cancelled", "AbortError"),
    );

    await session.done;
  }

  scope.defer(() => {
    sessions.clear();
  });

  function login({ provider, method }: { provider: string; method: string }) {
    access.assertAvailable(provider);

    if (active(provider)) {
      throw new Error("A login is already active for this provider");
    }

    const entry = logins.get(provider);

    if (!entry) {
      throw new Error("Login provider unavailable");
    }

    if (!entry.value.methods.some((m) => m.id === method)) {
      throw new Error("Unknown login method");
    }

    const lease = logins.lease(provider);

    if (!lease) {
      throw new Error("Login provider unavailable");
    }

    // Keep a bounded amount of non-secret login history for reconnects.
    if (sessions.size >= LOGIN_HISTORY_LIMIT) {
      for (const [id, s] of sessions) {
        if (!["waiting", "working"].includes(s.state.state)) {
          sessions.delete(id);
          break;
        }
      }
    }

    const id = crypto.randomUUID();
    const controller = new AbortController();

    const session: LoginSession = {
      state: {
        id,
        provider,
        method,
        state: "working",
        message: "Starting login…",
      },
      controller,
    };

    sessions.set(id, session);
    publish(session);

    const signal = AbortSignal.any([
      scope.signal,
      lease.signal,
      controller.signal,
      AbortSignal.timeout(LOGIN_TIMEOUT_MS),
    ]);

    const done = (async () => {
      using _activeLease = lease;

      try {
        const credential = await lease.value.login(
          method,
          {
            notify: (message) => {
              signal.throwIfAborted();
              Object.assign(session.state, message, { state: "waiting" });
              publish(session);
            },
            prompt: (message) => {
              signal.throwIfAborted();
              session.state.prompt = message;
              session.state.state = "waiting";

              session.state.message = session.state.url
                ? session.state.message
                : message;

              publish(session);

              return new Promise<string>((resolve, reject) => {
                const abort = () => {
                  session.pendingReply = undefined;
                  reject(signal.reason);
                };

                signal.addEventListener("abort", abort, { once: true });

                session.pendingReply = {
                  resolve(value) {
                    signal.removeEventListener("abort", abort);
                    session.pendingReply = undefined;

                    session.state.prompt = undefined;
                    session.state.state = "working";
                    session.state.message = "Completing login…";
                    publish(session);
                    resolve(value);
                  },

                  reject(error) {
                    signal.removeEventListener("abort", abort);
                    session.pendingReply = undefined;
                    reject(error);
                  },
                };
              });
            },
          },
          signal,
        );

        await access.save(provider, credential, signal);

        session.state = {
          id,
          provider,
          method,
          state: "connected",
          message: "Credentials saved.",
        };

        connected();
      } catch (error) {
        let message = error instanceof Error ? error.message : "Login failed";

        if (signal.aborted) {
          message = "Login cancelled or expired.";
        }

        session.state = {
          id,
          provider,
          method,
          state: signal.aborted ? "cancelled" : "failed",
          message,
        };
      } finally {
        controller.abort();

        session.pendingReply?.reject(
          new DOMException("Login ended", "AbortError"),
        );

        session.pendingReply = undefined;
        publish(session);
      }
    })();

    session.done = done;
    scope.task(() => done);

    return { id };
  }

  return {
    login,
    cancel,
    list: () => [...sessions.values()].map((session) => session.state),

    async cancelProvider(provider: string) {
      const pending = active(provider);

      if (pending) {
        await cancel(pending.state.id);
      }
    },

    url(id: string) {
      const session = sessions.get(id);

      if (session?.state.state !== "waiting" || !session.state.url) {
        throw new Error("This login has no sign-in page to open");
      }

      return session.state.url;
    },

    reply(id: string, value: string) {
      const session = sessions.get(id);

      if (!session?.pendingReply) {
        throw new Error("This login is not waiting for input");
      }

      session.pendingReply.resolve(value);
    },
  };
}
