import type { Artifact } from "../../sdk/artifacts.ts";

import { Show } from "solid-js";

import { ArtifactApproval } from "./artifact-approval.tsx";
import { Icon } from "./icon.tsx";
import { Button } from "./primitives.tsx";

export function ArtifactCard(props: {
  artifact: Artifact;
  open(): void;
  approve(): Promise<unknown>;
}) {
  return (
    <section
      class="space-y-3 rounded-lg border border-line bg-surface p-4"
      aria-label={props.artifact.title}
    >
      <div class="flex items-start gap-3">
        <Icon name="file-text" />
        <div class="min-w-0 flex-1">
          <h3 class="text-sm font-medium text-ink">{props.artifact.title}</h3>
          <p class="text-xs text-muted">
            {props.artifact.name} · {props.artifact.bytes.toLocaleString()} bytes
          </p>
        </div>
        <span class="text-xs text-muted">
          {props.artifact.status === "pending"
            ? "Pending review"
            : props.artifact.status === "approved"
              ? "Approved"
              : "Superseded"}
        </span>
      </div>
      <div class="flex flex-wrap items-start gap-3">
        <Button variant="secondary" onClick={props.open}>
          Open in viewer
        </Button>
        <Show when={props.artifact.mime === "text/markdown" && props.artifact.status === "pending"}>
          <ArtifactApproval approve={props.approve} />
        </Show>
      </div>
    </section>
  );
}
