import { html } from "lit";

export const background = html`
  <div class="mb-6 border-b border-line pb-6">
    <p class="text-muted">Workspace / Fathom</p>
    <h3 class="mt-2 text-xl font-semibold">Session overview</h3>
    <p class="mt-2 text-muted">Review the latest changes before starting the next task.</p>
    <dl class="mt-4 grid grid-cols-2 gap-4">
      <div>
        <dt class="text-muted">Branch</dt>
        <dd class="font-mono">main</dd>
      </div>
      <div>
        <dt class="text-muted">Status</dt>
        <dd class="text-success">Ready for review</dd>
      </div>
    </dl>
  </div>
`;
