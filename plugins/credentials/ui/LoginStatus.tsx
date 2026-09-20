import "./LoginStatus.css";
import { Show } from "solid-js";
import type { LoginState } from "@fathom/credentials/contract";
import { LoginReplyForm } from "./LoginReplyForm.tsx";

export function LoginStatus(props: {
  login: LoginState;
  busy: boolean;
  onReply: (value: string) => void;
  onCancel: () => void;
}) {
  return (
    <div class="login-status" role="status">
      <p>{props.login.message}</p>
      <Show when={props.login.url && props.login.state === "waiting"}>
        <a
          class="primary-link"
          href={props.login.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open sign-in page ↗
        </a>
      </Show>
      <Show when={props.login.code && props.login.state === "waiting"}>
        <div class="device-code">{props.login.code}</div>
      </Show>
      <Show when={props.login.prompt && props.login.state === "waiting"}>
        <LoginReplyForm
          prompt={props.login.prompt!}
          method={props.login.method}
          busy={props.busy}
          onReply={(value) => props.onReply(value)}
        />
      </Show>
      <Show
        when={
          props.login.state === "waiting" || props.login.state === "working"
        }
      >
        <button
          type="button"
          class="text-button"
          onClick={() => props.onCancel()}
        >
          Cancel login
        </button>
      </Show>
    </div>
  );
}
