import type { ResourceKind, ResourceReport } from "../../sdk/resources.ts";
import type { Transport } from "../transport.ts";

import { createResource, createSignal, For, Show } from "solid-js";

import { Meter } from "./meter.tsx";
import { Button } from "./primitives.tsx";
import { SnapshotCleanup } from "./snapshot-cleanup.tsx";

const labels: Record<ResourceKind, string> = {
  snapshots: "Run Git snapshots",
  artifacts: "Artifacts",
  media: "Media cache",
  databases: "SQLite databases",
  other: "Other Fathom files",
};

function size(bytes: number) {
  const unit = bytes < 1024 ? 0 : Math.min(4, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** unit).toLocaleString(undefined, {
    maximumFractionDigits: unit ? 1 : 0,
  })} ${["B", "KiB", "MiB", "GiB", "TiB"][unit]}`;
}

export function StorageSettings(props: { transport: Transport }) {
  const projectId = props.transport.projectId;
  const [report, { refetch }] = createResource(() =>
    props.transport.request<ResourceReport>("resources.scan", { projectId }),
  );
  const [failure, setFailure] = createSignal<{ kind: ResourceKind; message: string }>();
  const [opening, setOpening] = createSignal<ResourceKind>();
  async function open(kind: ResourceKind) {
    if (opening()) return;
    setOpening(kind);
    setFailure(undefined);
    try {
      await props.transport.request("resources.open", { projectId, kind });
    } catch (error) {
      setFailure({
        kind,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setOpening(undefined);
    }
  }
  return (
    <div class="space-y-4">
      <div>
        <h3>Storage on this machine</h3>
        <p class="muted">Fathom files across all projects in this profile.</p>
      </div>
      <Show when={report.error}>
        <p role="alert" class="text-sm text-danger">
          Could not inspect storage. Refresh to try again.
        </p>
      </Show>
      <Show when={report.loading}>
        <p role="status" class="text-sm text-muted">
          Scanning storage…
        </p>
      </Show>
      <Show when={!report.error && report()}>
        {(value) => (
          <>
            <p class="text-ink">
              {value().partial ? "At least " : ""}
              {size(value().totalBytes)} in files
            </p>
            <dl class="flex flex-col gap-4">
              <For each={value().resources}>
                {(item) => (
                  <div class="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2">
                    <dt>{labels[item.kind]}</dt>
                    <dd>{size(item.bytes)}</dd>
                    <dd class="col-span-2 flex flex-wrap items-center justify-between gap-3">
                      <Meter
                        value={item.bytes}
                        max={value().totalBytes}
                        label={`${labels[item.kind]} share of storage`}
                      />
                      <span class="text-sm text-muted">{item.files.toLocaleString()} files</span>
                      <Button disabled={!!opening()} onClick={() => void open(item.kind)}>
                        {opening() === item.kind
                          ? "Opening…"
                          : item.kind === "artifacts"
                            ? "Open artifacts folder"
                            : item.kind === "other"
                              ? "Open Fathom folder"
                              : "Open projects folder"}
                      </Button>
                    </dd>
                    <Show when={failure()?.kind === item.kind}>
                      <dd role="alert" class="col-span-2 text-sm text-danger">
                        {failure()?.message}
                      </dd>
                    </Show>
                  </div>
                )}
              </For>
            </dl>
            <Show when={value().partial}>
              <p role="status" class="text-sm text-warning">
                This scan is incomplete. It reached a scan limit or an unreadable path.
              </p>
            </Show>
            <Show when={value().skipped}>
              <p class="text-sm text-muted">
                {value().skipped} symbolic links or unreadable paths skipped.
              </p>
            </Show>
            <p class="text-xs text-muted">
              File sizes can differ from allocated disk space. Files may change during scanning.
              Updated {new Date(value().scannedAt).toLocaleTimeString()}.
            </p>
          </>
        )}
      </Show>
      <Button
        variant="secondary"
        disabled={report.loading}
        onClick={() => void Promise.resolve(refetch()).catch(() => {})}
      >
        {report.loading ? "Scanning…" : "Refresh storage"}
      </Button>
      <SnapshotCleanup
        transport={props.transport}
        onCleaned={() => void Promise.resolve(refetch()).catch(() => {})}
      />
    </div>
  );
}
