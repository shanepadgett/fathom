import type { FileRange } from "../../sdk/editor.ts";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type {
  Entry,
  Project,
  Session,
  SessionState,
  UsageRecord,
} from "../../sdk/session.ts";
import type { ModelChoice } from "../../sdk/models.ts";
import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { UIHost } from "../host.ts";
import { Transport } from "../transport.ts";
import {
  notify,
  type Preferences as NotificationPreferences,
} from "../notifications.ts";
import type { AudioCue } from "../audio-cues.ts";
import type { Approval } from "./project-data.ts";
import { prepareProject, projectOverview } from "./project-data.ts";
import { parseMessageLink } from "../../sdk/message-link.ts";
import { workspaceLayout } from "./workspace-layout.ts";
export function createWorkspace() {
  const transport = new Transport();
  const [projects, setProjects] = createSignal<Project[]>([]);
  const [project, setProject] = createSignal<Project>();
  const [sessions, setSessions] = createSignal<Session[]>([]);
  const [state, setState] = createSignal<SessionState>();
  const [live, setLive] = createSignal<
    { entryId: string; message: AssistantMessage }
  >();
  const [models, setModels] = createSignal<ModelChoice[]>([]);
  const [usage, setUsage] = createSignal<UsageRecord[]>([]);
  const [approvals, setApprovals] = createSignal<Approval[]>([]);
  const [connected, setConnected] = createSignal(false);
  const [branchesOpen, setBranchesOpen] = createSignal(false);
  const [archivedOpen, setArchivedOpen] = createSignal(false);
  const [settings, setSettings] = createSignal(false);
  const [trustDialog, setTrustDialog] = createSignal(false);
  const [trustBusy, setTrustBusy] = createSignal(false);
  const [projectDialog, setProjectDialog] = createSignal(false);
  const [sessionPicker, setSessionPicker] = createSignal<"new" | "search">();
  const [search, setSearch] = createSignal("");
  const [palette, setPalette] = createSignal(false);
  const [messageLinkOpen, setMessageLinkOpen] = createSignal(false);
  const [messageFocus, setMessageFocus] = createSignal<
    { entryId: string; sessionId: string; request: number }
  >();
  const [inspector, setInspector] = createSignal(true);
  const [mode, setMode] = createSignal("agent");
  const layout = workspaceLayout(
    transport,
    () => project()?.id,
    (error) => fail(error),
  );
  const browserVisible = () =>
    !!sessionId() &&
    (mode() === "browser" ||
      (mode() === "editor" && layout.value().browserBeside));
  const showBrowser = (surface: "split" | "active") =>
    batch(() => {
      if (!sessionId()) {
        setSessionPicker("new");
        return;
      }
      if (surface === "split") {
        layout.update({ browserBeside: true });
      }
      setMode(surface === "split" ? "editor" : "browser");
    });
  const hideBrowser = () =>
    batch(() => {
      layout.update({ browserBeside: false });
      if (mode() === "browser") setMode("agent");
    });
  const toggleBrowser = () =>
    browserVisible()
      ? hideBrowser()
      : showBrowser(mode() === "editor" ? "split" : "active");
  const switchBrowserSurface = () =>
    showBrowser(mode() === "editor" ? "active" : "split");
  const [sidebarOpen, setSidebarOpen] = createSignal(true);
  const [agentDrawer, setAgentDrawer] = createSignal(false);
  const [terminalOpen, setTerminalOpen] = createSignal(false);
  const [artifactsOpen, setArtifactsOpen] = createSignal(false);
  const [fileFocus, setFileFocus] = createSignal<
    { projectId: string; path: string; request: number; range?: FileRange }
  >();
  const [diffPath, setDiffPath] = createSignal<string>();
  const [diffOpen, setDiffOpen] = createSignal(false);
  const [gitOpen, setGitOpen] = createSignal(false);
  const [detailed, setDetailed] = createSignal(false);
  const [theme, setTheme] = createSignal("dark");
  let themeRevision = 0;
  const [error, setError] = createSignal("");
  const [notice, setNotice] = createSignal("");
  const [retrySession, setRetrySession] = createSignal<string>();
  const [reload, setReload] = createSignal(false);
  const [rewind, setRewind] = createSignal<Entry>();
  const uiHost = new UIHost(transport, state, setNotice);
  const [pluginCommands, setPluginCommands] = createSignal<
    { title: string; run(): void | Promise<void> }[]
  >([]);
  onCleanup(
    uiHost.subscribe(() => setPluginCommands([...uiHost.commands.values()])),
  );
  const fail = (error: unknown) =>
    setError(error instanceof Error ? error.message : String(error));
  const act = async (action: () => Promise<unknown>) => {
    try {
      return await action();
    } catch (error) {
      fail(error);
    }
  };
  const sessionId = createMemo(() => state()?.session.id);
  const currentUsage = createMemo(() =>
    usage().filter((record) => record.sessionId === sessionId())
  );
  const totalTokens = () =>
    currentUsage().reduce((n, record) => n + record.usage.totalTokens, 0);
  const totalCost = () =>
    currentUsage().reduce((n, record) => n + record.usage.cost.total, 0);

  let selectionVersion = 0;
  let refreshVersion = 0;
  let openingProject = false;

  async function refresh() {
    const projectId = project()?.id;
    if (!projectId) return;
    const version = ++refreshVersion;
    const selectedId = sessionId();
    const [overview, snapshot] = await Promise.all([
      projectOverview(transport, projectId),
      selectedId
        ? transport.request<SessionState>("session.get", {
          projectId,
          sessionId: selectedId,
        })
        : undefined,
    ]);
    if (
      version !== refreshVersion || project()?.id !== projectId ||
      sessionId() !== selectedId
    ) return;
    batch(() => {
      setSessions(overview.sessions);
      setModels(overview.models);
      setUsage(overview.usage);
      setApprovals(overview.approvals);
      if (snapshot) {
        setState(snapshot);
        if (
          snapshot.session.status !== "retry_waiting" &&
          retrySession() === snapshot.session.id
        ) setRetrySession(undefined);
        if (
          !["running", "retry_waiting", "approval"].includes(
            snapshot.session.status,
          )
        ) setLive(undefined);
      }
    });
  }

  async function chooseSession(id: string) {
    const projectId = project()?.id;
    if (!projectId) return;
    const version = ++selectionVersion;
    const snapshot = await transport.request<SessionState>("session.get", {
      projectId,
      sessionId: id,
    });
    if (version !== selectionVersion || project()?.id !== projectId) return;
    ++refreshVersion;
    batch(() => {
      setLive(undefined);
      setState(snapshot);
    });
    await transport.request("session.selection.set", {
      projectId,
      sessionId: id,
    });
    await refresh();
  }

  async function newSession() {
    const projectId = project()?.id;
    if (!projectId) return;
    const version = ++selectionVersion;
    const session = await transport.request<Session>("session.create", {
      projectId,
    });
    if (project()?.id === projectId && version === selectionVersion) {
      await chooseSession(session.id);
    }
  }

  async function openProject(path: string) {
    if (openingProject) {
      throw new Error("A project is already opening. Wait for it to finish.");
    }
    openingProject = true;
    try {
      await layout.settled();
      const next = await prepareProject(transport, path);
      ++selectionVersion;
      ++refreshVersion;
      transport.projectId = next.project.id;
      batch(() => {
        setProject(next.project);
        layout.restore(next.layout);
        setProjects(next.projects);
        setSessions(next.sessions);
        setModels(next.models);
        setUsage(next.usage);
        setApprovals(next.approvals);
        setState(next.state);
        setLive(undefined);
        setRewind(undefined);
        setReload(false);
        setNotice("");
        setError("");
        setTrustDialog(!next.project.trusted && !next.project.trustReviewed);
        setProjectDialog(false);
      });
      try {
        await uiHost.load();
      } catch (error) {
        fail(error);
      }
    } finally {
      openingProject = false;
    }
  }

  async function openMessageLink(link: string) {
    const target = parseMessageLink(link);
    const available = await transport.request<Project[]>("projects.list");
    const destination = available.find((item) => item.id === target.projectId);
    if (!destination) {
      throw new Error(
        "This message's project is not available on this machine.",
      );
    }
    if (project()?.id !== target.projectId) await openProject(destination.path);
    await chooseSession(target.sessionId);
    const snapshot = state();
    if (
      project()?.id !== target.projectId ||
      snapshot?.session.id !== target.sessionId
    ) {
      throw new Error(
        "The selection changed while opening this message. Try again.",
      );
    }
    if (
      !snapshot.entries.some((entry) =>
        entry.id === target.entryId && entry.message?.role !== "toolResult"
      )
    ) {
      throw new Error(
        "This message is no longer available in the linked conversation.",
      );
    }
    setMode("agent");
    setSettings(false);
    setMessageFocus({ ...target, request: (messageFocus()?.request ?? 0) + 1 });
  }

  async function trust(trusted: boolean) {
    const projectId = project()?.id;
    if (!projectId || trustBusy()) return;
    setTrustBusy(true);
    try {
      const updated = await transport.request<Project>("project.trust", {
        projectId,
        trusted,
      });
      if (project()?.id !== projectId) return;
      setProject(updated);
      await refresh();
      if (project()?.id === projectId) setTrustDialog(false);
    } finally {
      setTrustBusy(false);
    }
  }

  createEffect(() => {
    document.documentElement.dataset.theme = theme();
  });
  onMount(() => {
    const listener = transport.onEvent((event) => {
      if (event.type === "connected") {
        setConnected(true);
        if (project()) {
          void act(async () => {
            await transport.request("projects.open", { path: project()!.path });
            await refresh();
            await uiHost.load();
          });
        }
      }
      if (event.type === "disconnected") setConnected(false);
      if (event.type === "attention") {
        void act(async () => {
          const data = event.data as {
            title: string;
            body: string;
            kind?: AudioCue;
          };
          const preferences = await transport.request<
            NotificationPreferences
          >("settings.runtime.get", { projectId: event.projectId });
          await notify(
            data.title,
            data.body,
            preferences,
            event.projectId && event.sessionId
              ? { projectId: event.projectId, sessionId: event.sessionId }
              : undefined,
            data.kind,
          );
        });
      }
      if (event.projectId && event.projectId !== project()?.id) return;
      if (event.type === "stream" && event.sessionId === sessionId()) {
        setLive(event.data as { entryId: string; message: AssistantMessage });
        if (retrySession() === event.sessionId) setRetrySession(undefined);
      }
      if (event.type === "environment") void act(() => uiHost.load());
      if (
        ["session", "approvals", "environment", "providers", "usage"].includes(
          event.type,
        )
      ) void act(refresh);
      if (event.type === "error") {
        fail((event.data as { message: string }).message);
      }
      if (event.type === "plugins-changed") setReload(true);
      if (event.type === "retry") {
        setRetrySession(event.sessionId);
        void act(refresh);
      }
    });
    const notificationClick = (event: Event) => {
      const target =
        (event as CustomEvent<{ projectId: string; sessionId: string }>).detail;
      if (
        !target || typeof target.projectId !== "string" ||
        typeof target.sessionId !== "string"
      ) return;
      void act(async () => {
        if (project()?.id !== target.projectId) {
          const available = await transport.request<Project[]>("projects.list");
          const destination = available.find((item) =>
            item.id === target.projectId
          );
          if (!destination) {
            throw new Error(
              "The notification's project is no longer available.",
            );
          }
          await openProject(destination.path);
        }
        if (project()?.id !== target.projectId) return;
        await chooseSession(target.sessionId);
        setSettings(false);
        setMode("agent");
      });
    };
    window.addEventListener("fathom:notification", notificationClick);
    onCleanup(() =>
      window.removeEventListener("fathom:notification", notificationClick)
    );
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setPalette((value) => !value);
        return;
      }
      uiHost.handleShortcut(event);
    };
    document.addEventListener("keydown", keydown);
    const desktopCommand = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (id === "settings") setSettings(true);
      if (id === "new-session") setSessionPicker("new");
      if (id === "open-project") setProjectDialog(true);
      if (id === "commands") setPalette(true);
      if (id === "terminal") setTerminalOpen((value) => !value);
      if (id === "inspector") setInspector((value) => !value);
    };
    globalThis.addEventListener("fathom:desktop-command", desktopCommand);
    void act(async () => {
      await transport.connect();
      const revision = themeRevision;
      try {
        const appearance = await transport.request<{ theme: string }>(
          "appearance.get",
        );
        if (
          revision === themeRevision &&
          ["dark", "light"].includes(appearance.theme)
        ) setTheme(appearance.theme);
      } catch (error) {
        fail(error);
      }
      const projects = await transport.request<Project[]>("projects.list");
      setProjects(projects);
      if (projects[0] && projects[0].path !== "/") {
        try {
          await openProject(projects[0].path);
        } catch (error) {
          fail(error);
          setProjectDialog(true);
        }
      } else setProjectDialog(true);
    });
    onCleanup(() => {
      listener();
      void uiHost.dispose();
      transport.dispose();
      document.removeEventListener("keydown", keydown);
      globalThis.removeEventListener("fathom:desktop-command", desktopCommand);
    });
  });

  const changeTheme = (value: string) => {
    if (value !== "dark" && value !== "light") return;
    themeRevision++;
    setTheme(value);
    void act(() => transport.request("appearance.set", { theme: value }));
  };
  return {
    branchesOpen,
    setBranchesOpen,
    archivedOpen,
    setArchivedOpen,
    sidebarOpen,
    setSidebarOpen,
    agentDrawer,
    setAgentDrawer,
    fileFocus,
    fileFocused: (request: number) => {
      if (fileFocus()?.request === request) setFileFocus(undefined);
    },
    diffPath,
    openFile: (path: string, range?: FileRange) => {
      const projectId = project()?.id;
      if (!projectId) return;
      setFileFocus({
        projectId,
        path,
        range,
        request: (fileFocus()?.request ?? 0) + 1,
      });
      setAgentDrawer(false);
      setMode("editor");
    },
    openDiff: (path?: string) => {
      setDiffPath(path);
      setDiffOpen(true);
    },
    diffOpen,
    setDiffOpen,
    gitOpen,
    setGitOpen,
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
    trustBusy,
    setTrustDialog,
    projectDialog,
    setProjectDialog,
    search,
    setSearch,
    sessionPicker,
    setSessionPicker,
    palette,
    setPalette,
    messageLinkOpen,
    setMessageLinkOpen,
    messageFocus,
    openMessageLink,
    inspector,
    setInspector,
    mode,
    setMode,
    browserVisible,
    showBrowser,
    hideBrowser,
    toggleBrowser,
    switchBrowserSurface,
    layout,
    terminalOpen,
    setTerminalOpen,
    artifactsOpen,
    setArtifactsOpen,
    detailed,
    setDetailed,
    theme,
    error,
    setError,
    notice: () =>
      notice() ||
      (retrySession() === sessionId()
        ? "Provider temporarily unavailable. Retrying…"
        : ""),
    setNotice: (value: string) => {
      setNotice(value);
      if (!value) setRetrySession(undefined);
    },
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
  };
}
