import { html } from "lit";

import { background } from "../fixtures/overlay-background.ts";
import "./button.ts";
import "./modal.ts";

export const modalExamples = [
  {
    name: "Open and close",
    markup: html`
      <ds-modal
        >${background}
        <ds-button><button type="button" data-open>Open modal</button></ds-button>
        <dialog aria-labelledby="modal-title" closedby="any">
          <h2 id="modal-title" class="text-2xl font-semibold tracking-tight">Ready to review</h2>
          <p class="mt-3 text-muted">
            Your changes are saved. The workspace stays visible behind this dialog.
          </p>
          <div class="mt-6 flex justify-end">
            <ds-button variant="secondary"
              ><button type="button" data-close autofocus>Close modal</button></ds-button
            >
          </div>
        </dialog>
      </ds-modal>
    `,
  },
];
