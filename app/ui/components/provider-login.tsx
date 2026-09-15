import type { LoginFlow } from "../../sdk/auth.ts";
import { ProviderAuthEvent } from "./provider-auth-event.tsx";
import {
  createComputed,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";

import { Button, Field } from "./primitives.tsx";

export function ProviderLogin(props: {
  flow: LoginFlow;
  providerName: string;
  busy: boolean;
  act(method: string, params: Record<string, unknown>): Promise<boolean>;
}) {
  const [answer, setAnswer] = createSignal("");
  const [pending, setPending] = createSignal(false);
  const [failure, setFailure] = createSignal("");
  const prompt = () =>
    props.flow.status === "pending" ? props.flow.prompt : undefined;
  const key = createMemo(() =>
    JSON.stringify([props.flow.id, props.flow.status, prompt()?.id])
  );
  const disabled = () => props.busy || pending();
  let generation = 0;

  createComputed(() => {
    key();
    generation++;
    setAnswer("");
    setFailure("");
  });
  onCleanup(() => {
    generation++;
    setAnswer("");
  });

  const act = async (method: string) => {
    if (disabled() || props.flow.status !== "pending") return;
    const currentPrompt = prompt();
    if (method === "provider.answer" && (!currentPrompt || !answer())) return;
    const currentGeneration = generation;
    const currentKey = key();
    const params = method === "provider.answer"
      ? { id: props.flow.id, promptId: currentPrompt!.id, answer: answer() }
      : { id: props.flow.id };
    setPending(true);
    setFailure("");
    try {
      const accepted = await props.act(method, params);
      if (
        accepted && generation === currentGeneration && key() === currentKey
      ) {
        setAnswer("");
      }
    } catch {
      if (generation === currentGeneration && key() === currentKey) {
        setFailure("Sign-in request failed. Please try again.");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div class="mt-4 rounded-control border border-line p-4">
      <h4>
        {props.providerName} · {props.flow.status === "pending"
          ? "Signing in"
          : props.flow.status === "complete"
          ? "Connected"
          : props.flow.status === "error"
          ? "Sign-in failed"
          : "Cancelled"}
      </h4>
      <For each={props.flow.events}>
        {(event) => <ProviderAuthEvent event={event} />}
      </For>
      <Show when={prompt()}>
        {(currentPrompt) => (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void act("provider.answer");
            }}
          >
            <Field label={currentPrompt().message}>
              <Show
                when={currentPrompt().type === "select"}
                fallback={
                  <input
                    autofocus
                    type={currentPrompt().type === "secret"
                      ? "password"
                      : "text"}
                    autocomplete="off"
                    value={answer()}
                    readOnly={disabled()}
                    onInput={(event) => {
                      if (!disabled()) setAnswer(event.currentTarget.value);
                    }}
                    placeholder={(() => {
                      const value = currentPrompt();
                      return "placeholder" in value
                        ? value.placeholder
                        : undefined;
                    })()}
                  />
                }
              >
                <select
                  value={answer()}
                  disabled={disabled()}
                  onChange={(event) => {
                    if (!disabled()) setAnswer(event.currentTarget.value);
                  }}
                >
                  <option value="">Choose an option</option>
                  <For
                    each={(() => {
                      const value = currentPrompt();
                      return value.type === "select" ? value.options : [];
                    })()}
                  >
                    {(option) => (
                      <option value={option.id}>{option.label}</option>
                    )}
                  </For>
                </select>
              </Show>
            </Field>
            <Button
              variant="primary"
              disabled={!answer() || disabled()}
              type="submit"
            >
              Continue
            </Button>
          </form>
        )}
      </Show>
      <Show when={props.flow.error}>
        <p class="error">{props.flow.error}</p>
      </Show>
      <Show when={failure()}>
        <p class="error" role="alert">{failure()}</p>
      </Show>
      <Show when={props.flow.status === "pending"}>
        <Button
          disabled={disabled()}
          onClick={() => void act("provider.cancel")}
        >
          Cancel sign-in
        </Button>
      </Show>
    </div>
  );
}
