import type { FileRange } from "../../sdk/editor.ts";
import { artifactsOnBranch } from "../../sdk/artifacts.ts";
import { createTranscriptScroll } from "./transcript-scroll.ts";
import { messageLink } from "../../sdk/message-link.ts";
import type { AssistantMessage } from "@earendil-works/pi-ai";

import type { Entry, SessionState } from "../../sdk/session.ts";

import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";

import type { UIHost } from "../host.ts";
import { EntryContent, matchingEntryRenderer } from "./plugin-slot.tsx";
import { ToolGroup } from "./tool-group.tsx";
import {
  activityOnly,
  TranscriptActivity,
  transcriptSegments,
} from "./transcript-activity.tsx";
import { EditMessage } from "./edit-message.tsx";
import { MessageActions } from "./message-actions.tsx";
import { MessageCard } from "./message-card.tsx";
import { MessageBody } from "./message-body.tsx";
import { CompactionNotice } from "./compaction-notice.tsx";
import { Icon } from "./icon.tsx";
import { Button, EmptyState } from "./primitives.tsx";

function textOf(entry: Entry) {
  const content = entry.message?.content;
  return typeof content === "string"
    ? content
    : content?.filter((block) => block.type === "text").map((block) =>
      block.text
    ).join("\n") ?? "";
}

export function Transcript(
  props: {
    host: UIHost;
    bottomPadding: number;
    projectId: string;
    state?: SessionState;
    live?: { entryId: string; message: AssistantMessage };
    detailed: boolean;
    openArtifact(id: string): void;
    openFile(path: string, range?: FileRange): void;
    openDiff(path: string): void;
    active: boolean;
    focus?: { entryId: string; sessionId: string; request: number };
    rewind(entry: Entry): void;
    retry(entry: Entry): Promise<void>;
    resend(entry: Entry, text: string): Promise<void>;
  },
) {
  const artifactMap = createMemo(() =>
    new Map(
      artifactsOnBranch(props.state?.entries ?? []).map((
        artifact,
      ) => [artifact.id, artifact]),
    )
  );
  const [editing, setEditing] = createSignal<Entry>();
  let viewport!: HTMLDivElement;
  let content!: HTMLDivElement;
  let selectedSession: string | undefined;
  const { detached, follow, scroll, bottom, focus } = createTranscriptScroll({
    viewport: () => viewport,
    content: () => content,
    active: () => props.active,
    sessionId: () => props.state?.session.id,
  });
  const entries = () => {
    const stored = props.state?.entries ?? [];
    if (!props.live) return stored;
    const live = props.live;
    const found = stored.some((entry) => entry.id === live.entryId);
    return found
      ? stored.map((entry) =>
        entry.id === live.entryId ? { ...entry, message: live.message } : entry
      )
      : [
        ...stored,
        {
          id: live.entryId,
          kind: "message",
          message: live.message,
          status: "pending",
          sessionId: props.state?.session.id ?? "",
          parentId: null,
          createdAt: Date.now(),
        } as Entry,
      ];
  };
  const groups = createMemo(() => {
    const result: Entry[][] = [];
    for (const entry of entries()) {
      if (entry.message?.role === "toolResult") continue;
      const previous = result.at(-1);
      const last = previous?.at(-1);
      if (
        previous &&
        entry.message?.role === "assistant" &&
        last?.message?.role === "assistant" &&
        last.status === "completed" &&
        !["length", "error", "aborted"].includes(last.message.stopReason) &&
        last.message.model === entry.message.model &&
        last.message.provider === entry.message.provider
      ) previous.push(entry);
      else result.push([entry]);
    }
    return result;
  });
  const articles = new Map<string, HTMLElement>();
  let focusedRequest = 0;
  createEffect(() => {
    const target = props.focus;
    if (
      !target || !props.active || target.request === focusedRequest ||
      target.sessionId !== props.state?.session.id
    ) return;
    const frame = requestAnimationFrame(() => {
      if (
        props.focus !== target || !props.active ||
        target.sessionId !== props.state?.session.id
      ) return;
      const group = groups().find((items) =>
        items.some((entry) => entry.id === target.entryId)
      );
      const article = group && articles.get(group[0].id);
      if (article) {
        focusedRequest = target.request;
        focus(article);
      }
    });
    onCleanup(() => cancelAnimationFrame(frame));
  });
  createEffect(() => {
    const sessionId = props.state?.session.id;
    if (sessionId !== selectedSession) {
      selectedSession = sessionId;
      setEditing(undefined);
    }
    entries();
    props.state?.executions;
    props.state?.activity;
    follow();
  });
  return (
    <>
      <div class="relative col-start-1 row-span-2 row-start-1 flex min-h-0 flex-col">
        <div
          class="min-h-0 flex-1 overflow-y-auto"
          style={{ "padding-bottom": `${props.bottomPadding}px` }}
          ref={viewport}
          onScroll={scroll}
        >
          <div ref={content}>
            <Show
              when={entries().length}
              fallback={
                <EmptyState title="What are we building?">
                  <p>Explore an idea, fix a problem, or hand off a task.</p>
                  <p>Your workspace and conversation stay connected.</p>
                </EmptyState>
              }
            >
              <div class="mx-auto flex w-full max-w-transcript flex-col gap-8 px-6 py-8">
                <For each={groups().map((group) => group[0].id)}>
                  {(id) => {
                    onCleanup(() => articles.delete(id));
                    const group = () =>
                      groups().find((group) => group[0].id === id)!;
                    const [rendererRevision, setRendererRevision] =
                      createSignal(0);
                    onCleanup(props.host.subscribe(() =>
                      setRendererRevision((value) =>
                        value + 1
                      )
                    ));
                    const segments = createMemo(() => {
                      rendererRevision();
                      return transcriptSegments(group(), (entry) =>
                        !!matchingEntryRenderer(props.host, entry));
                    });
                    const entry = () =>
                      group()[0];
                    const executions = () => {
                      const ids = new Set(
                        group().map((item) =>
                          item.id
                        ),
                      );
                      return props.state?.executions.filter((run) =>
                        ids.has(run.entryId)
                      ) ?? [];
                    };
                    const working = () =>
                      group().some((item) => item.status === "pending") ||
                      executions().some((run) =>
                        run.status === "running" || run.status === "pending"
                      );
                    return (
                      <MessageCard
                        ref={(element) => articles.set(id, element)}
                        author={entry().source?.label ??
                          (entry().message?.role === "user"
                            ? "You"
                            : entry().message?.role === "assistant"
                            ? "Fathom"
                            : entry().custom?.type === "artifact"
                            ? "Artifact"
                            : entry().custom?.type === "artifact-approval"
                            ? "Approval"
                            : entry().custom?.type === "media"
                            ? "Media"
                            : entry().custom?.type ?? "Context")}
                        agent={entry().message?.role === "assistant"}
                        working={working()}
                        model={entry().message?.role === "assistant"
                          ? (entry().message as AssistantMessage).model
                          : undefined}
                        createdAt={entry().createdAt}
                      >
                        <div class="space-y-4">
                          <For
                            each={segments().map((items) => items[0].id)}
                          >
                            {(segmentId) => {
                              const segment = () =>
                                segments().find((items) =>
                                  items[0].id === segmentId
                                )!;
                              return (
                                <TranscriptActivity
                                  entries={segment()}
                                  executions={executions().filter((run) =>
                                    segment().some((item) =>
                                      item.id === run.entryId
                                    )
                                  )}
                                  detailed={props.detailed}
                                >
                                  <For each={segment().map((item) => item.id)}>
                                    {(id) => {
                                      const entry = () =>
                                        segment().find((item) =>
                                          item.id === id
                                        )!;
                                      return (
                                        <>
                                          <EntryContent
                                            host={props.host}
                                            entry={entry()}
                                          >
                                            <MessageBody
                                              artifact={artifactMap().get(
                                                (entry().custom?.data as {
                                                  id?: string;
                                                })?.id ?? "",
                                              )}
                                              host={props.host}
                                              projectId={props.projectId}
                                              entry={entry()}
                                              detailed={props.detailed}
                                              openArtifact={props.openArtifact}
                                            />
                                          </EntryContent>
                                          <ToolGroup
                                            grouped={activityOnly(segment()[0])}
                                            openFile={props.openFile}
                                            openDiff={props.openDiff}
                                            executions={executions().filter((
                                              run,
                                            ) => run.entryId === id)}
                                            detailed={props.detailed}
                                          />
                                        </>
                                      );
                                    }}
                                  </For>
                                </TranscriptActivity>
                              );
                            }}
                          </For>
                        </div>
                        <MessageActions
                          link={messageLink({
                            projectId: props.projectId,
                            sessionId: props.state!.session.id,
                            entryId: entry().id,
                          })}
                          text={group().map(textOf).filter(Boolean).join(
                            "\n\n",
                          )}
                          disabled={working() ||
                            ["running", "approval", "retry_waiting"].includes(
                              props.state?.session.status ?? "",
                            )}
                          edit={entry().message?.role === "user" &&
                              !entry().source
                            ? () => setEditing(entry())
                            : undefined}
                          retry={entry().message?.role === "assistant"
                            ? () => props.retry(entry())
                            : undefined}
                          branch={["user", "assistant"].includes(
                              entry().message?.role ?? "",
                            )
                            ? () => props.rewind(group().at(-1)!)
                            : undefined}
                        />
                      </MessageCard>
                    );
                  }}
                </For>
                <Show
                  when={props.state?.activity?.label === "Compacting context"}
                >
                  <CompactionNotice pending />
                </Show>
              </div>
            </Show>
          </div>
        </div>
      </div>
      <Show when={detached()}>
        <div class="z-10 col-start-1 row-start-1 mb-3 justify-self-center self-end rounded-control bg-surface">
          <Button variant="secondary" onClick={bottom}>
            <Icon name="arrow-down" /> Jump to latest
          </Button>
        </div>
      </Show>
      <Show when={editing()}>
        {(entry) => (
          <EditMessage
            text={textOf(entry())}
            submit={(text) => props.resend(entry(), text)}
            close={() => setEditing(undefined)}
          />
        )}
      </Show>
    </>
  );
}
