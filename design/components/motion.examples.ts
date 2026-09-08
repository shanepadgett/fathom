const background = `
  <div class="mb-6 border-b border-line pb-6">
    <p class="text-muted">Workspace / Fathom</p>
    <h3 class="mt-2 text-xl font-semibold">Session overview</h3>
    <p class="mt-2 text-muted">Review the latest changes before starting the next task.</p>
    <dl class="mt-4 grid grid-cols-2 gap-4">
      <div><dt class="text-muted">Branch</dt><dd class="font-mono">main</dd></div>
      <div><dt class="text-muted">Status</dt><dd class="text-success">Ready for review</dd></div>
    </dl>
  </div>`;

export const modalExamples = [{
  name: "Open and close",
  markup: `<ds-modal>${background}
    <ds-button><button type="button" data-open>Open modal</button></ds-button>
    <dialog aria-labelledby="modal-title" closedby="any">
      <h2 id="modal-title" class="text-2xl font-semibold tracking-tight">Ready to review</h2>
      <p class="mt-3 text-muted">Your changes are saved. The workspace stays visible behind this dialog.</p>
      <div class="mt-6 flex justify-end"><ds-button variant="secondary"><button type="button" data-close autofocus>Close modal</button></ds-button></div>
    </dialog>
  </ds-modal>`,
}];

export const drawerExamples = ["dimmed", "none"].map((backdrop) => ({
  name: backdrop === "none" ? "Without dimming" : "With dimming",
  markup: `<ds-drawer backdrop="${backdrop}">${background}
    <ds-button><button type="button" data-open>Open drawer</button></ds-button>
    <dialog aria-labelledby="drawer-title-${backdrop}" closedby="any">
      <header class="flex items-center justify-between gap-4">
        <h2 id="drawer-title-${backdrop}" class="text-2xl font-semibold tracking-tight">Session details</h2>
        <ds-button variant="quiet"><button type="button" data-close autofocus aria-label="Close drawer">✕</button></ds-button>
      </header>
      <p class="mt-3 text-muted">Extra context without leaving your workspace.</p>
      <dl class="mt-8 grid gap-6">
        <div><dt class="text-muted">Working directory</dt><dd class="font-mono">~/dev/fathom</dd></div>
        <div><dt class="text-muted">Branch</dt><dd class="font-mono">main</dd></div>
        <div><dt class="text-muted">Changes</dt><dd>3 files ready for review</dd></div>
      </dl>
    </dialog>
  </ds-drawer>`,
}));

drawerExamples.push({
  name: "Push content",
  markup: `<ds-drawer mode="push" class="border border-line rounded-lg">
    <div data-content class="p-4">
      ${background}
      <ds-button><button type="button" data-open aria-expanded="false" aria-controls="push-panel">Toggle drawer</button></ds-button>
      <label class="mt-6 block">Session name<input class="mt-2 block w-full rounded-control border border-line bg-canvas p-2" value="Review changes"></label>
    </div>
    <aside id="push-panel" class="border-l border-line" data-panel inert aria-labelledby="push-title">
      <div class="h-full bg-surface p-4 wrap-anywhere">
        <header class="flex flex-wrap items-center justify-between gap-3">
          <h2 id="push-title" class="text-xl font-semibold">Session details</h2>
          <ds-button variant="quiet"><button type="button" data-close aria-label="Close drawer">✕</button></ds-button>
        </header>
        <p class="mt-4 text-muted">The workspace stays usable. Try editing the session name while this panel is open.</p>
        <p class="mt-6">3 files ready for review</p>
      </div>
    </aside>
  </ds-drawer>`,
});

const items = `
  <details open><summary>Session context</summary><div><p>The current task, working directory, and branch stay with this session.</p></div></details>
  <details><summary>Changed files</summary><div><p>Review edits before keeping them. Each file shows the changes made during this session.</p></div></details>
  <details><summary>Tool permissions</summary><div><p>Choose which actions need approval before a tool can run.</p></div></details>`;

export const accordionExamples = [
  {
    name: "One open at a time",
    markup: `<ds-accordion>${items}</ds-accordion>`,
  },
  {
    name: "Multiple open",
    markup: `<ds-accordion multiple>${items}</ds-accordion>`,
  },
];
