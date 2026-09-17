import type { Artifact } from "../../sdk/artifacts.ts";
import type { MediaAsset } from "../../sdk/media.ts";
import type { Entry } from "../../sdk/session.ts";
import type { UIHost } from "../host.ts";

import { For, Index, Match, Show, Switch } from "solid-js";

import { AnnotationSummary } from "./annotation-summary.tsx";
import { ArtifactCard } from "./artifact-card.tsx";
import { CompactionNotice } from "./compaction-notice.tsx";
import { Disclosure } from "./disclosure.tsx";
import { Markdown } from "./markdown.tsx";
import { MediaPreview } from "./media-preview.tsx";
import { MessagePreview } from "./message-preview.tsx";
import { ResponseStatus } from "./response-status.tsx";

function ThinkingBlock(props: { text: string; open: boolean }) {
  return (
    <Show when={props.text.trim()}>
      <Disclosure open={props.open} label={<span>Thinking</span>}>
        <Markdown text={props.text} />
      </Disclosure>
    </Show>
  );
}

export function MessageBody(props: {
  entry: Entry;
  artifact?: Artifact;
  detailed: boolean;
  projectId: string;
  host: UIHost;
  openArtifact(id: string): void;
}) {
  const blocks = () => {
    const content = props.entry.message?.content;
    return typeof content === "string"
      ? [{ type: "text" as const, text: content }]
      : (content ?? []);
  };
  const media = (asset: MediaAsset) => (
    <MediaPreview
      asset={asset}
      url={`/media/${encodeURIComponent(props.projectId)}/${encodeURIComponent(
        props.entry.sessionId,
      )}/${encodeURIComponent(asset.id)}`}
      save={async (path) => {
        await props.host.request("media.materialize", {
          projectId: props.projectId,
          sessionId: props.entry.sessionId,
          id: asset.id,
          path,
        });
      }}
    />
  );
  const attachedMedia = () =>
    props.entry.attachments?.filter((item) => item.type === "media") ?? [];
  const annotationCount = () =>
    props.entry.attachments?.reduce((count, item) => {
      const ids =
        item.type === "artifact-feedback" || item.type === "browser-feedback"
          ? (item.data as { ids?: unknown })?.ids
          : undefined;
      return (
        count + (Array.isArray(ids) ? new Set(ids.filter((id) => typeof id === "string")).size : 0)
      );
    }, 0) ?? 0;
  const artifact = () => props.artifact;
  return (
    <div class="space-y-4">
      <Show when={attachedMedia().length}>
        <div class="mb-3 flex flex-wrap gap-3">
          <For each={attachedMedia()}>{(item) => media(item.data as MediaAsset)}</For>
        </div>
      </Show>
      <AnnotationSummary count={annotationCount()} />
      <MessagePreview collapsible={props.entry.message?.role === "user"}>
        <Index each={blocks()}>
          {(block) => (
            <Switch>
              <Match when={block().type === "text"}>
                <Markdown text={(block() as { text: string }).text} />
              </Match>
              <Match when={block().type === "thinking"}>
                <Show when={!(block() as { redacted?: boolean }).redacted}>
                  <ThinkingBlock
                    text={(block() as { thinking: string }).thinking}
                    open={props.entry.status === "pending" || props.detailed}
                  />
                </Show>
              </Match>
            </Switch>
          )}
        </Index>
      </MessagePreview>
      <ResponseStatus entry={props.entry} />
      <Show when={props.entry.custom}>
        <Switch fallback={<pre>{JSON.stringify(props.entry.custom?.data, null, 2)}</pre>}>
          <Match when={props.entry.custom?.type === "compaction"}>
            <CompactionNotice data={props.entry.custom?.data} detailed={props.detailed} />
          </Match>
          <Match when={props.entry.custom?.type === "media"}>
            {media(props.entry.custom!.data as MediaAsset)}
          </Match>
          <Match when={props.entry.custom?.type === "artifact" && artifact()}>
            <Show when={artifact()}>
              {(value) => (
                <ArtifactCard
                  approve={() =>
                    props.host.request("artifact.approve", {
                      projectId: props.projectId,
                      sessionId: props.host.session()?.session.id,
                      id: value().id,
                    })
                  }
                  artifact={value()}
                  open={() => props.openArtifact(value().id)}
                />
              )}
            </Show>
          </Match>
          <Match when={props.entry.custom?.type === "artifact-approval"}>
            <p class="text-sm text-muted">
              Artifact approved. The continuation was sent to this conversation.
            </p>
          </Match>
        </Switch>
      </Show>
    </div>
  );
}
