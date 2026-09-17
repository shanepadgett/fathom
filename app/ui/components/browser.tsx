import type { BrowserAnnotation, BrowserAnnotationBounds } from "../../sdk/browser.ts";
import type { Transport } from "../transport.ts";

import { createEffect, createSignal, For, on, onCleanup, Show } from "solid-js";

import { browserFeedback } from "../state/browser-feedback.ts";
import { browserPairing } from "../state/browser-pairing.ts";
import { browserViewport } from "../state/browser-viewport.ts";
import { AnnotationArea } from "./annotation-area.tsx";
import { type AnnotationMode, BrowserToolbar } from "./browser-toolbar.tsx";
import { CommentField } from "./comment-field.tsx";
import { Button } from "./primitives.tsx";
import { SearchDialog } from "./search-dialog.tsx";
import { SearchList } from "./search-list.tsx";

export function BrowserPanel(props: {
  transport: Transport;
  sessionId: string;
  close(): void;
  docked?: boolean;
  switchSurface?(): void;
  error(error: unknown): void;
}) {
  const [address, setAddress] = createSignal("");
  const [image, setImage] = createSignal("");
  const [pageSize, setPageSize] = createSignal({ width: 1280, height: 800 });
  const [serverSearch, setServerSearch] = createSignal(false);
  const [addressDirty, setAddressDirty] = createSignal(false);
  const [scroll, setScroll] = createSignal({ x: 0, y: 0 });
  const offset = (annotation: BrowserAnnotation) =>
    annotation.scroll
      ? {
          x: annotation.scroll.x - scroll().x,
          y: annotation.scroll.y - scroll().y,
        }
      : { x: 0, y: 0 };
  const [annotating, setAnnotating] = createSignal<AnnotationMode>();
  const [drag, setDrag] = createSignal<{
    x: number;
    y: number;
    endX: number;
    endY: number;
    pointer: number;
  }>();
  const dragBounds = (): BrowserAnnotationBounds | undefined => {
    const value = drag();
    return (
      value && {
        x: Math.min(value.x, value.endX),
        y: Math.min(value.y, value.endY),
        width: Math.abs(value.endX - value.x),
        height: Math.abs(value.endY - value.y),
      }
    );
  };
  const [selection, setSelection] = createSignal<{
    x: number;
    y: number;
    url: string;
    bounds?: BrowserAnnotationBounds;
  }>();
  const [comment, setComment] = createSignal("");
  const [staging, setStaging] = createSignal(false);
  const [pageUrl, setPageUrl] = createSignal("");
  const [ready, setReady] = createSignal(false);
  let commentInput!: HTMLTextAreaElement;
  const cancelSelection = () => {
    const pointer = drag()?.pointer;
    setDrag(undefined);
    if (pointer !== undefined && viewport?.hasPointerCapture(pointer)) {
      viewport.releasePointerCapture(pointer);
    }
    setSelection(undefined);
    setComment("");
  };
  createEffect(on(() => props.sessionId, cancelSelection));
  const { draft: annotations, refetch } = browserFeedback(props.transport, () => props.sessionId);
  const act = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      props.error(error);
    }
  };
  let viewport!: HTMLDivElement;
  const pairing = browserPairing(
    props.transport,
    () => props.sessionId,
    (state) => {
      setReady(state.ready);
      if (!state.ready) {
        setImage("");
        setPageUrl("");
        setScroll({ x: 0, y: 0 });
        cancelSelection();
      } else setPageUrl(state.url);
      if (!addressDirty()) setAddress(state.url);
    },
    props.error,
  );
  browserViewport(
    props.transport,
    () => viewport,
    pairing.viewId,
    ready,
    () => !!annotating(),
    props.error,
  );
  createEffect(
    on(
      () => props.sessionId,
      () => {
        setAddressDirty(false);
        setAddress("");
        setServerSearch(false);
      },
    ),
  );
  onCleanup(
    props.transport.onEvent((event) => {
      if (event.projectId && event.projectId !== props.transport.projectId) {
        return;
      }
      if (
        event.sessionId !== props.sessionId ||
        (event.data as { viewId?: string } | undefined)?.viewId !== pairing.viewId()
      )
        return;
      if (event.type === "browser-frame") {
        const frame = event.data as {
          image: string;
          metadata?: {
            scrollOffsetX?: number;
            scrollOffsetY?: number;
            deviceWidth?: number;
            deviceHeight?: number;
            pageScaleFactor?: number;
          };
        };
        const width = frame.metadata?.deviceWidth;
        const height = frame.metadata?.deviceHeight;
        const scale = frame.metadata?.pageScaleFactor ?? 1;
        if (
          typeof width === "number" &&
          Number.isFinite(width) &&
          width > 0 &&
          typeof height === "number" &&
          Number.isFinite(height) &&
          height > 0 &&
          Number.isFinite(scale) &&
          scale > 0
        ) {
          const next = { width: width / scale, height: height / scale };
          if (next.width !== pageSize().width || next.height !== pageSize().height) {
            cancelSelection();
            setPageSize(next);
          }
        }
        const x = frame.metadata?.scrollOffsetX,
          y = frame.metadata?.scrollOffsetY;
        if (
          typeof x === "number" &&
          Number.isFinite(x) &&
          typeof y === "number" &&
          Number.isFinite(y)
        ) {
          if ((x !== scroll().x || y !== scroll().y) && !staging()) {
            cancelSelection();
          }
          setScroll({ x, y });
        }
        setImage(frame.image);
      }
      if (event.type === "browser-url") {
        const url = (event.data as { url: string }).url;
        if (!addressDirty()) setAddress(url);
        setPageUrl(url);
        cancelSelection();
      }
    }),
  );
  const point = (event: MouseEvent) => {
    const box = viewport.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(pageSize().width, ((event.clientX - box.left) * pageSize().width) / box.width),
      ),
      y: Math.max(
        0,
        Math.min(pageSize().height, ((event.clientY - box.top) * pageSize().height) / box.height),
      ),
    };
  };
  const mouse = (event: MouseEvent, type: string) => {
    if (!image()) return;
    if (annotating()) {
      if (annotating() === "area") return;
      if (type !== "mouseReleased") return;
      if (staging()) return;
      setSelection({ ...point(event), url: pageUrl() });
      queueMicrotask(() => commentInput?.focus());
    } else {
      void act(() =>
        props.transport.request("browser.input", {
          viewId: pairing.viewId(),
          kind: "mouse",
          type,
          ...point(event),
        }),
      );
    }
  };
  return (
    <section
      class="browser-panel"
      classList={{ "border-l-0": props.docked }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && annotating() && !staging()) {
          event.preventDefault();
          cancelSelection();
          setAnnotating(undefined);
        }
      }}
    >
      <BrowserToolbar
        address={address()}
        changeAddress={(value) => {
          setAddressDirty(true);
          setAddress(value);
        }}
        navigate={() => {
          setAddressDirty(false);
          void act(() => pairing.open(address()));
        }}
        reload={() =>
          void act(() =>
            props.transport.request("browser.reload", {
              viewId: pairing.viewId(),
            }),
          )
        }
        ready={!!image()}
        annotationMode={annotating()}
        staging={staging()}
        annotate={(mode) => {
          setAnnotating((value) => (value === mode ? undefined : mode));
          cancelSelection();
        }}
        serverCount={pairing.servers().length}
        selectServer={() => setServerSearch(true)}
        close={props.close}
        docked={props.docked}
        switchSurface={props.switchSurface}
      />
      <Show when={serverSearch()}>
        <SearchDialog label="Development servers" close={() => setServerSearch(false)}>
          <SearchList
            items={pairing.servers()}
            label="Development servers"
            placeholder="Search local servers…"
            empty="No development servers announced in this session."
            searchText={(server) => `${server.url} ${server.terminalId}`}
            select={async (server) => {
              setAddressDirty(false);
              await pairing.select(server.id);
              setServerSearch(false);
            }}
          >
            {(server) => (
              <span>
                <span class="block">{server.url}</span>
                <span class="block text-xs text-muted">
                  Terminal {server.terminalId.slice(0, 8)}
                </span>
              </span>
            )}
          </SearchList>
        </SearchDialog>
      </Show>
      <div class="browser-scroll">
        <div
          class="browser-viewport"
          ref={viewport}
          tabindex="0"
          role="application"
          aria-label="Interactive browser page"
          onPointerDown={(event) => {
            if (event.button !== 0 || !image()) return;
            viewport.focus();
            if (annotating() === "area") {
              if (staging()) return;
              event.preventDefault();
              cancelSelection();
              const start = point(event);
              setDrag({
                ...start,
                endX: start.x,
                endY: start.y,
                pointer: event.pointerId,
              });
              viewport.setPointerCapture(event.pointerId);
              return;
            }
            mouse(event, "mousePressed");
          }}
          onPointerMove={(event) => {
            if (drag()?.pointer !== event.pointerId) return;
            const end = point(event);
            setDrag((value) => value && { ...value, endX: end.x, endY: end.y });
          }}
          onPointerUp={(event) => {
            if (drag()?.pointer === event.pointerId) {
              const end = point(event);
              setDrag((value) => value && { ...value, endX: end.x, endY: end.y });
              const bounds = dragBounds();
              cancelSelection();
              if (bounds && bounds.width >= 2 && bounds.height >= 2) {
                setSelection({
                  x: bounds.x + bounds.width / 2,
                  y: bounds.y + bounds.height / 2,
                  url: pageUrl(),
                  bounds,
                });
                queueMicrotask(() => commentInput?.focus());
              }
            } else if (event.button === 0) mouse(event, "mouseReleased");
          }}
          onPointerCancel={cancelSelection}
          onLostPointerCapture={() => setDrag(undefined)}
          onWheel={(event) => {
            event.preventDefault();
            if (annotating()) cancelSelection();
            void act(() =>
              props.transport.request("browser.input", {
                viewId: pairing.viewId(),
                kind: "mouse",
                type: "mouseWheel",
                ...point(event),
                deltaX: event.deltaX,
                deltaY: event.deltaY,
              }),
            );
          }}
          onKeyDown={(event) => {
            if (!image() || annotating()) return;
            event.preventDefault();
            if (event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
              void act(() =>
                props.transport.request("browser.input", {
                  viewId: pairing.viewId(),
                  kind: "text",
                  text: event.key,
                }),
              );
            } else {
              void act(() =>
                props.transport.request("browser.input", {
                  viewId: pairing.viewId(),
                  kind: "key",
                  key: event.key,
                  code: event.code,
                  keyCode: event.keyCode,
                  modifiers:
                    (event.altKey ? 1 : 0) |
                    (event.ctrlKey ? 2 : 0) |
                    (event.metaKey ? 4 : 0) |
                    (event.shiftKey ? 8 : 0),
                }),
              );
            }
          }}
        >
          <Show
            when={image()}
            fallback={
              <div class="browser-empty">
                <h3>Browse alongside your work</h3>
                <p>
                  Open a local development server or website. Select Annotate to collect feedback,
                  then send it as one message.
                </p>
              </div>
            }
          >
            <img
              draggable={false}
              src={`data:image/jpeg;base64,${image()}`}
              alt="Live interactive browser page"
            />
          </Show>
          <For each={annotations.error ? [] : annotations()}>
            {(annotation, index) => (
              <Show
                when={
                  annotation.url === pageUrl() &&
                  (annotation.viewport?.width ?? 1280) === pageSize().width &&
                  (annotation.viewport?.height ?? 800) === pageSize().height
                }
              >
                <Show when={annotation.bounds}>
                  {(bounds) => (
                    <AnnotationArea
                      viewport={pageSize()}
                      bounds={{
                        ...bounds(),
                        x: bounds().x + offset(annotation).x,
                        y: bounds().y + offset(annotation).y,
                      }}
                    />
                  )}
                </Show>
                <span
                  class="annotation-pin"
                  title={annotation.comment}
                  style={{
                    left: `${((annotation.x + offset(annotation).x) / pageSize().width) * 100}%`,
                    top: `${((annotation.y + offset(annotation).y) / pageSize().height) * 100}%`,
                  }}
                >
                  {index() + 1}
                </span>
              </Show>
            )}
          </For>
          <Show when={dragBounds() ?? selection()?.bounds}>
            {(bounds) => <AnnotationArea bounds={bounds()} viewport={pageSize()} />}
          </Show>
        </div>
      </div>
      <Show when={selection()}>
        <section class="space-y-3 border-t border-line p-4" aria-label="Annotation comment">
          <p class="text-xs text-muted">
            Add feedback for the selected {selection()?.bounds ? "area" : "point"}. Stage comments,
            then send them together.
          </p>
          <CommentField
            value={comment()}
            change={setComment}
            input={(element) => (commentInput = element)}
            disabled={staging()}
          />
          <div class="flex gap-3">
            <Button
              variant="secondary"
              disabled={staging() || !comment().trim()}
              onClick={() =>
                void act(async () => {
                  if (staging() || !selection()) return;
                  const selected = selection()!,
                    sessionId = props.sessionId;
                  const viewId = pairing.viewId();
                  setStaging(true);
                  try {
                    await props.transport.request("browser.annotate", {
                      ...selected,
                      viewId,
                      comment: comment(),
                      sessionId,
                    });
                    if (sessionId === props.sessionId && viewId === pairing.viewId()) {
                      cancelSelection();
                      await refetch();
                    }
                  } finally {
                    setStaging(false);
                  }
                })
              }
            >
              {staging() ? "Staging…" : "Stage comment"}
            </Button>
            <Button disabled={staging()} onClick={cancelSelection}>
              Cancel
            </Button>
          </div>
        </section>
      </Show>
      <Show when={annotations.error}>
        <p role="alert" class="p-4 text-sm text-danger">
          Could not load browser annotations.
        </p>
      </Show>
      <Show when={!annotations.error && annotations()?.length}>
        <p class="border-t border-line p-4 text-xs text-muted" role="status">
          {annotations()?.length} browser {annotations()?.length === 1 ? "comment" : "comments"}{" "}
          staged. Review and send them from the composer.
        </p>
      </Show>
    </section>
  );
}
