import { children, createEffect, createUniqueId, type JSX } from "solid-js";

/** Native details provide keyboard behavior; name scopes single-open groups. */
export function Accordion(props: {
  multiple?: boolean;
  children: JSX.Element;
}): JSX.Element {
  const group = `accordion-${createUniqueId()}`;
  const resolved = children(() => props.children);

  createEffect(() => {
    for (const item of resolved.toArray()) {
      if (!(item instanceof HTMLDetailsElement)) {
        continue;
      }

      if (props.multiple) {
        item.removeAttribute("name");
      } else {
        item.setAttribute("name", group);
      }
    }
  });

  return <div class="fathom-accordion">{resolved()}</div>;
}
