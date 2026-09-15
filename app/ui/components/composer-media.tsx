import type { MediaAsset } from "../../sdk/media.ts";
import { For, Show } from "solid-js";
import { ImageThumbnail } from "./media-preview.tsx";
import { Button } from "./primitives.tsx";

export function ComposerMedia(props: {
  assets: MediaAsset[];
  projectId: string;
  sessionId: string;
  busy: boolean;
  remove(id: string): void;
}) {
  return (
    <Show when={props.assets.length}>
      <ul
        class="mb-3 flex max-h-48 flex-wrap gap-3 overflow-auto"
        aria-label="Draft attachments"
      >
        <For each={props.assets}>
          {(asset) => (
            <li class="min-w-0 max-w-48">
              <Show when={asset.mime.startsWith("image/")}>
                <ImageThumbnail
                  name={asset.name}
                  url={`/media/${encodeURIComponent(props.projectId)}/${
                    encodeURIComponent(props.sessionId)
                  }/${encodeURIComponent(asset.id)}?draft=1`}
                />
              </Show>
              <p class="truncate text-sm text-ink" title={asset.name}>
                {asset.name}
              </p>
              <Button
                disabled={props.busy}
                onClick={() => props.remove(asset.id)}
                aria-label={`Remove ${asset.name}`}
              >
                Remove
              </Button>
            </li>
          )}
        </For>
      </ul>
    </Show>
  );
}
