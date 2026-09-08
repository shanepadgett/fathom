# Design System

For changes and reviews in `design/`. Skip for reading designs or implementing
application code. This reference does not settle production architecture or
complete technical planning.

- Reuse existing pieces. Tokens own visual values; primitives own basic UI;
  composites group it; layouts own geometry; screens supply fixtures and states;
  `site/` owns the viewer.
- Pass typed presentation data from `models.ts`. Keep fixtures and routes out of
  components. Escape external content with `text()`; HTML slots are trusted
  only.
- Prefer Tailwind scale utilities. Put shared custom values in `tokens.css`;
  avoid arbitrary dimensions. Allow intrinsic, proportional, data-driven, and
  drag-resized values.
- Reuse buttons, Phosphor icons, and state recipes. Preserve accessible names,
  keyboard controls, both themes, and reduced motion.
- Keep app data and actions simulated unless requested. Sidebar toggling and
  shared resizing are allowed; keep standalone behavior demos isolated.
- Update relevant examples and catalog entries. Check realistic content, narrow
  panes, overlays, and both themes.
