import "./LoginReplyForm.css";

export function LoginReplyForm(props: {
  prompt: string;
  method: string;
  busy: boolean;
  onReply: (value: string) => void;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();

        const form = event.currentTarget;
        props.onReply(String(new FormData(form).get("reply") ?? ""));
        form.reset();
      }}
    >
      <label>
        {props.prompt}
        <input
          name="reply"
          type="password"
          autocomplete="off"
          required
          placeholder={
            props.method === "api-key"
              ? "Paste API key"
              : "Paste callback URL or code"
          }
        />
      </label>
      <button type="submit" class="primary" disabled={props.busy}>
        Continue
      </button>
    </form>
  );
}
