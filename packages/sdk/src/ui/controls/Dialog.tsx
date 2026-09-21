import { createEffect, createUniqueId, onCleanup, type JSX } from "solid-js";
import { IconButton } from "./IconButton.tsx";

/** Native modal: focus containment, Escape dismissal, and focus restoration. */
export function Dialog(props: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: JSX.Element;
}): JSX.Element {
  let dialog!: HTMLDialogElement;
  let returnFocus: HTMLElement | undefined;
  const id = createUniqueId();

  createEffect(() => {
    if (props.open && !dialog.open) {
      returnFocus =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : undefined;

      dialog.showModal();
    } else if (!props.open && dialog.open) {
      dialog.close();
      returnFocus?.focus();
    }
  });

  onCleanup(() => {
    dialog.close();
    returnFocus?.focus();
  });

  return (
    <dialog
      ref={(element) => {
        dialog = element;
      }}
      class="fathom-dialog"
      aria-labelledby={id}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          props.onClose();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        props.onClose();
      }}
      onClose={() => {
        // The browser may close a modal on its own; keep the owner in sync.
        if (props.open) {
          props.onClose();
        }
      }}
    >
      <div class="mb-4 flex items-center justify-between gap-4">
        <h2 id={id} class="type-title tracking-tight">
          {props.title}
        </h2>
        <IconButton
          icon="x"
          label="Close dialog"
          onClick={() => props.onClose()}
        />
      </div>
      {props.children}
    </dialog>
  );
}
