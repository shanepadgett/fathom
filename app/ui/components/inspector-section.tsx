import type { JSX } from "solid-js";

export function InspectorSection(
  props: { title: string; children: JSX.Element },
) {
  return (
    <section class="border-t border-line pt-4 first:border-0 first:pt-0">
      <h3 class="mb-3 text-muted">{props.title}</h3>
      {props.children}
    </section>
  );
}
