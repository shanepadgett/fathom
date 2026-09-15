/// <reference types="vite/client" />

import { SessionPicker } from "./components/session-picker.tsx";
import { WorkspaceChanges } from "./components/workspace-changes.tsx";
import { WorkspaceDrawer } from "./components/workspace-drawer.tsx";
import { WorkspaceSurfaces } from "./components/workspace-surfaces.tsx";

import { CommandPalette } from "./components/command-palette.tsx";
import { OpenMessage } from "./components/open-message.tsx";
import { BranchDialog } from "./components/branch-dialog.tsx";
import { BranchPicker } from "./components/branch-picker.tsx";
import { ArchivedSessions } from "./components/archived-sessions.tsx";
import { ConversationHeader } from "./components/conversation-header.tsx";
import { WorkspaceStatus } from "./components/workspace-status.tsx";
import { WorkspaceHeader } from "./components/workspace-header.tsx";
import { Inspector } from "./components/inspector.tsx";
import { Sidebar } from "./components/sidebar.tsx";
import type { AssistantMessage } from "@earendil-works/pi-ai";

import type {
  Entry,
  Project,
  Session,
  SessionState,
  UsageRecord,
} from "../sdk/session.ts";
import type { ModelChoice } from "../sdk/models.ts";

import { createEffect, createSignal, For, on, Show } from "solid-js";
import { render } from "solid-js/web";

import { EditorWorkspace } from "./components/editor.tsx";
import { GitStudio } from "./components/git-studio.tsx";
import { BrowserPanel } from "./components/browser.tsx";
import { Artifacts } from "./components/artifacts.tsx";
import { ProjectDialog } from "./components/project-dialog.tsx";
import { Composer } from "./components/composer.tsx";
import { Button, Metric, Modal } from "./components/primitives.tsx";
import { Settings } from "./components/settings.tsx";
import { TerminalPanel } from "./components/terminal.tsx";
import { Transcript } from "./components/transcript.tsx";
import { UIHost } from "./host.ts";
import { PluginSlot, Surface } from "./components/plugin-slot.tsx";
import { Transport } from "./transport.ts";
import "./design.css";

import { createWorkspace } from "./state/workspace.ts";
function App() {
  let workspaceContent!: HTMLDivElement;
  const [composerHeight, setComposerHeight] = createSignal(224);
  const [artifactId, setArtifactId] = createSignal<string>();
  const app = createWorkspace();
  const {
    transport,
    projects,
    project,
    sessions,
    state,
    live,
    models,
    usage,
    approvals,
    connected,
    settings,
    setSettings,
    trustDialog,
    setTrustDialog,
    projectDialog,
    setProjectDialog,
    search,
    setSearch,
    palette,
    setPalette,
    inspector,
    setInspector,
    mode,
    setMode,
    terminalOpen,
    setTerminalOpen,
    artifactsOpen,
    setArtifactsOpen,
    detailed,
    setDetailed,
    theme,
    error,
    setError,
    notice,
    setNotice,
    reload,
    setReload,
    rewind,
    setRewind,
    uiHost,
    pluginCommands,
    fail,
    act,
    sessionId,
    currentUsage,
    totalTokens,
    totalCost,
    refresh,
    chooseSession,
    newSession,
    openProject,
    trust,
    changeTheme,
  } = app;
  createEffect(on(sessionId, () => setArtifactId(undefined)));
  return (
    <Surface host={uiHost} name="shell">
      <div class="flex h-dvh min-w-0 flex-col overflow-hidden bg-canvas">
        <WorkspaceHeader app={app} />
        <Show when={error()}>
          <div class="banner error">
            <span>{error()}</span>
            <Button onClick={() => setError("")}>Dismiss</Button>
          </div>
        </Show>
        <Show when={notice()}>
          <div class="banner">
            <span>{notice()}</span>
            <Button onClick={() => setNotice("")}>Dismiss</Button>
          </div>
        </Show>
        <Show when={reload()}>
          <div class="banner">
            <span>Plugins changed on disk.</span>
            <Button
              onClick={() =>
                void act(async () => {
                  await transport.request("plugins.reload");
                  setReload(false);
                  await refresh();
                })}
            >
              Reload environment
            </Button>
          </div>
        </Show>
        <div
          ref={workspaceContent}
          class="relative flex min-h-0 min-w-0 flex-1"
        >
          <Show when={app.sidebarOpen() && mode() !== "editor"}>
            <Sidebar app={app} />
          </Show>
          <WorkspaceDrawer
            kind="agent"
            enabled={mode() === "editor"}
            open={app.agentDrawer() && !artifactsOpen()}
            close={() => app.setAgentDrawer(false)}
          >
            <main
              class="flex min-h-0 min-w-0 flex-1 flex-col"
              classList={{ "conversation-drawer": mode() === "browser" }}
            >
              <ConversationHeader app={app} />

              <div class="relative grid min-h-0 flex-1 grid-cols-1 conversation-rows">
                <Surface host={uiHost} name="transcript">
                  <Transcript
                    openFile={app.openFile}
                    openDiff={app.openDiff}
                    bottomPadding={composerHeight()}
                    openArtifact={(id) => {
                      setArtifactId(id);
                      setArtifactsOpen(true);
                    }}
                    focus={app.messageFocus()}
                    projectId={app.project()?.id ?? ""}
                    active={mode() !== "editor" || app.agentDrawer()}
                    host={uiHost}
                    state={state()}
                    live={live()}
                    detailed={detailed()}
                    rewind={setRewind}
                    resend={async (entry, text) => {
                      await transport.request("message.resend", {
                        sessionId: entry.sessionId,
                        entryId: entry.id,
                        text,
                      });
                      await app.refresh();
                    }}
                    retry={async (entry) => {
                      await transport.request("message.retry", {
                        sessionId: sessionId(),
                        entryId: entry.id,
                      });
                      await app.refresh();
                    }}
                  />
                </Surface>
                <For
                  each={approvals().filter((item) =>
                    item.sessionId === sessionId()
                  )}
                >
                  {(approval) => (
                    <section class="approval-card">
                      <strong>Approval needed</strong>
                      <p>{approval.explanation}</p>
                      <pre>{JSON.stringify(approval.args, null, 2)}</pre>
                      <div class="actions">
                        <Button
                          onClick={() =>
                            void act(() =>
                              transport.request("approval.resolve", {
                                id: approval.id,
                                approved: false,
                              })
                            )}
                        >
                          Decline
                        </Button>
                        <Button
                          variant="primary"
                          onClick={() =>
                            void act(() =>
                              transport.request("approval.resolve", {
                                id: approval.id,
                                approved: true,
                              })
                            )}
                        >
                          Approve once
                        </Button>
                      </div>
                    </section>
                  )}
                </For>
                <Composer
                  onHeight={setComposerHeight}
                  openArtifact={(id) => {
                    setArtifactId(id);
                    setArtifactsOpen(true);
                  }}
                  transport={transport}
                  state={state()}
                  models={models()}
                  send={async (text, mode, media) => {
                    setError("");
                    try {
                      await transport.request("session.submit", {
                        sessionId: sessionId(),
                        text,
                        mode,
                        media,
                      });
                    } catch (error) {
                      fail(error);
                      throw error;
                    }
                    // Admission succeeded; a refresh failure must not preserve a resendable draft.
                    await refresh().catch(fail);
                  }}
                  stop={() =>
                    void act(() =>
                      transport.request("session.stop", {
                        sessionId: sessionId(),
                      })
                    )}
                  resume={() =>
                    void act(() =>
                      transport.request("session.continue", {
                        sessionId: sessionId(),
                      })
                    )}
                  selectThinking={async (thinking) => {
                    const projectId = transport.projectId;
                    const id = sessionId();
                    await transport.request("session.update", {
                      projectId,
                      sessionId: id,
                      changes: { thinking },
                    });
                    if (
                      transport.projectId === projectId && sessionId() === id
                    ) await refresh();
                  }}
                  selectModel={async (value) => {
                    const slash = value.indexOf("/");
                    await transport.request("model.select", {
                      sessionId: sessionId(),
                      provider: value.slice(0, slash),
                      model: value.slice(slash + 1),
                    });
                    await refresh();
                  }}
                  settings={() => setSettings(true)}
                />
              </div>
            </main>
          </WorkspaceDrawer>
          <Show when={mode() === "editor" || app.browserVisible()}>
            <Show keyed when={project()?.id}>
              <WorkspaceSurfaces
                width={app.layout.value().editorBrowserWidth}
                resize={(editorBrowserWidth) =>
                  app.layout.update({ editorBrowserWidth })}
                editorVisible={mode() === "editor"}
                browserVisible={app.browserVisible()}
                editor={
                  <Show when={mode() === "editor"}>
                    <Surface host={uiHost} name="editor">
                      <EditorWorkspace
                        drawerMount={workspaceContent}
                        sessionId={sessionId()}
                        focused={app.fileFocused}
                        focus={app.fileFocus()?.projectId === project()?.id
                          ? app.fileFocus()
                          : undefined}
                        sidebarOpen={app.sidebarOpen()}
                        transport={transport}
                        theme={theme()}
                        close={() => setMode("agent")}
                        error={fail}
                      />
                    </Surface>
                  </Show>
                }
                browser={
                  <Show when={app.browserVisible() && !!sessionId()}>
                    <BrowserPanel
                      transport={transport}
                      sessionId={sessionId()!}
                      docked={mode() === "editor"}
                      switchSurface={app.switchBrowserSurface}
                      close={app.hideBrowser}
                      error={fail}
                    />
                  </Show>
                }
              />
            </Show>
          </Show>
          <Show when={artifactsOpen() && sessionId()}>
            <Artifacts
              initialId={artifactId()}
              transport={transport}
              sessionId={sessionId()!}
              close={() => setArtifactsOpen(false)}
              error={fail}
            />
          </Show>
          <Show when={app.diffOpen()}>
            <Show keyed when={project()?.id}>
              <WorkspaceChanges
                initialPath={app.diffPath()}
                transport={transport}
                theme={theme()}
                close={() => app.setDiffOpen(false)}
                commits={() => {
                  app.setDiffOpen(false);
                  app.setGitOpen(true);
                }}
              />
            </Show>
          </Show>
          <Show when={inspector() && mode() === "agent" && !artifactsOpen()}>
            <Inspector app={app} />
          </Show>
        </div>
        <Show when={terminalOpen() && sessionId()}>
          <TerminalPanel
            theme={theme()}
            transport={transport}
            sessionId={sessionId()!}
            close={() => setTerminalOpen(false)}
            error={fail}
          />
        </Show>
        <PluginSlot host={uiHost} slot="drawer" />
        <PluginSlot host={uiHost} slot="workspace" />
        <WorkspaceStatus app={app} />
        <Show when={app.sessionPicker()}>
          {(kind) => (
            <SessionPicker
              app={app}
              kind={kind()}
              close={() => app.setSessionPicker(undefined)}
            />
          )}
        </Show>
        <Show when={app.gitOpen() && sessionId()}>
          <GitStudio
            transport={transport}
            theme={theme()}
            sessionId={sessionId()!}
            close={() => app.setGitOpen(false)}
            openProject={openProject}
          />
        </Show>

        <Show when={app.branchesOpen()}>
          <BranchPicker app={app} />
        </Show>
        <Show when={app.archivedOpen()}>
          <ArchivedSessions app={app} />
        </Show>
        <Show when={settings()}>
          <Settings
            transport={transport}
            close={() => {
              setSettings(false);
              void act(refresh);
            }}
            error={fail}
            theme={theme()}
            setTheme={changeTheme}
          />
        </Show>
        <Show when={trustDialog()}>
          <Modal
            title="Do you trust this workspace?"
            close={() => setTrustDialog(false)}
          >
            <p class="mono path-label">{project()?.path}</p>
            <p>
              Project plugins, skills, and custom prompts can execute code on
              your machine. Enable them only for repositories whose authors you
              trust.
            </p>
            <p class="muted">
              Restricted mode keeps project plugins disabled and asks before
              file changes and commands.
            </p>
            <div class="actions">
              <Button
                disabled={app.trustBusy()}
                onClick={() => void act(() => trust(false))}
              >
                Enter Restricted Mode
              </Button>
              <Button
                variant="primary"
                disabled={app.trustBusy()}
                onClick={() => void act(() => trust(true))}
              >
                Trust workspace & enable plugins
              </Button>
            </div>
          </Modal>
        </Show>
        <Show when={projectDialog()}>
          <ProjectDialog
            projects={projects()}
            open={openProject}
            close={() => setProjectDialog(false)}
          />
        </Show>
        <Show when={palette()}>
          <CommandPalette
            close={() => setPalette(false)}
            commands={[
              {
                title: "Conversation branches",
                run: () => app.setBranchesOpen(true),
              },
              {
                title: "Archived sessions",
                run: () => app.setArchivedOpen(true),
              },
              { title: "New session", run: () => app.setSessionPicker("new") },
              {
                title: "Search sessions",
                run: () => app.setSessionPicker("search"),
              },
              { title: "Open project", run: () => setProjectDialog(true) },
              {
                title: "Open message link",
                run: () => app.setMessageLinkOpen(true),
              },
              { title: "Settings and providers", run: () => setSettings(true) },
              {
                title: "Open integrated browser",
                run: () => app.showBrowser("active"),
              },
              {
                title: "Show browser beside editor",
                run: () => app.showBrowser("split"),
              },
              { title: "Hide browser", run: app.hideBrowser },
              {
                title: "Switch browser between split and active surface",
                run: app.switchBrowserSurface,
              },
              {
                title: "Open artifacts",
                run: () => {
                  setArtifactId(undefined);
                  setArtifactsOpen(true);
                },
              },
              { title: "Review Git changes", run: () => app.setGitOpen(true) },
              {
                title: "Toggle terminal",
                run: () => setTerminalOpen((value) => !value),
              },
              {
                title: "Toggle inspector",
                run: () => setInspector((value) => !value),
              },
              {
                title: "Toggle theme",
                run: () => changeTheme(theme() === "dark" ? "light" : "dark"),
              },
              ...pluginCommands(),
            ]}
          />
        </Show>
        <Show when={app.messageLinkOpen()}>
          <OpenMessage
            open={app.openMessageLink}
            close={() => app.setMessageLinkOpen(false)}
          />
        </Show>
        <Show when={rewind()}>
          {(entry) => <BranchDialog app={app} entry={entry()} />}
        </Show>
      </div>
    </Surface>
  );
}

render(() => <App />, document.getElementById("root")!);
