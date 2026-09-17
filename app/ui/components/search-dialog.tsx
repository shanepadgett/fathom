import type { JSX } from "solid-js";

import { onCleanup, onMount } from "solid-js";

import { occludeNativeSurfaces } from "../state/native-surfaces.ts";

export function SearchDialog(props: { label: string; close(): void; children: JSX.Element }) {
  let dialog!: HTMLDialogElement;
  occludeNativeSurfaces();
  onMount(() => dialog.showModal());
  onCleanup(() => dialog.close());
  return (
    <dialog
      ref={dialog}
      aria-label={props.label}
      class="search-dialog fixed inset-x-0 top-24 bottom-auto mx-auto my-0 w-search-panel max-w-[calc(100%-2rem)] overflow-hidden rounded-lg border border-line bg-canvas p-0 text-ink shadow-md"
      onCancel={(event) => {
        event.preventDefault();
        props.close();
      }}
      onClick={(event) => {
        if (event.target === dialog) props.close();
      }}
    >
      <section data-component="search-surface" aria-label={props.label}>
        {props.children}
      </section>
    </dialog>
  );
}
