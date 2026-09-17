import { Field } from "./primitives.tsx";

export function CommentField(props: {
  value: string;
  change(value: string): void;
  input?: (element: HTMLTextAreaElement) => void;
  disabled?: boolean;
}) {
  return (
    <Field label="Comment">
      <textarea
        ref={props.input}
        rows={3}
        maxLength={4000}
        value={props.value}
        disabled={props.disabled}
        onInput={(event) => props.change(event.currentTarget.value)}
      />
    </Field>
  );
}
