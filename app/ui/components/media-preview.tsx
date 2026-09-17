import type { MediaAsset } from "../../sdk/media.ts";

import { createMemo, createSignal, Match, Show, Switch } from "solid-js";

import { copyImage } from "../image-clipboard.ts";
import { ExportFile } from "./export-file.tsx";
import { Button, LinkButton, Modal } from "./primitives.tsx";

export function MediaPreview(props: {
  asset: MediaAsset;
  url: string;
  save?(path: string): Promise<void>;
}) {
  const identity = createMemo(() => JSON.stringify([props.asset, props.url]));

  return (
    <Show when={identity()} keyed>
      {(_identity) => {
        const [error, setError] = createSignal(false);
        const [exporting, setExporting] = createSignal(false);
        const [saved, setSaved] = createSignal("");
        const [copying, setCopying] = createSignal(false);
        const [copied, setCopied] = createSignal(false);
        const [copyError, setCopyError] = createSignal("");
        async function copy() {
          if (copying()) return;
          setCopying(true);
          setCopied(false);
          setCopyError("");
          try {
            await copyImage(props.url);
            setCopied(true);
          } catch (error) {
            setCopyError(error instanceof Error ? error.message : String(error));
          } finally {
            setCopying(false);
          }
        }
        const failed = () => setError(true);

        return (
          <div class="min-w-0 max-w-full">
            <Switch>
              <Match when={props.asset.mime.startsWith("image/")}>
                <ImageThumbnail name={props.asset.name} url={props.url} />
              </Match>
              <Match when={props.asset.mime.startsWith("audio/")}>
                <audio
                  controls
                  preload="metadata"
                  class="max-w-full"
                  src={props.url}
                  aria-label={props.asset.name}
                  onError={failed}
                />
              </Match>
              <Match when={props.asset.mime.startsWith("video/")}>
                <video
                  controls
                  preload="metadata"
                  class="max-h-96 max-w-full rounded-lg"
                  src={props.url}
                  aria-label={props.asset.name}
                  onError={failed}
                />
              </Match>
            </Switch>
            <p class="break-words text-sm text-ink">{props.asset.name}</p>
            <p class="text-xs text-muted">{props.asset.bytes} bytes</p>
            <div
              class="mt-2 flex flex-wrap items-center gap-3"
              role="group"
              aria-label="Media actions"
            >
              <LinkButton
                href={`${props.url}${props.url.includes("?") ? "&" : "?"}download=1`}
                download={props.asset.name}
              >
                Download
              </LinkButton>
              <Show when={props.asset.mime.startsWith("image/")}>
                <Button
                  disabled={copying()}
                  onClick={() => void copy()}
                  title="Copy as PNG; animated images copy a still frame"
                >
                  {copying() ? "Copying…" : copied() ? "Copied image" : "Copy image"}
                </Button>
              </Show>
              <Show when={props.save}>
                <Button onClick={() => setExporting(true)}>Save to workspace</Button>
              </Show>
            </div>
            <Show when={copyError()}>
              <p role="alert" class="text-sm text-danger">
                {copyError()}
              </p>
            </Show>
            <Show when={saved()}>
              <p role="status" class="text-sm text-muted">
                Saved to {saved()}
              </p>
            </Show>
            <Show when={exporting()}>
              <ExportFile
                name={props.asset.name}
                close={() => setExporting(false)}
                save={async (path) => {
                  await props.save!(path);
                  setSaved(path);
                }}
              />
            </Show>
            <Show when={error()}>
              <p class="text-sm text-danger" role="alert">
                Could not load media.
              </p>
            </Show>
          </div>
        );
      }}
    </Show>
  );
}

export function ImageThumbnail(props: { name: string; url: string }) {
  const [preview, setPreview] = createSignal(false);
  const [error, setError] = createSignal(false);
  const failed = () => setError(true);
  return (
    <>
      <button
        type="button"
        class="h-24 w-24 overflow-hidden rounded-lg border border-control-line bg-surface"
        aria-label={`Preview ${props.name}`}
        aria-haspopup="dialog"
        title={props.name}
        onClick={() => setPreview(true)}
      >
        <img class="h-full w-full object-cover" src={props.url} alt={props.name} onError={failed} />
      </button>
      <Show when={error()}>
        <p role="alert" class="text-sm text-danger">
          Could not load image.
        </p>
      </Show>
      <Show when={preview()}>
        <Modal title={props.name} close={() => setPreview(false)} wide>
          <img
            class="max-h-[calc(70dvh-6rem)] w-full object-contain"
            src={props.url}
            alt={props.name}
            onError={failed}
          />
          <Show when={error()}>
            <p class="text-sm text-danger" role="alert">
              Could not load media.
            </p>
          </Show>
          <Button onClick={() => setPreview(false)}>Close preview</Button>
        </Modal>
      </Show>
    </>
  );
}
