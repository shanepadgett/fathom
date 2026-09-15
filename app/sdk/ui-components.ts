import type { Dispose, FrontendHost } from "./frontend.ts";
import type { IconName } from "./icons.ts";

export interface UIComponentInstance<Props> {
  update(props: Props): void;
  dispose: Dispose;
}

export type UIComponent<Props> = (
  element: HTMLElement,
  host: FrontendHost,
  props: Props,
) => UIComponentInstance<Props>;

export interface BuiltinComponentProps {
  "fathom.icon-button": {
    name: IconName;
    label: string;
    toolbar?: boolean;
    disabled?: boolean;
    pressed?: boolean;
    expanded?: boolean;
    onClick(): void;
  };
  "fathom.connection-row": {
    name: string;
    status: string;
    avatar?: string;
    actions: HTMLElement;
  };
  "fathom.split-pane": {
    first: HTMLElement;
    second: HTMLElement;
    label: string;
    width?: number;
    minFirst?: number;
    minSecond?: number;
    firstVisible?: boolean;
    secondVisible?: boolean;
    onResize?(width: number): void;
  };
  "fathom.terminal": {
    sessionId: string;
    theme: string;
    autoStart?: boolean;
    onClose(): void;
    onError(error: unknown): void;
  };
  "fathom.diff": { patch: string };
  "fathom.message-card": {
    author: string;
    text: string;
    createdAt: number;
    agent?: boolean;
    working?: boolean;
    model?: string;
  };
  "fathom.button": {
    label: string;
    variant?: "primary" | "secondary" | "quiet" | "danger";
    size?: "compact" | "small" | "normal";
    disabled?: boolean;
    onClick(): void;
  };
  "fathom.text-field": {
    label: string;
    value: string;
    hint?: string;
    placeholder?: string;
    disabled?: boolean;
    onInput(value: string): void;
  };
}

export interface UIComponentRegistry {
  registerComponent<Props>(
    name: string,
    component: UIComponent<Props>,
  ): Dispose;
  getComponent<Name extends keyof BuiltinComponentProps>(
    name: Name,
  ): UIComponent<BuiltinComponentProps[Name]>;
  getComponent<Props = unknown>(name: string): UIComponent<Props> | undefined;
}
