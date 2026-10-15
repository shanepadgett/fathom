import type { SetupFinding, WorkspaceFolder } from "../../models/workspace.ts";

import { html, nothing, type TemplateResult } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import { button } from "../../primitives/button.ts";
import { icon, type IconName } from "../../primitives/icon.ts";

type SetupStep = "folders" | "detect" | "save";

const steps: { id: SetupStep; label: string; detail: string }[] = [
  { id: "folders", label: "Folders", detail: "What belongs together" },
  { id: "detect", label: "Run together", detail: "Services, checks, rules" },
  { id: "save", label: "Save", detail: "Where the file lives" },
];

const findingGroups: {
  kind: SetupFinding["kind"];
  label: string;
  icon: IconName;
}[] = [
  { kind: "service", label: "Services", icon: "terminal-window" },
  { kind: "link", label: "Connections", icon: "link" },
  { kind: "check", label: "Checks", icon: "flask" },
  { kind: "instructions", label: "Instructions", icon: "file-text" },
];

const field = (label: string, value: TemplateResult | string) =>
  html`
    <label class="block">
      <span class="mb-1.5 block text-xs text-muted">${label}</span>
      <span
        class="flex h-10 items-center rounded-md border border-control-line bg-canvas px-3 text-sm"
      >${value}</span>
    </label>
  `;

const stepper = (current: SetupStep) => {
  const currentIndex = steps.findIndex((step) => step.id === current);
  return html`
    <nav aria-label="Setup steps"
      class="flex w-60 shrink-0 flex-col gap-1 border-r border-line bg-surface p-4">
      <p class="mb-3 px-2 text-sm font-medium">New workspace</p>
      <ol class="flex flex-col gap-1">
        ${steps.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return html`
            <li
              aria-current=${active ? "step" : nothing}
              class="flex items-start gap-3 rounded-control px-2 py-2 ${active
                ? "bg-canvas"
                : ""}"
            >
              <span
                class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-micro ${active
                  ? "border-action text-action"
                  : done
                  ? "border-action bg-action text-on-action"
                  : "border-control-line text-muted"}"
              >${done ? icon("check", "small") : index + 1}</span>
              <span>
                <span class="block text-sm ${active
                  ? "text-ink"
                  : "text-muted"}">${step
                  .label}</span>
                <span class="block text-xs text-muted">${step.detail}</span>
              </span>
            </li>
          `;
        })}
      </ol>
      <div class="mt-auto rounded-md border border-line p-3 text-xs text-muted">
        <p
          class="mb-2 flex items-center gap-1.5 text-ink">${icon(
            "sparkle",
          )}Prefer to describe it?</p>
        <p>Ask the agent to set the workspace up from a conversation instead.</p>
      </div>
    </nav>
  `;
};

const folderRow = (folder: WorkspaceFolder) =>
  html`
    <div class="flex items-center gap-3 px-3 py-2.5">
      <span class="text-muted">${icon("dots-six-vertical")}</span>
      <span
        class="w-24 shrink-0 rounded-control border border-control-line bg-canvas px-2 py-1 font-mono text-xs"
      >${folder.name}</span>
      <div class="min-w-0 flex-1">
        <p class="truncate font-mono text-xs" title=${folder.path}>${folder
          .path}</p>
        <p class="mt-0.5 flex items-center gap-1.5 text-micro text-muted">
          ${folder.stack}<span>·</span>${icon("git-branch", "small")}main
        </p>
      </div>
      <span
        class="flex shrink-0 items-center gap-1 rounded-control border border-line px-2 py-1 text-xs ${folder
            .access === "read"
          ? "text-muted"
          : ""}"
      >${folder.access === "read"
        ? icon("lock-simple", "small")
        : nothing}${folder
          .access === "read"
        ? "Read only"
        : "Can edit"}${icon("caret-down", "small")}</span>
      <button type="button" aria-label="Remove ${folder.name}"
        class="flex h-7 w-7 items-center justify-center rounded-control text-muted hover:bg-surface hover:text-ink">${icon(
          "x",
          "small",
        )}</button>
    </div>
  `;

const foldersStep = (name: string, folders: WorkspaceFolder[]) =>
  html`
    <h1
      class="text-2xl font-medium tracking-tight">Which folders belong together?</h1>
    <p class="mt-1 text-sm text-muted">
      Agents in this workspace can read every folder, edit the ones you allow,
      and run them side by side.
    </p>
    <div class="mt-8 flex flex-col gap-6">
      ${field("Name", name)}
      <div>
        <span class="mb-1.5 block text-xs text-muted">Folders · the short name is
          how you and agents refer to each one</span>
        <div class="divide-y divide-line rounded-md border border-line">
          ${folders.map(folderRow)}
          <div class="flex items-center gap-2 p-2">
            ${button({
              label: "Add folder",
              content: html`${icon("folder-plus")}Add folder`,
              variant: "quiet",
              size: "compact",
            })}
            <span class="text-muted">·</span>
            ${button({
              label: "Clone repository",
              content: html`${icon("cloud-arrow-down")}Clone repository`,
              variant: "quiet",
              size: "compact",
            })}
            <span class="ml-auto pr-2 text-xs text-muted">or drop folders here</span>
          </div>
        </div>
      </div>
      <p class="flex gap-2 rounded-md bg-surface px-3 py-2.5 text-xs text-muted">
        <span class="text-ink">${icon("folders")}</span>
        <span>Folders can live anywhere. infra is outside ~/dev/harbor, so the
          file stores it as ../platform/harbor-infra.</span>
      </p>
    </div>
  `;

const findingRow = (finding: SetupFinding) =>
  html`
    <div class="flex items-start gap-3 px-3 py-2.5">
      <span class="mt-0.5 ${finding.accepted
        ? "text-action"
        : "text-muted"}">${icon(
          finding.accepted ? "check-square" : "square",
          "large",
        )}</span>
      <div class="min-w-0 flex-1">
        <p class="text-sm ${finding.accepted ? "" : "text-muted"}">${finding
          .title}</p>
        <p class="mt-0.5 truncate font-mono text-xs text-muted">${finding
          .detail}</p>
      </div>
      <span class="flex shrink-0 items-center gap-1 pt-0.5 text-micro text-muted"
        title="Found in ${finding.source}">${icon(
          "file-code",
          "small",
        )}${finding
          .source}</span>
      <button type="button" aria-label="Edit ${finding.title}"
        class="flex h-6 w-6 shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface hover:text-ink">${icon(
          "pencil-simple",
          "small",
        )}</button>
    </div>
  `;

const serviceNode = (name: string, port: string, folder: string) =>
  html`
    <div class="rounded-md border border-line bg-canvas px-3 py-2">
      <p
        class="text-sm font-medium">${name} <span class="font-mono text-xs font-normal text-muted">${port}</span></p>
      <p class="text-micro text-muted">in ${folder}</p>
    </div>
  `;

const serviceEdge = (label: string) =>
  html`
    <div
      class="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-micro text-muted">
      <span class="truncate font-mono">${label}</span>
      <span
        class="flex w-full items-center"><span class="h-px flex-1 bg-control-line"></span>${icon(
          "caret-right",
          "small",
        )}</span>
    </div>
  `;

const detectStep = (findings: SetupFinding[]) =>
  html`
    <h1
      class="text-2xl font-medium tracking-tight">How do these folders run together?</h1>
    <p class="mt-1 text-sm text-muted">
      Fathom read the folders and found these. Checked items go into the
      workspace file; agents use them to start services and run checks.
    </p>
    <p class="mt-4 flex items-center gap-2 text-xs text-action">
      ${icon("sparkle")}Read 4 folders in 9s · ${findings.length} findings ·
      unchecked items stay out of the file
    </p>

    <div class="mt-6 flex items-center gap-2 rounded-md bg-surface p-4">
      ${serviceNode("db", ":5432", "infra")}${serviceEdge(
        "DATABASE_URL",
      )}${serviceNode("api", ":4000", "api")}${serviceEdge(
        "VITE_API_URL",
      )}${serviceNode("web", ":5173", "web")}
    </div>

    <div class="mt-6 flex flex-col gap-5">
      ${findingGroups.map((group) => {
        const items = findings.filter((finding) => finding.kind === group.kind);
        return items.length
          ? html`
            <section aria-label=${group.label}>
              <h2 class="mb-2 flex items-center gap-1.5 text-xs text-muted">
                ${icon(group.icon, "small")}${group.label}
              </h2>
              <div class="divide-y divide-line rounded-md border border-line">
                ${items.map(findingRow)}
              </div>
            </section>
          `
          : nothing;
      })}
      <div
        class="flex h-10 items-center gap-2 rounded-md border border-control-line px-3 text-sm text-muted"
      >
        ${icon("sparkle")}Ask Fathom to change something, such as “run api with
        iex -S mix phx.server”
      </div>
    </div>
  `;

const saveChoices = [
  {
    label: "Next to the folders",
    path: "~/dev/harbor/harbor.fathom",
    detail:
      "Paths are relative, so anyone with the same layout can open it. Commit it to a shared repository to share it.",
  },
  {
    label: "Inside one of the folders",
    path: "~/dev/harbor/harbor-api/.fathom/harbor.fathom",
    detail: "Your team gets it with the api repository.",
  },
  {
    label: "Only in Fathom",
    path: "Fathom settings on this Mac",
    detail: "Nothing is written to your folders. You can export a file later.",
  },
];

const saveStep = () =>
  html`
    <h1
      class="text-2xl font-medium tracking-tight">Where should the workspace file live?</h1>
    <p class="mt-1 text-sm text-muted">
      The file is the workspace. Open it from any tab, or double-click it to
      open Fathom.
    </p>
    <div class="mt-8 grid gap-2" role="radiogroup" aria-label="Save location">
      ${saveChoices.map((choice, index) =>
        html`
          <div
            role="radio"
            aria-checked=${index === 0}
            class="flex gap-3 rounded-md border px-4 py-3 ${index === 0
              ? "border-action bg-action/5"
              : "border-line"}"
          >
            <span
              class="mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${index ===
                  0
                ? "border-action"
                : "border-control-line"}"
            >${index === 0
              ? html`<span class="h-1.5 w-1.5 rounded-full bg-action"></span>`
              : nothing}</span>
            <div class="min-w-0">
              <p class="text-sm">${choice.label}</p>
              <p class="mt-0.5 truncate font-mono text-xs">${choice.path}</p>
              <p class="mt-1 text-xs text-muted">${choice.detail}</p>
            </div>
          </div>
        `
      )}
    </div>
    <div
      class="mt-6 grid grid-cols-4 divide-x divide-line rounded-md border border-line text-center">
      ${[
        ["4", "folders"],
        ["3", "services"],
        ["2", "checks"],
        ["2", "instruction files"],
      ].map(([count, label]) =>
        html`
          <div class="px-3 py-3">
            <p class="text-xl">${count}</p>
            <p class="text-xs text-muted">${label}</p>
          </div>
        `
      )}
    </div>
    <p class="mt-6 flex items-center gap-2 text-sm">
      <span class="text-action">${icon("check-square", "large")}</span>Open it
      in this tab and start a session
    </p>
  `;

/** Guided setup that turns a new tab into a saved workspace. */
export class WorkspaceSetupElement extends DesignElement {
  static override properties = {
    step: { type: String },
    name: { type: String },
    folders: { attribute: false },
    findings: { attribute: false },
  };

  declare step: SetupStep;
  declare name: string;
  declare folders: WorkspaceFolder[];
  declare findings: SetupFinding[];

  constructor() {
    super();
    this.step = "folders";
    this.name = "";
    this.folders = [];
    this.findings = [];
  }

  override render() {
    const { step } = this;
    const next = step === "folders"
      ? "Read folders"
      : step === "detect"
      ? "Continue"
      : "Create workspace";
    return html`
      ${stepper(step)}
      <main class="flex min-w-0 flex-1 flex-col bg-canvas">
        <div class="min-h-0 flex-1 overflow-y-auto">
          <div class="mx-auto max-w-transcript px-8 py-10">
            ${step === "folders"
              ? foldersStep(this.name, this.folders)
              : step === "detect"
              ? detectStep(this.findings)
              : saveStep()}
          </div>
        </div>
        <footer
          class="flex shrink-0 items-center justify-between border-t border-line px-8 py-3">
          ${button({
            label: step === "folders" ? "Cancel" : "Back",
            variant: "quiet",
            size: "compact",
          })}
          ${button({
            label: next,
            content: html`${next}${icon("arrow-right")}`,
            variant: "primary",
            size: "compact",
          })}
        </footer>
      </main>
    `;
  }
}

customElements.define("workspace-setup", WorkspaceSetupElement);
