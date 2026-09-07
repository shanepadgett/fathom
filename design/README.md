# Design

Run `mise run design` from the repository root. The site opens at
`http://127.0.0.1:5175`. Stop it with Ctrl+C.

This is a standalone design reference, not part of the existing prototypes. Deno
runs Vite, which builds TypeScript and Tailwind v4 and updates the browser.

Styling is Tailwind-first. Theme tokens live in `tokens.css` via `@theme`.
Markup uses utilities from those tokens. Custom CSS is only for base resets and
web component hooks that utilities cannot express. Dark mode uses
`data-theme="dark"` with `@custom-variant dark` and role token overrides.

- `tokens.css`: theme values (`@theme static`) and light/dark role aliases.
- `components/`: shared light-DOM Web Components and their preview cases.
- `screens/`: design-specific compositions of those components.
- `navigation.ts`: names, descriptions, and preview entries for the drawer.
- `site/`: the viewer, not a second component library.

Add a component module to `main.ts`, its CSS import to `styles.css` only if the
component needs a small hook stylesheet, and its examples to `navigation.ts`.
Screens use the same elements and register in the `screens` array. Markup in
this registry is trusted, locally authored HTML. Token previews read the
compiled CSS rather than copying values into TypeScript.

`ds-button` wraps a native `<button>`; put labels, disabled state, accessibility
attributes, and event handlers on that native button. `variant` belongs on the
wrapper. The viewer uses the same component as the previews.

Keep screens to composition. Shared appearance belongs in tokens or utilities.
Prefer type, spacing, and simple rows to cards. No filler copy.

Motion values live in `tokens.css`. Use `duration-(--motion-duration-normal)`
and `ease-standard` in Tailwind, or reference the same variables in component
CSS. Shared components own animation behavior; screens do not invent motion.
Reduced motion sets all motion durations to zero.

`ds-modal` and `ds-drawer` wrap a native `dialog`. Supply a `data-open` button,
an accessible dialog label, content, and a `data-close` button. Native dialogs
handle focus and Escape. `closedby="any"` enables backdrop dismissal in browsers
that support it. `ds-accordion` wraps direct `details` children with `summary`
labels and content inside a `div`. Add `multiple` to allow several sections
open. Accordion height animation uses modern CSS; older browsers toggle
instantly.

From `design/`, run `deno task check` or `deno task build` to check the
scaffold.
