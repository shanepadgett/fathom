# Design File Boundaries

Status: implemented and verified. Scope is the maintained
`design/` reference, not the prototypes or production frontend. Technical
planning remains active.

## Problem and Agreed Rule

The Lit conversion exposed component trees but kept topic-sized source files.
Nine composite files contained 41 registered components. The layout file contained
another seven. Finding a tag meant searching inside a larger module.

Agreed rule: one independently named component per file, named after its tag.
Keep its registration, properties, private types, and private helpers beside it.
Multiple declarations are not automatically multiple concerns. A component and
its private rendering helper are one concern; a composer and a transcript are not.

Keep the existing layer folders. Split files before considering a different
folder structure. Do not add barrel files that register an entire family when
only one component is needed. Each component imports the children it renders.

## Component Split

Paths below are relative to `design/`. The tables record the original audit names.
Each listed tag now has a same-named `.ts` file in its original folder. These are
existing component boundaries, not new UI components.

| Current file                     | Separate component owners                                                                                                                                               |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `composites/conversation.ts`     | `change-summary`, `run-status`, `message-header`, `tool-activity`, `chat-message`, `message-transcript`, `message-composer`, `conversation-header`, `conversation-pane` |
| `composites/editor.ts`           | `editor-tab`, `editor-tabs`, `file-breadcrumbs`, `code-preview`, `editor-status-bar`, `editor-pane`                                                                     |
| `composites/files.ts`            | `file-item`, `folder-item`, `file-tree`, `changed-files-list`, `files-sidebar`                                                                                          |
| `composites/identities.ts`       | `project-identity`, `branch-identity`, `chat-metadata`                                                                                                                  |
| `composites/inspector.ts`        | `metric-list`, `inspector-section`, `language-server-item`, `session-inspector`                                                                                         |
| `composites/review.ts`           | `diff-preview`, `diff-pane`                                                                                                                                             |
| `composites/search.ts`           | `keyboard-hint-bar`, `search-surface`, `project-search-result`, `chat-search-result`, `project-picker`, `chat-search`                                                   |
| `composites/sessions.ts`         | `chat-list-item`, `chat-list`, `session-sidebar`                                                                                                                        |
| `composites/workspace-chrome.ts` | `focus-switch`, `workspace-header`, `workspace-status-bar`                                                                                                              |
| `layouts/workspace-shell.ts`     | `workspace-shell`, `workspace-layout`, `workspace-body`, `workspace-sidebar`, `workspace-scrim`, `workspace-drawer`, `workspace-overlay`                                |

Keep `messageBlock` with `chat-message`, `treeNode` with `file-tree`, and
`lineColors` with `diff-preview`. The search result frame is genuinely shared by
two result components; give that small template its own file. Keep sidebar
visibility behavior with `workspace-layout`, which owns that geometry.

## Other Mixed Files

These required more than moving class declarations. The boundaries below are
implemented without introducing a general framework. The resizer accepts a
`bounds` callback and emits `edge-resize`; its container owns sizing rules and
push-grid updates. The viewer shares one cleanup signal across its owners.

| Current file                     | Concerns currently together                                                                                                  | Proposed separation                                                                                                                                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `primitives/content.ts`          | Icons, tone styling, status, change counts, meters, keyboard hints, empty states                                             | Separate primitive files. Keep each lookup table with its consumer; keep the shared tone type and map together.                                                                                                |
| `primitives/controls.ts`         | Buttons, icon buttons, project/model selectors, tabs, search field, drawer controls                                          | Separate named controls. Keep `TabItem`, `tab`, and `tabStrip` together as one tab-strip concern.                                                                                                              |
| `components/overlay.ts`          | Registers both modal and drawer; branches between native dialog and push-panel behavior                                      | Separate modal and drawer files. Retain a small shared native-dialog behavior only where both use it. Push-panel handling belongs to the drawer.                                                               |
| `components/edge-resizer.ts`     | Pointer/keyboard resizing plus knowledge of workspace siblings, drawer limits, and push-grid sizing                          | Keep drag, keyboard, ARIA, and cleanup together. Move container sizing rules to the layout or drawer owner. Agree on the smallest explicit boundary before changing this behavior.                             |
| `site/design-app.ts`             | Viewer shell, sidebar persistence, edge reveal, theme switching, route selection, index/detail templates, navigation focus   | Keep startup and coordination in `design-app`. Give viewer sidebar behavior, theme control, route selection, and page templates distinct owners. Keep edge reveal with the sidebar, not in another controller. |
| `site/tokens-view.ts`            | CSS discovery, section definitions, category navigation, samples, color conversion, animation lifecycle                      | Separate token discovery, section definitions, and sample rendering. Keep category state and observer/animation cleanup in the view. Keep color conversion with color samples.                                 |
| `main.ts`                        | Boot mode selection, standalone preview rendering, iframe theme observation                                                  | Keep mode selection here. Move standalone rendering and its parent-theme observation into one preview owner.                                                                                                   |
| `navigation.ts`                  | Entry type, component catalog assembly, all screen metadata                                                                  | Separate the shared entry type and the component/screen catalogs. Keep aggregation declarative.                                                                                                                |
| `composites/catalog.examples.ts` | Primitive examples plus nine unrelated composite example groups                                                              | Move authored examples beside the component they demonstrate. The catalog imports those entries without containing their markup. Preserve existing catalog groups and IDs.                                     |
| `components/motion.examples.ts`  | Modal, drawer, and accordion examples plus their fixture content                                                             | Use separate modal, drawer, and accordion example files. Share only the background fixture used by both overlays.                                                                                              |
| `screens/workspace.examples.ts`  | Both agent and editor example families                                                                                       | Split by screen family. Keep each family's state variants together.                                                                                                                                            |
| `models.ts`                      | Project/chat, file, conversation, inspector, code/diff, and whole-scenario records                                           | Split shared records by subject under `models/`. Keep the whole-scenario type as composition only; avoid a file for every field or union member.                                                               |
| `fixtures/workspace-scenario.ts` | Defines projects, chats, files, messages, inspector data, and assembles the scenario                                         | Move fixture content by subject. Keep this file as the single assembly point so examples still tell one consistent story.                                                                                      |
| `fixtures/code.ts`               | Editor syntax sample and diff sample                                                                                         | Separate code and diff fixtures.                                                                                                                                                                               |
| `styles.css`                     | Global setup, base rules, composer effects, workspace geometry, viewer navigation, resize handles, and push-drawer overrides | Keep the global entry and base rules. Move owner-specific rules to adjacent CSS files, imported centrally in the same order and layers.                                                                        |
| `components/motion.css`          | Shared dialog transitions, modal/drawer layout, push-panel geometry, accordion rules                                         | Separate shared dialog transitions from drawer and accordion rules. Move push-drawer overrides here from the global stylesheet before separating owners.                                                       |
| `verification/contracts.ts`      | One function tests primitives, file trees, code text, screen composition, and preview isolation                              | Split checks by subject; retain one browser entry that runs them all and shares mounting/cleanup.                                                                                                              |
| `verification/browser.py`        | Browser driver, viewer navigation, workspace captures, catalog checks, resizing, token checks, behavior demos                | Keep one runner and shared browser driver; move scenario groups into focused modules. Preserve test coverage and screenshot names.                                                                             |

## Files That Can Stay Together

- `screens/agent-screen.ts` and `screens/editor-screen.ts` each own one screen's
  composition. Optional panes are states of that screen, not unrelated concerns.
- `site/navigation.ts` renders one navigation tree; its row/group helpers belong
  there. `site/screen-return.ts` owns one return-link behavior.
- `components/button.ts`, `components/accordion.ts`, and
  `components/design-element.ts` each have one clear owner. Their lifecycle
  methods do not need separate files.
- `verification/components_test.ts` checks source architecture rules. Keep those
  rules together rather than create a file for each assertion.
- `tokens.css` is the shared token source. Its theme variants belong together.
  `vibe-lab.html` is an archived experiment, outside this migration.

## Staged Plan

- [x] Agree on boundaries and supersede the topic-module architecture choice.
- [x] Split the 41 composites, seven layout elements, and primitive controls.
- [x] Separate models, fixtures, examples, and catalog metadata.
- [x] Separate viewer behavior, token inspection, overlays, preview startup,
      resizer sizing rules, and owner-specific styles.
- [x] Align source checks, browser checks, README, architecture, and standards.

## Verification Result

`deno task check` and `deno task build` pass. The browser suite passes all 55
isolated module loads, existing component contracts, four viewer combinations,
32 workspace/theme/width combinations, 11 catalog cases, nine resize cases,
edge reveal, token updates, reduced motion, and modal/accordion behavior.

All 60 screenshots match the fresh baseline exactly. Capture setup now resets
viewer width and sets the pointer explicitly. Text escaping ignores only
surrounding layout whitespace. Code checks remain exact and also check line
positions: the preview now preserves whitespace per code line rather than
letting formatter whitespace inside the parent create blank lines.

No application state system, rendering abstraction, or production framework
decision was added. Broader technical planning remains active.
