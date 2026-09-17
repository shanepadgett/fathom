import type { JSX } from "solid-js";

import { onCleanup, onMount, Show, splitProps } from "solid-js";

import { occludeNativeSurfaces } from "../state/native-surfaces.ts";
import { Icon, type IconName } from "./icon.tsx";

interface ButtonStyle {
  variant?: "primary" | "secondary" | "quiet" | "danger";
  size?: "compact" | "small" | "normal";
  class?: string;
}

function buttonClass(props: ButtonStyle) {
  const variant = props.variant ?? "quiet";
  const size = props.size ?? "compact";
  const dimensions =
    size === "normal"
      ? `min-h-10 py-2 ${variant === "quiet" ? "px-2" : "px-4"}`
      : size === "small"
        ? "h-7 min-h-0 px-0 py-0 text-sm font-normal"
        : `min-h-0 py-1 text-sm font-normal ${variant === "quiet" ? "px-0" : "px-3"}`;
  const appearance =
    variant === "primary"
      ? "bg-action text-on-action"
      : variant === "secondary"
        ? `border-control-line bg-transparent text-ink ${
            size === "compact" ? "hover:not-disabled:bg-canvas" : ""
          }`
        : variant === "danger"
          ? "bg-transparent text-danger"
          : `bg-transparent ${
              size === "normal" ? "text-ink" : "text-muted hover:not-disabled:text-ink"
            }`;
  return `inline-flex items-center justify-center gap-2 rounded-control border border-transparent font-medium disabled:opacity-40 ${
    size === "normal" ? "hover:not-disabled:opacity-80" : "hover:not-disabled:opacity-100"
  } ${dimensions} ${appearance} ${props.class ?? ""}`;
}

export function Chip(props: { children: JSX.Element; title?: string }) {
  return (
    <span
      class="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-control-line bg-surface px-3 py-2 text-sm"
      title={props.title}
    >
      {props.children}
    </span>
  );
}

export function Button(props: JSX.ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyle) {
  const [local, native] = splitProps(props, ["variant", "size", "class"]);
  return <button type="button" {...native} class={buttonClass(local)} />;
}

export function LinkButton(props: JSX.AnchorHTMLAttributes<HTMLAnchorElement> & ButtonStyle) {
  const [local, native] = splitProps(props, ["variant", "size", "class"]);
  return <a {...native} class={buttonClass(local)} />;
}

export function IconButton(props: {
  name: IconName;
  label: string;
  toolbar?: boolean;
  disabled?: boolean;
  onClick?(): void;
  expanded?: boolean;
  pressed?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <Button
      variant="quiet"
      size="small"
      type={props.type ?? "button"}
      class="w-7 shrink-0 hover:enabled:bg-canvas aria-pressed:bg-canvas aria-pressed:text-ink"
      aria-label={props.label}
      title={props.label}
      aria-expanded={props.expanded}
      aria-pressed={props.pressed}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      <Icon name={props.name} size={props.toolbar ? "toolbar" : "normal"} />
    </Button>
  );
}

export function Modal(props: {
  title: string;
  close(): void;
  children: JSX.Element;
  wide?: boolean;
  contentClass?: string;
}) {
  let dialog!: HTMLDialogElement;
  occludeNativeSurfaces();
  onMount(() => dialog.showModal());
  onCleanup(() => dialog.close());
  return (
    <dialog
      ref={dialog}
      class="m-auto"
      classList={{ wide: props.wide }}
      onCancel={(event) => {
        event.preventDefault();
        props.close();
      }}
      onClick={(event) => {
        if (event.target === dialog) props.close();
      }}
    >
      <header class="dialog-header">
        <h2>{props.title}</h2>
        <IconButton name="x" label="Close dialog" onClick={props.close} />
      </header>
      <div class={`dialog-content ${props.contentClass ?? ""}`}>{props.children}</div>
    </dialog>
  );
}

export function Field(props: { label: string; hint?: string; children: JSX.Element }) {
  return (
    <label class="field">
      <span>{props.label}</span>
      {props.children}
      <Show when={props.hint}>
        <small>{props.hint}</small>
      </Show>
    </label>
  );
}

export function EmptyState(props: { title: string; children?: JSX.Element }) {
  return (
    <div class="empty-state">
      <div class="depth-mark">f</div>
      <h1>{props.title}</h1>
      <div class="muted">{props.children}</div>
    </div>
  );
}

export function Metric(props: { label: string; value: string | number }) {
  return (
    <div class="mb-3 flex justify-between gap-3 last:mb-0">
      <span>{props.label}</span>
      <span class="text-right">{props.value}</span>
    </div>
  );
}
