import type { ModelChoice } from "../../sdk/models.ts";
import type { SessionState } from "../../sdk/session.ts";
import type { Transport } from "../transport.ts";

import { createEffect, createSignal, on, onCleanup, onMount, Show } from "solid-js";

import { sessionDrafts } from "../state/drafts.ts";
import { mediaDraft } from "../state/media-draft.ts";
import { ComposerFeedback } from "./composer-feedback.tsx";
import { ComposerMedia } from "./composer-media.tsx";
import { Icon } from "./icon.tsx";
import { ModelPicker } from "./model-picker.tsx";
import { Button } from "./primitives.tsx";
import { QueuedMessages } from "./queued-messages.tsx";

export function Composer(props: {
  transport: Transport;
  onHeight(height: number): void;
  openArtifact(id: string): void;
  state?: SessionState;
  models: ModelChoice[];
  send(text: string, mode?: "steer" | "follow_up", media?: string[]): Promise<void>;
  stop(): void;
  resume(): void;
  selectModel(value: string): void | Promise<void>;
  selectThinking(value: string): void | Promise<void>;
  settings(): void;
}) {
  let overlay!: HTMLDivElement;
  onMount(() => {
    const observer = new ResizeObserver(() => {
      props.onHeight(overlay.getBoundingClientRect().height);
    });
    observer.observe(overlay);
    onCleanup(() => observer.disconnect());
  });
  const drafts = sessionDrafts(props.transport);
  const updateDraft = drafts.update;
  const sessionId = () => props.state?.session.id ?? "";
  const text = () => drafts.text(sessionId());
  const setText = (value: string) => updateDraft(sessionId(), () => value);
  const media = mediaDraft(props.transport, sessionId);
  const [attaching, setAttaching] = createSignal(false);
  const [sending, setSending] = createSignal(false);
  const [attachmentError, setAttachmentError] = createSignal("");
  createEffect(
    on(sessionId, (id) => {
      setAttachmentError("");
      drafts.load(id, props.transport.projectId);
    }),
  );
  let files!: HTMLInputElement;
  async function attach(selected: FileList | File[] | null) {
    if (!selected) return;
    if (attaching() || sending() || media.busy()) {
      setAttachmentError("Wait for the current attachment or send to finish, then try again.");
      return;
    }
    const targetSession = sessionId();
    const projectId = props.transport.projectId;
    setAttaching(true);
    setAttachmentError("");
    try {
      const contexts: string[] = [];
      for (const file of Array.from(selected)) {
        if (/^(image|audio|video)\//.test(file.type)) {
          await media.upload(file, projectId, targetSession);
          continue;
        }
        if (file.size > 1024 * 1024) {
          throw new Error(`${file.name} exceeds the 1 MB text attachment limit.`);
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (bytes.includes(0)) {
          throw new Error(`${file.name} is a binary file. Text context is supported here.`);
        }
        const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        contexts.push(`Attached context: ${file.name}\n${content}`);
      }
      updateDraft(targetSession, (value) => [value, ...contexts].filter(Boolean).join("\n\n"));
    } catch (error) {
      if (sessionId() === targetSession) {
        setAttachmentError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      files.value = "";
      setAttaching(false);
    }
  }
  const running = () =>
    ["running", "retry_waiting", "approval"].includes(props.state?.session.status ?? "");
  const levels = () =>
    props.models.find(
      (model) =>
        model.provider === props.state?.session.provider && model.id === props.state?.session.model,
    )?.thinkingLevels ?? [];
  const ready = () =>
    !!(text().trim() || media.assets().length) &&
    !sending() &&
    !attaching() &&
    !media.busy() &&
    !media.error();
  async function send(mode?: "steer" | "follow_up") {
    if (!sessionId() || !ready()) return;
    const targetSession = sessionId(),
      submitted = text();
    setSending(true);
    try {
      await props.send(
        submitted.trim() ? submitted : "Please review the attached media.",
        mode,
        media.assets().map((asset) => asset.id),
      );
      await media.refresh();
      updateDraft(targetSession, (value) => (value === submitted ? "" : value));
    } catch {
      /* The workspace shows the failure; keep the draft for recovery. */
    } finally {
      setSending(false);
    }
  }
  return (
    <div
      ref={overlay}
      class="pointer-events-none relative col-start-1 row-start-2 pb-6 pt-12 before:absolute before:inset-y-0 before:left-0 before:right-6 before:overlay-glass before:composer-fade"
    >
      <div aria-hidden="true" class="absolute inset-y-0 left-0 right-6 composer-bottom-glass" />
      <div class="pointer-events-auto relative mx-auto w-full max-w-transcript px-6">
        <ComposerFeedback
          transport={props.transport}
          sessionId={sessionId()}
          openArtifact={props.openArtifact}
        />
        <QueuedMessages state={props.state} transport={props.transport} />
        <div data-component="composer" class="rounded-lg border border-line bg-surface p-4">
          <input
            ref={files}
            type="file"
            multiple
            class="hidden"
            onChange={(event) => void attach(event.currentTarget.files)}
          />
          <ComposerMedia
            assets={media.assets()}
            projectId={props.transport.projectId}
            sessionId={sessionId()}
            busy={attaching() || sending() || media.busy()}
            remove={(id) => void media.remove(id)}
          />
          <Show when={attachmentError() || drafts.error(sessionId()) || media.error()}>
            <p role="alert" class="mb-3 text-sm text-danger">
              {attachmentError() || drafts.error(sessionId()) || media.error()}
            </p>
          </Show>
          <Show when={media.error()}>
            <Button onClick={() => void media.refresh()}>Retry attachments</Button>
          </Show>
          <textarea
            class="block min-h-12 w-full resize-y border-0 bg-transparent p-0 text-base text-ink placeholder:text-muted focus:outline-none"
            rows={2}
            aria-label="Message Fathom"
            placeholder={
              running()
                ? "Add a direction or queue a follow-up…"
                : "Ask Fathom to build, explore, or fix something…"
            }
            value={text()}
            onInput={(event) => setText(event.currentTarget.value)}
            onPaste={(event) => {
              const pasted = Array.from(event.clipboardData?.files ?? []);
              if (!pasted.length) return;
              event.preventDefault();
              void attach(pasted);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <div class="flex flex-wrap items-center justify-between gap-3 text-sm">
            <Button
              disabled={attaching() || sending() || media.busy() || !sessionId()}
              onClick={() => files.click()}
            >
              <Icon name="plus" />
              {attaching() ? "Attaching…" : "Attach context"}
            </Button>
            <span class="ml-auto flex flex-wrap items-center gap-3">
              <ModelPicker
                contextKey={props.state?.session.id}
                models={props.models}
                provider={props.state?.session.provider ?? ""}
                model={props.state?.session.model ?? ""}
                thinking={props.state?.session.thinking}
                thinkingLevels={levels()}
                selectThinking={props.selectThinking}
                select={props.selectModel}
              />
              <Show
                when={running()}
                fallback={
                  <>
                    <Show
                      when={["error", "interrupted"].includes(props.state?.session.status ?? "")}
                    >
                      <Button onClick={props.resume}>Continue</Button>
                    </Show>
                    <Button variant="primary" disabled={!ready()} onClick={() => void send()}>
                      Send ↑
                    </Button>
                  </>
                }
              >
                <Show when={text().trim() || media.assets().length}>
                  <Button disabled={!ready()} onClick={() => void send("follow_up")}>
                    Queue
                  </Button>
                  <Button variant="primary" disabled={!ready()} onClick={() => void send("steer")}>
                    Steer ↑
                  </Button>
                </Show>
                <Button variant="secondary" onClick={props.stop}>
                  Stop <Icon name="stop" size="small" />
                </Button>
              </Show>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
