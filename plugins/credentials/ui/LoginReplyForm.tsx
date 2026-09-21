import { createUniqueId } from "solid-js";
import { Button, Field, Input } from "@fathom/sdk/ui";

export function LoginReplyForm(props: {
  prompt: string;
  method: string;
  busy: boolean;
  onReply: (value: string) => void;
}) {
  const id = createUniqueId();

  return (
    <form
      class="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        props.onReply(String(new FormData(form).get("reply") ?? ""));
        form.reset();
      }}
    >
      <Field id={id} label={props.prompt}>
        <Input
          id={id}
          name="reply"
          type="password"
          autocomplete="off"
          required
          disabled={props.busy}
          placeholder={
            props.method === "api-key"
              ? "Paste API key"
              : "Paste callback URL or code"
          }
        />
      </Field>
      <div>
        <Button type="submit" variant="primary" disabled={props.busy}>
          Continue
        </Button>
      </div>
    </form>
  );
}
