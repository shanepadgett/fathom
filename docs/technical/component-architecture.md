# Design Component Architecture

The approved design reference uses Lit and Tailwind to show static UI states.
It is not the production frontend. Production architecture planning remains
separate. This cleanup supersedes the earlier requirement that every visual
grouping be a registered component.

Maintenance rules live in the [design standard](../standards/design-system.md).
The [design README](../../design/README.md) explains how to edit and inspect it.

## Composition

Agent, editor, and chat screens visibly compose their headers, sidebars, content,
footers, and optional overlays. Adjacent screen examples own names, descriptions,
stable route IDs, and preview markup. The viewer catalog collects those entries.

Meaningful UI pieces remain registered light-DOM components. Small visual
fragments use Lit templates. Geometry-only wrappers use native markup with
owner-specific CSS, not empty Lit classes. Layouts do not select screen content.

Components accept typed presentation data. Screens and examples select fixtures.
Lit escapes text and attributes; no HTML strings or application services are
needed. Major component trees remain visible in `render()`.

## Styles and behavior

Product tokens stay in `design/tokens.css`. Viewer-only values live in
`design/site/viewer-tokens.css` and do not appear in the product token catalog.
CSS and examples stay beside their owners.

Application actions remain simulated. Named states show menus and overlays.
Sidebar toggling and resizing are local inspection aids. Functional behavior
demos remain isolated from screens.

## Review

The user explicitly requested no tests. Source-rule tests, browser contracts,
and screenshot automation have been removed. Type checking and static builds
remain. Appearance is reviewed directly in the browser, including both themes,
narrow previews, long content, and overlays.
