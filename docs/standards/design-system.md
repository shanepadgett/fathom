# Design System

For changes and reviews in `design/`. Skip for reading designs or implementing
application code. This reference does not settle production architecture or
complete technical planning.

- Reuse existing pieces. Tokens own visual values; primitives own basic UI;
  composites group it; layouts own geometry; registered screens visibly compose
  those elements and supply fixtures and states; `site/` owns the viewer.
- Use Lit templates and light-DOM Web Components. Keep major component trees
  visible in `render()`, not hidden behind string builders or layout recipes.
  Small primitive templates are fine; not every span needs a custom element.
- Give each registered component its own tag-named file (omit `ds-` for the base
  controls). Keep private helpers with their owner and import rendered children
  directly. Keep examples and owner-specific CSS beside that owner; `styles.css`
  imports the shared CSS without changing its layers.
- Pass typed presentation data from `models/` through properties. Keep fixtures
  and routes out of components. Let Lit escape text and attributes; do not use
  HTML strings or `unsafeHTML` to compose components.
- Prefer Tailwind scale utilities. Put shared custom values in `tokens.css`;
  avoid arbitrary dimensions. Allow intrinsic, proportional, data-driven, and
  drag-resized values.
- Reuse buttons, Phosphor icons, and state recipes. Preserve accessible names,
  keyboard controls, both themes, and reduced motion.
- Keep app data and actions simulated unless requested. Sidebar toggling and
  shared resizing are allowed; keep standalone behavior demos isolated.
- Update relevant examples and catalog entries. Check realistic content, narrow
  panes, overlays, and both themes.
