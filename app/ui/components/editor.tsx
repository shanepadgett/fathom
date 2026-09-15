import type { FileActivity, FileRange } from "../../sdk/editor.ts";
import { DiffDrawer } from "./diff-drawer.tsx";
import { createFileReview } from "../state/file-review.ts";
import { createLanguageServer } from "../state/language-server.ts";
import type { GitState } from "../../sdk/git.ts";

import { ChangedFiles } from "./changed-files.tsx";
import { TabStrip } from "./tab-strip.tsx";
import { type EditorPosition, EditorStatus } from "./editor-status.tsx";
import type { Transport } from "../transport.ts";
import type { EditorDocument } from "./editor-engine.ts";

import {
  createEffect,
  createSignal,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js";

import { type FileItem, FileTree } from "./file-tree.tsx";
import { EditorWrites } from "./editor-writes.ts";
import { EditorTabs, FileBreadcrumbs } from "./editor-navigation.tsx";
import { DraftRecovery } from "./draft-recovery.tsx";
import { Button, IconButton, Modal } from "./primitives.tsx";

interface EditorState {
  views?: ReturnType<
    ReturnType<typeof import("./editor-engine.ts").mountEditor>["saveViews"]
  >;
  expanded: string[];
  documents: EditorDocument[];
  activePath: string;
  drafts: Record<string, string>;
}

const workspaceEditors = new Map<string, EditorState>();

export function EditorWorkspace(
  props: {
    sidebarOpen: boolean;
    drawerMount?: HTMLElement;
    focus?: { path: string; request: number; range?: FileRange };
    sessionId?: string;
    focused?(request: number): void;
    transport: Transport;
    theme: string;
    close(): void;
    error(error: unknown): void;
  },
) {
  const projectId = props.transport.projectId;
  const previous = workspaceEditors.get(projectId);
  const request = <T,>(method: string, params: Record<string, unknown> = {}) =>
    props.transport.request<T>(method, { ...params, projectId });
  const [fileView, setFileView] = createSignal<"files" | "changes">("files");
  const review = createFileReview(props.transport, props.error);
  const diff = review.document;
  const [expanded, setExpanded] = createSignal(previous?.expanded ?? []);
  const [treeRevision, setTreeRevision] = createSignal(0);
  const refetch = () => setTreeRevision((value) => value + 1);
  const [documents, setDocuments] = createSignal<EditorDocument[]>(
    previous?.documents ?? [],
  );
  const [activePath, setActivePath] = createSignal(previous?.activePath ?? "");
  const [drafts, setDrafts] = createSignal<Record<string, string>>(
    previous?.drafts ?? {},
  );
  const [recovery, setRecovery] = createSignal<
    { path?: string; text: string; error?: string }[]
  >([]);
  const [showRecovery, setShowRecovery] = createSignal(false);
  const [closing, setClosing] = createSignal("");
  const [discarding, setDiscarding] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const languageServer = createLanguageServer(
    props.transport,
    () => projectId,
    () => activePath() || undefined,
  );
  const [position, setPosition] = createSignal<EditorPosition>();
  const [followAgent, setFollowAgent] = createSignal(
    localStorage.getItem("fathom.followAgent") !== "false",
  );
  const [reveal, setReveal] = createSignal<
    { path: string; range: FileRange }
  >();
  const [loading, setLoading] = createSignal(true);
  const current = () =>
    documents().find((document) => document.path === activePath());
  const dirty = (path: string) =>
    drafts()[path] !== undefined &&
    drafts()[path] !==
      documents().find((document) => document.path === path)?.text;
  let element!: HTMLDivElement;
  let editor:
    | ReturnType<typeof import("./editor-engine.ts").mountEditor>
    | undefined;
  const writes = new EditorWrites(props.error);
  let disposed = false;
  let openVersion = 0;
  const act = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      props.error(error);
    }
  };

  async function open(path: string, focus = true, range?: FileRange) {
    const version = focus ? ++openVersion : openVersion;
    const document = await request<EditorDocument>("file.read", { path });
    if (disposed || (focus && version !== openVersion)) return;
    if (dirty(document.path)) {
      if (focus) setActivePath(document.path);
      if (focus && range) setReveal({ path: document.path, range });
      return;
    }
    setDocuments(
      (items) => [
        ...items.filter((item) => item.path !== document.path),
        document,
      ],
    );
    if (focus) setActivePath(document.path);
    if (focus && range) setReveal({ path: document.path, range });
  }

  createEffect(on(() => props.focus, (target) => {
    if (target) {
      void act(() => open(target.path, true, target.range));
      props.focused?.(target.request);
    }
  }));

  async function save() {
    const document = current();
    if (!document || saving()) return;
    writes.cancel(document.path);
    const text = drafts()[document.path] ?? document.text;
    setSaving(true);
    try {
      const saved = await writes.run(
        document.path,
        () =>
          request<EditorDocument>("file.save", {
            path: document.path,
            version: document.version,
            text,
          }),
      );
      setDocuments((items) =>
        items.map((item) => item.path === saved.path ? saved : item)
      );
      setDrafts((items) => {
        if (items[saved.path] !== text) return items;
        const next = { ...items };
        delete next[saved.path];
        return next;
      });
    } finally {
      setSaving(false);
    }
  }

  function closeDocument(path: string) {
    const document = documents().find((item) => item.path === path);
    if (document) editor?.close(document.uri);
    writes.cancel(path);
    setDocuments((items) => items.filter((item) => item.path !== path));
    setDrafts((items) => {
      const next = { ...items };
      delete next[path];
      return next;
    });
    if (activePath() === path) setActivePath(documents().at(-1)?.path ?? "");
  }

  async function discard() {
    const path = closing() || activePath();
    writes.cancel(path);
    const document = await writes.run(
      path,
      () => request<EditorDocument>("file.discard", { path }),
    );
    setDocuments((items) =>
      items.map((item) => item.path === path ? document : item)
    );
    setDrafts((items) => {
      const next = { ...items };
      delete next[path];
      return next;
    });
    if (closing()) {
      closeDocument(path);
      setClosing("");
    }
    setDiscarding(false);
  }

  onMount(() => {
    void act(async () => {
      const recovered = await request<
        {
          document?: EditorDocument;
          text: string;
          path?: string;
          error?: string;
        }[]
      >("file.drafts");
      if (disposed) return;
      setRecovery(recovered.filter((item) => !item.document));
      for (const item of recovered) {
        if (!item.document) continue;
        const document = item.document;
        if (documents().some((existing) => existing.path === document.path)) {
          continue;
        }
        setDocuments((items) => [...items, document]);
        setDrafts((items) => ({ ...items, [document.path]: item.text }));
        if (!activePath()) setActivePath(document.path);
      }
    });
    for (const document of documents()) {
      if (!dirty(document.path)) void act(() => open(document.path, false));
    }
    void import("./editor-engine.ts").then((module) => {
      if (disposed) return;
      editor = module.mountEditor(
        element,
        (text) => {
          const path = activePath();
          setDrafts((items) => ({ ...items, [path]: text }));
          writes.schedule(path, () =>
            request("file.change", {
              path,
              text,
              version: documents().find((item) => item.path === path)?.version,
            }));
        },
        props.theme,
        setPosition,
        (path, text, position) =>
          request("lsp.completion", { path, text, position }),
        previous?.views,
        projectId,
      );
      setLoading(false);
    }).catch(props.error);
    const unsubscribe = props.transport.onEvent((event) => {
      if (event.projectId && event.projectId !== projectId) return;
      if (event.type === "git") refetch();
      if (event.type === "file") {
        const data = event.data as FileActivity;
        if (!data || typeof data.path !== "string" || !data.path) return;
        void act(async () => {
          if (
            followAgent() && props.sessionId &&
            event.sessionId === props.sessionId
          ) {
            await open(data.path, true, data.range);
          } else if (documents().some((item) => item.path === data.path)) {
            await open(data.path, false);
          }
          await refetch();
        });
      }
      if (event.type === "diagnostics") {
        const data = event.data as {
          uri: string;
          diagnostics: EditorDocument["diagnostics"];
        };
        setDocuments((items) =>
          items.map((item) =>
            item.uri === data.uri
              ? { ...item, diagnostics: data.diagnostics }
              : item
          )
        );
      }
    });
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        void act(save);
      }
    };
    document.addEventListener("keydown", key);
    onCleanup(() => {
      workspaceEditors.set(projectId, {
        views: editor?.saveViews() ?? previous?.views,
        expanded: expanded(),
        documents: documents(),
        activePath: activePath(),
        drafts: drafts(),
      });
      writes.flush();
      disposed = true;
      unsubscribe();
      document.removeEventListener("keydown", key);
      editor?.dispose();
    });
  });
  createEffect(() => {
    loading();
    const document = current();
    const theme = props.theme;
    const target = reveal();
    if (editor && !document) editor.clear();
    if (editor && document) {
      editor.update({
        ...document,
        text: drafts()[document.path] ?? document.text,
      });
      editor.setTheme(theme);
      if (target?.path === document.path) {
        editor.reveal(target.range);
        setReveal(undefined);
      }
    }
  });

  return (
    <section class="flex min-h-0 min-w-0 flex-1" aria-label="Code editor">
      <Show when={props.sidebarOpen}>
        <aside
          class="relative flex min-h-0 w-files-sidebar shrink-0 flex-col border-r border-line bg-surface"
          aria-label="Workspace files"
        >
          <TabStrip
            items={[{ id: "files", label: "Files" }, {
              id: "changes",
              label: "Changes",
            }]}
            selected={fileView()}
            select={setFileView}
            label="Files and changes"
          />
          <div class="flex justify-end px-2">
            <IconButton
              name="arrow-counter-clockwise"
              label="Refresh files"
              onClick={refetch}
            />
          </div>
          <Show when={recovery().length}>
            <Button onClick={() => setShowRecovery(true)}>
              Recovered drafts ({recovery().length})
            </Button>
          </Show>
          <Show
            when={fileView() === "files"}
            fallback={
              <ChangedFiles
                load={() => request<GitState>("git.status")}
                revision={treeRevision()}
                selected={diff()?.path ?? ""}
                open={(path) => void review.open(path)}
              />
            }
          >
            <FileTree
              load={(path) => request<FileItem[]>("files.list", { path })}
              revision={treeRevision()}
              selected={activePath()}
              expanded={expanded()}
              toggle={(path) =>
                setExpanded((items) =>
                  items.includes(path)
                    ? items.filter((item) => item !== path)
                    : [...items, path]
                )}
              open={(path) => void act(() => open(path))}
            />
          </Show>
        </aside>
      </Show>
      <div class="flex min-h-0 min-w-0 flex-1 flex-col">
        <EditorTabs
          paths={documents().map((item) => item.path)}
          selected={activePath()}
          dirty={dirty}
          select={setActivePath}
          close={(path) => {
            if (dirty(path)) {
              setClosing(path);
              setDiscarding(true);
            } else closeDocument(path);
          }}
        />
        <FileBreadcrumbs path={activePath()} />
        <div class="editor-engine" ref={element} />
        <EditorStatus
          server={languageServer()}
          position={position()}
          errors={current()?.diagnostics.filter((item) => item.severity === 1)
            .length ?? 0}
          warnings={current()?.diagnostics.filter((item) => item.severity === 2)
            .length ?? 0}
        >
          <Button
            aria-pressed={followAgent()}
            onClick={() => {
              const next = !followAgent();
              setFollowAgent(next);
              localStorage.setItem("fathom.followAgent", String(next));
            }}
          >
            {followAgent() ? "Following agent" : "Follow agent"}
          </Button>
          <Show when={current()}>
            <Button
              disabled={saving()}
              onClick={() =>
                dirty(activePath()) ? setDiscarding(true) : void act(discard)}
            >
              Reload
            </Button>
            <Button
              disabled={saving() || !dirty(activePath())}
              onClick={() => void act(save)}
            >
              Save ⌘S
            </Button>
          </Show>
        </EditorStatus>
      </div>
      <Show when={diff()}>
        {(file) => (
          <DiffDrawer
            mount={props.drawerMount}
            projectId={projectId}
            document={file()}
            theme={props.theme}
            close={review.close}
            refresh={() => void review.refresh()}
            refreshing={review.busy()}
            stale={review.stale()}
            footer={
              <Button
                onClick={() =>
                  void act(async () => {
                    await open(file().path);
                    review.close();
                  })}
              >
                Open in editor
              </Button>
            }
          />
        )}
      </Show>
      <Show when={discarding()}>
        <Modal
          title="Discard unsaved changes?"
          close={() => {
            setDiscarding(false);
            setClosing("");
          }}
        >
          <p>
            Your edits to {closing() || activePath()}{" "}
            will be replaced with the file on disk.
          </p>
          <div class="actions">
            <Button
              onClick={() => {
                setDiscarding(false);
                setClosing("");
              }}
            >
              Keep editing
            </Button>
            <Button variant="danger" onClick={() => void act(discard)}>
              Discard changes
            </Button>
          </div>
        </Modal>
      </Show>
      <Show when={showRecovery()}>
        <DraftRecovery
          drafts={recovery()}
          close={() => setShowRecovery(false)}
          recover={(path, destination) =>
            request<EditorDocument>("file.recover", { path, destination })}
          restored={(draft, document) => {
            setRecovery((items) => items.filter((item) => item !== draft));
            setDocuments(
              (items) => [
                ...items.filter((item) => item.path !== document.path),
                document,
              ],
            );
            setActivePath(document.path);
            void refetch();
            if (!recovery().length) setShowRecovery(false);
          }}
        />
      </Show>
    </section>
  );
}
