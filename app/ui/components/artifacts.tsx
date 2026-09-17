import type { Artifact } from "../../sdk/artifacts.ts";
import type { Transport } from "../transport.ts";

import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  on,
  onCleanup,
  Show,
} from "solid-js";

import { ArtifactApproval } from "./artifact-approval.tsx";
import { ArtifactFeedback } from "./artifact-feedback.tsx";
import { HtmlPreview } from "./html-preview.tsx";
import { Markdown } from "./markdown.tsx";
import { Button, Field } from "./primitives.tsx";
import { WorkspacePanel } from "./workspace-panel.tsx";

export function Artifacts(props: {
  transport: Transport;
  sessionId: string;
  initialId?: string;
  close(): void;
  error(error: unknown): void;
}) {
  const [artifacts, { refetch }] = createResource(
    () => props.sessionId,
    (sessionId) => props.transport.request<Artifact[]>("artifacts.list", { sessionId }),
  );
  const [selected, setSelected] = createSignal<Artifact & { content: string }>();
  const [destination, setDestination] = createSignal("");
  const [source, setSource] = createSignal(false);
  const [quote, setQuote] = createSignal("");
  let preview!: HTMLDivElement;
  const captureSelection = () => {
    const selection = window.getSelection();
    if (
      selection?.rangeCount &&
      preview.contains(selection.getRangeAt(0).commonAncestorContainer) &&
      !selection.isCollapsed
    )
      setQuote(selection.toString().slice(0, 4000));
  };
  const act = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      props.error(error);
    }
  };
  let selection = 0;
  async function selectArtifact(id?: string) {
    const version = ++selection;
    const sessionId = props.sessionId;
    setSelected(undefined);
    setSource(false);
    setQuote("");
    setDestination("");
    if (!id) return;
    try {
      const value = await props.transport.request<Artifact & { content: string }>("artifact.read", {
        sessionId,
        id,
      });
      if (version === selection && sessionId === props.sessionId) {
        setSelected(value);
      }
    } catch (error) {
      if (version === selection && sessionId === props.sessionId) {
        props.error(error);
      }
    }
  }
  const selectionKey = createMemo(() => JSON.stringify([props.sessionId, props.initialId]));
  createEffect(on(selectionKey, () => void selectArtifact(props.initialId)));
  onCleanup(() => {
    selection++;
  });
  onCleanup(
    props.transport.onEvent((event) => {
      if (event.type === "session" && event.sessionId === props.sessionId) {
        void Promise.resolve(refetch()).catch(() => {});
      }
    }),
  );
  return (
    <WorkspacePanel title="Artifacts" close={props.close}>
      <div class="flex flex-col items-start gap-2">
        <Show when={artifacts.error}>
          <p role="alert" class="text-sm text-danger">
            Could not load artifacts.
          </p>
        </Show>
        <For each={artifacts.error ? [] : artifacts()}>
          {(artifact) => (
            <Button onClick={() => void selectArtifact(artifact.id)}>
              {artifact.title} · {artifact.name} · {artifact.status}
            </Button>
          )}
        </For>
        <Show when={!artifacts.loading && !artifacts.error && !artifacts()?.length}>
          <p class="muted">
            Plans, documents, and interactive visuals appear here when the agent creates them.
          </p>
        </Show>
      </div>
      <Show when={selected()} keyed>
        {(artifact) => (
          <>
            <div class="artifact-toolbar">
              <h3>{artifact.title}</h3>
              <Button onClick={() => setSource((value) => !value)}>
                {source() ? "Preview" : "Source"}
              </Button>
              <span class="spacer" />
              <small>{artifact.bytes.toLocaleString()} bytes</small>
            </div>
            <div ref={preview} onMouseUp={captureSelection} onKeyUp={captureSelection}>
              <Show when={!source()} fallback={<pre>{artifact.content}</pre>}>
                <Show
                  when={artifact.mime === "text/html"}
                  fallback={<Markdown text={artifact.content} />}
                >
                  <HtmlPreview
                    title={artifact.title}
                    projectId={props.transport.projectId}
                    sessionId={props.sessionId}
                    artifactId={artifact.id}
                    select={setQuote}
                  />
                </Show>
              </Show>
            </div>
            <ArtifactFeedback
              transport={props.transport}
              sessionId={props.sessionId}
              artifactId={artifact.id}
              quote={quote()}
            />
            <div class="actions">
              <ArtifactApproval
                disabled={
                  !!artifacts.error ||
                  (artifacts()?.find((item) => item.id === artifact.id)?.status ??
                    artifact.status) !== "pending"
                }
                approve={() =>
                  props.transport.request("artifact.approve", {
                    sessionId: props.sessionId,
                    id: artifact.id,
                  })
                }
                approved={props.close}
              />
            </div>
            <details>
              <summary>Save a copy to the workspace</summary>
              <Field label="Destination path">
                <input
                  placeholder="docs/plan.md"
                  value={destination()}
                  onInput={(event) => setDestination(event.currentTarget.value)}
                />
              </Field>
              <Button
                onClick={() =>
                  void act(() =>
                    props.transport.request("artifact.materialize", {
                      sessionId: props.sessionId,
                      id: artifact.id,
                      path: destination(),
                    }),
                  )
                }
              >
                Save copy
              </Button>
            </details>
          </>
        )}
      </Show>
    </WorkspacePanel>
  );
}
