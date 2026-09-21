import { Show } from "solid-js";
import type { LoginState } from "@fathom/credentials/contract";
import { Button, Icon, InlineNotice } from "@fathom/sdk/ui";
import { LoginReplyForm } from "./LoginReplyForm.tsx";

export function LoginStatus(props: {
  login: LoginState;
  busy: boolean;
  onReply: (value: string) => void;
  onCancel: () => void;
  onOpen: () => void;
}) {
  const waiting = () => props.login.state === "waiting";

  return (
    <div class="mt-4 grid gap-3">
      <InlineNotice>{props.login.message}</InlineNotice>
      <Show when={props.login.code && waiting()}>
        <div
          class="my-6 flex items-center gap-4 rounded-control border border-control-line bg-canvas px-4 py-3"
          aria-label="Device sign-in code"
        >
          <code class="select-all font-mono text-2xl tracking-wide">
            {props.login.code}
          </code>
        </div>
      </Show>
      <Show when={props.login.url && waiting()}>
        <div>
          <Button variant="primary" onClick={() => props.onOpen()}>
            <Icon name="arrow-square-out" /> Open sign-in page
          </Button>
        </div>
      </Show>
      <Show when={waiting() && props.login.prompt} keyed>
        {(prompt) => (
          <LoginReplyForm
            prompt={prompt}
            method={props.login.method}
            busy={props.busy}
            onReply={(value) => props.onReply(value)}
          />
        )}
      </Show>
      <Show when={waiting() || props.login.state === "working"}>
        <div>
          <Button
            variant="quiet"
            disabled={props.busy}
            onClick={() => props.onCancel()}
          >
            Cancel login
          </Button>
        </div>
      </Show>
    </div>
  );
}
