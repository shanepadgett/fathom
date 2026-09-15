# Technical Planning Tracker

## Current Focus

Requirements alignment and initial technical planning are complete. The
September 14 production goal authorizes implementation and delegates remaining
decisions. [Implementation](implementation.md) records boundaries, layout,
ordered milestones and direct-use verification. Production delivery is active.
The [desktop development guide](../guides/desktop-development.md) records stable
macOS signing, local identity selection, and native runtime entitlements. Rebuilds
must retain the selected identity rather than silently resetting OS permissions.
Feedback sources retain ownership of their drafts and register preparation and
reconciliation with a project-scoped Cordis coordinator. The coordinator admits
one message with all selected source attachments. RPC integration remains a
separate plugin so the coordinator can be replaced without coupling browser and
artifact implementations. Delivery evidence belongs in the implementation log.
Backend plugin reload now uses the existing Vite/Oxc toolchain to compile a fresh
local module graph while sharing external package dependencies. Source-location
metadata is preserved; dynamic-resolution limits are documented in the
[plugin guide](../guides/plugins.md).
Media persistence now has a project-scoped Cordis service: binary assets live
outside SQLite, and branch-visible timeline entries hold metadata. Provider
generation now starts with Pi's separate image-model collection and its shipped
OpenRouter adapter. An explicit image-model setting controls tool exposure
independently of the chat model. Native OpenAI/Google/xAI adapters remain open.

Community language plugins use the shared backend LSP service and a separate
frontend `registerLanguage` contribution. Frontend syntax is project-scoped;
editor and diff models share the same selection and fallback behavior. Stable
internal Monaco ids are reused across reloads, while tokenizers and editor
configuration belong to the plugin lifecycle. Direct-use evidence is tracked
in the implementation log.
Automatic diagnostics are implemented as a separate Cordis review plugin over
the shared LSP service and existing step continuation hook, with bounded repair
passes and abortable waits. Admission-snapshot comparison now discovers shell
changes alongside built-in file edits; stronger diagnostic freshness remains open.

Work through the three areas below in order, one decision at a time. Record
agreed decisions in `docs/technical/` and keep this tracker current. Existing
requirements in `docs/requirements/` remain the baseline.

The user authorized a separate [local design system scaffold](design-system.md)
in `design/`. Deep teal and the Tech sparse font stack are selected; token
defaults are ready for component review. This does not complete the planning
phase or change the production frontend decision.

The approved [component architecture](component-architecture.md) uses Lit with
visible screen composition. Following the user's cleanup approval, geometry-only
wrappers use native markup, simple fragments use templates, and screen examples
own their state descriptions. Viewer-only tokens are separate from product tokens.
The user explicitly requested no tests: only type checking, building, and direct
visual review remain. The earlier [file boundary migration](design-file-boundaries.md)
is historical context, not a requirement to register every visual grouping.
Production architecture planning remains separate.

The [remaining UI/UX checklist](ui-ux-checklist.md) catalogs requirement-backed
design gaps against the current design source. It separates partial designs,
missing flows, open presentation decisions, and deferred work. Review items one
at a time; this catalog does not authorize implementation or close planning.

## 1. Technologies and Versions

The [delivery audit](delivery-audit.md) compares production code with requirements
and records incomplete workflows independently of the design checklist. Source
inspection of pinned Laufey v0.7.0 confirms native child embedding needs a backend
extension: the CEF constructor always creates a top-level window, and its public
native-handle function returns null. The audit records the ownership contract and
native verification required before replacing the streamed browser. Its
browser/editor integration section identifies the next composition and process
pairing work; earlier browser verification does not close those requirements.

Current decisions are recorded in [technologies.md](technologies.md). Deno
2.9.6, `typebox` 1.3.28, `@earendil-works/pi-ai` 0.85.1, and `cordis` 4.0.0-rc.9
are pinned for planning, with Deno's built-in desktop support. Release-candidate
status for Cordis and Drizzle (1.0.0-rc.4) is accepted. CLI frontend planning
and framework selection are deferred.

- [x] Identify the technologies needed for the full system, including choices
      already set by the requirements.
- [x] Agree on exact versions and verify compatibility using official docs.
- [x] Resolve uncertain choices with focused proofs where needed.
- [x] Record each choice, its purpose, and any remaining constraints.

## 2. Architecture and Repository Layout

- [x] Define process boundaries, responsibilities, and communication paths.
- [x] Define shared code, core services, plugins, and dependency rules.
- [x] Resolve SDK exports, release compatibility, and experience loading.
- [x] Define the target repository and file structure.
- [x] Decide how to reuse or replace `prototype/`.

## 3. Ordered Build Plan

- [x] Break the work into milestones, features, and tasks.
- [x] Record dependencies and completion checks.
- [x] Identify the first working path through server, storage, model, and
      client.
- [x] Check that the plan covers the agreed requirements and marks deferred
      work.

## Completion

- [x] All three planning areas are agreed, with no unresolved blockers.
- [x] Explicitly close this phase and update `AGENTS.md` for the next focus.

Planning is complete. The September 14 goal separately authorizes implementation.
Track delivery and verification in [implementation](implementation.md).

The UI component registry uses framework-independent factories accepting a DOM
container, frontend host and typed props. Each mount returns `update(props)` and
`dispose()`. Built-in factories adapt the existing Solid components; plugins do
not import Solid or copy styling. Built-in names persist across plugin reloads
and are reserved; custom names register through the same registry. The initial
exports are button and text-field, with the remaining UI kit still tracked as
production work. This replaces the unpublished registry's earlier prop-less
ViewMount signature; view slots and surface mounts retain their existing API.
