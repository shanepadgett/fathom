# Local Design System

Ongoing maintenance rules live in the
[design system standard](../standards/design-system.md). Read it when changing
`design/`; using designs as implementation references does not require it. This
document retains the decision history and architectural background.

The user authorized a standalone scaffold in `design/`. It is a local,
code-based design reference and has no dependency on the existing prototypes.
This does not complete technical planning or choose the production UI framework.

## Agreed Structure

- Deno runs the site through `mise run design` and opens a browser.
- TypeScript and Lit-based light-DOM Web Components provide reusable design pieces.
- Tailwind v4 theme values live in one `tokens.css` file.
- The left drawer can close and reopen. Tokens is a direct page link.
- Components and Screens are expandable lists with individual preview links.
- Home links to Tokens, Components, and Screens.
- Component previews show a name, short description, and live examples.
- The drawer's light/dark switch applies to the entire site.
- Screens compose shared components. Avoid bespoke styles, excessive cards,
  decorative labels, and filler explanations.

## Scaffold Tooling

Deno 2.9.6 runs Vite 8.2.2 with Tailwind CSS and its Vite plugin at 4.3.3. Vite
handles browser TypeScript, CSS compilation, and live updates; no custom server
is needed. Lit 3.3.1 supplies declarative templates and component properties.
These tools are local to `design/`.

## Tokens

- Tailwind-first, token-backed styling is required throughout components and
  screens, including heights, widths, and preview geometry. Use existing scale
  utilities when suitable; define named theme tokens for custom values. Keep
  numeric literals in token definitions, not arbitrary utilities or inline
  styles. Layout components select tokens rather than defining private
  dimensions.

- Selected Deep teal from `design/vibe-lab.html`: neutral white/gray surfaces in
  light mode and neutral charcoal surfaces in dark mode. Teal supplies accents.
- Selected Tech sparse: Space Grotesk for UI and prose, Fragment Mono for code.
  Both load from Google Fonts. No separate reading font. Fragment Mono uses
  regular weight; the weight scale previews Space Grotesk.
- `tokens.css` holds color scales and light/dark role mappings. Token previews
  read compiled CSS and group variations into vertical columns.
- Initial defaults include a 4px spacing unit, font sizes and weights, line
  heights, letter spacing, radii, and subtle shadows. These remain adjustable.

## Component Architecture

The [component architecture](component-architecture.md) is implemented in the
local reference. Registered screens visibly compose custom elements and select
fixtures and explicit static states. Shared primitives and composites own
appearance; layout elements own geometry, not screen content. The catalog
includes isolated component examples and eight workspace states.

The native button wrapper is shared by the compact controls. Existing
interactive modal, drawer, and accordion demos are grouped as Behavior demos;
workspace screens do not use their controllers. This remains separate from
production framework and application architecture decisions.
