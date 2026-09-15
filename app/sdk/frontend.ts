import type { AppEvent, Entry, SessionState } from "./session.ts";
import type { UIComponentRegistry } from "./ui-components.ts";
import type { languages } from "monaco-editor/editor/editor.api.js";

export interface EditorLanguageContribution {
  id: string;
  extensions: readonly string[];
  monarch: languages.IMonarchLanguage;
  configuration?: languages.LanguageConfiguration;
  /** Higher priority wins; equal priorities sort by id. */
  priority?: number;
}

export type Dispose = () => void | Promise<void>;
export type ViewSlot =
  | "sidebar"
  | "inspector"
  | "drawer"
  | "status"
  | "workspace";
export type ViewMount = (element: HTMLElement, host: FrontendHost) => Dispose;

export type EntryMount = (
  element: HTMLElement,
  host: FrontendHost,
  entry: () => Entry,
) => Dispose;

export interface FrontendHost {
  readonly projectId: string;
  request<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<T>;
  onEvent(listener: (event: AppEvent) => void): Dispose;
  session(): SessionState | undefined;
  /** Await registration during activate. The host owns cleanup on reload/unload. */
  registerLanguage(language: EditorLanguageContribution): Promise<Dispose>;
  registerView(
    view: { id: string; title: string; slot: ViewSlot; mount: ViewMount },
  ): Dispose;
  registerCommand(
    command: {
      id: string;
      title: string;
      shortcut?: string;
      run(): void | Promise<void>;
    },
  ): Dispose;
  registerEntryRenderer(
    renderer: { id: string; matches(entry: Entry): boolean; mount: EntryMount },
  ): Dispose;
  registerSurfaceOverride(
    surface: "shell" | "transcript" | "editor",
    mount: ViewMount,
  ): Dispose;
  ui: UIComponentRegistry;
  toast(message: string): void;
}

export interface FrontendPlugin {
  activate(host: FrontendHost): void | Dispose | Promise<void | Dispose>;
}
