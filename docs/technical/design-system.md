# Local Design System

The user authorized a standalone scaffold in `design/`. It is a local,
code-based design reference and has no dependency on the existing prototypes.
This does not complete technical planning or choose the production UI framework.

## Agreed Structure

- Deno runs the site through `mise run design` and opens a browser.
- TypeScript and light-DOM Web Components provide reusable design pieces.
- Tailwind v4 theme values live in one `tokens.css` file.
- The left drawer can close and reopen. Tokens is a direct page link.
- Components and Screens are expandable lists with individual preview links.
- Home links to Tokens, Components, and Screens.
- Component previews show a name, short description, and live examples.
- The drawer's light/dark switch applies to the entire site.
- Screens compose shared components. Avoid bespoke styles, excessive cards,
  decorative labels, and filler explanations.

## Scaffold Tooling

Deno 2.9.6 runs Vite 8.2.2 with Tailwind CSS and its Vite plugin at 4.3.3.
Vite handles browser TypeScript, CSS compilation, and live updates; no custom
server is needed. These tools are local to `design/`.

## Tokens

- Selected Deep teal from `design/vibe-lab.html`: neutral white/gray surfaces
  in light mode and neutral charcoal surfaces in dark mode. Teal supplies accents.
- Selected Tech sparse: Space Grotesk for UI and prose, Fragment Mono for code.
  Both load from Google Fonts. No separate reading font. Fragment Mono uses
  regular weight; the weight scale previews Space Grotesk.
- `tokens.css` holds color scales and light/dark role mappings. Token previews
  read compiled CSS and group variations into vertical columns.
- Initial defaults include a 4px spacing unit, font sizes and weights, line
  heights, letter spacing, radii, and subtle shadows. These remain adjustable.

## Next

Review the selected tokens on components. The example button is still provisional.
