# Design Component Architecture

Ongoing maintenance rules live in the
[design system standard](../standards/design-system.md). Read it when changing
`design/`; using designs as implementation references does not require it. This
document retains the decision history and architectural background.

Implemented in the local design reference on September 7, 2026, following the
approved decomposition and token policy. The original six screens now compose
shared components; a seventh Editor Changes screen replaces interactive panel
switching. This does not choose a production frontend framework.

The implementation uses `primitives/`, grouped modules in `composites/`,
`layouts/`, shared `models.ts`, and `fixtures/`. `screens/workspace.ts` contains
only fixture imports and state compositions. The existing `ds-button` system now
supports compact controls. Catalog entries are grouped into Primitives,
Composites, and isolated Behavior demos.

Verification covers escaping, data-derived meters, explicit tree states, shared
screen composition, and the prohibition on arbitrary numeric utilities. The
browser hook checks all seven routes in both themes and two viewport sizes.

## Direction

Use four layers: foundations, primitives, composites, and screens. Call the
large reusable pieces **composites**, with layout composites as a subset. “Meta
component” does not need a separate meaning or directory.

Screens should select fixtures, assemble composites, and declare a visible
state. They should contain almost no raw markup or styling. A new screen should
usually be a new composition of existing pieces, not a copy of another screen's
HTML.

Maximal reuse means a visual decision has one owner. It does not mean every span
needs a component. Extract a piece when it owns a recognizable visual contract,
semantics, repeated structure, or an independently reviewable state. Keep
ordinary wrappers and typography inside the component that owns them.

## Baseline Findings Before Extraction

| Area             | Current implementation                                                 | Consequence                                                                                                 |
| ---------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Workspace        | Two large template functions in `design/screens/workspace.ts`          | Header, frame, pane geometry, and overlay structure can diverge.                                            |
| Conversation     | Shared `transcript` and `composer` strings                             | Recent composer changes propagate, but messages, tool activity, and controls cannot be reviewed separately. |
| Search overlays  | Separate `projectPicker` and `chatSearch` templates                    | Backdrop, surface, search line, selected row, and keyboard footer duplicate styling.                        |
| Sidebar          | Shared `sessionSidebar` string with embedded fixtures                  | Consistent across agent variants, but search results duplicate chat metadata and sample data.               |
| Files            | `fileRow` and `folderRow` helpers                                      | Good initial boundaries; Changes still uses older, looser rows without the same icons.                      |
| Buttons          | `ds-button` exists; workspace controls use inline utilities            | Existing 40px button minimum does not cover compact workspace controls.                                     |
| Icons            | Phosphor mixed with text glyphs                                        | Attach, Stop, message checkmark, tab close, and overflow have inconsistent rendering.                       |
| Static states    | Search overlays are static; files use radios and folders use `details` | The requested static-screen convention is not fully consistent yet.                                         |
| Inspector/editor | Inline inside screen function                                          | Substantial reusable regions have no independent preview or ownership.                                      |
| Viewer           | `design/site/design-app.ts` owns routes, theme, navigation             | Keep this infrastructure distinct from the workspace being illustrated.                                     |

The existing code comment says screens are not shared application components.
That remains compatible with sharing design components: extract the design
language without introducing server state, chat actions, or a production editor.

## Foundations

Use Tailwind utilities backed by the design system as the default for all
appearance and geometry. No raw pixel dimensions, inline style literals, or
arbitrary numeric utilities in component or screen markup. The measurements
previously listed here described the current visual baseline; they were not an
instruction to hardcode those measurements.

Use an existing Tailwind scale utility when it expresses the decision. Define a
named token in `tokens.css` when the scale does not cover it or when a semantic
contract must be adjustable across several components. Do not create aliases for
every ordinary padding or gap: `p-4`, `gap-2`, and `h-9` already use the shared
spacing system.

| Contract                     | Proposed token-backed expression                  |
| ---------------------------- | ------------------------------------------------- |
| Dense file row               | `h-6`; `text-dense` for the custom label size     |
| Small metadata               | `text-micro`                                      |
| Compact tabs and breadcrumbs | `h-9`                                             |
| Workspace header/footer      | `h-12` / `min-h-12`                               |
| Search header                | `h-14`                                            |
| Conversation header          | `h-16` main; `h-12` drawer                        |
| Chat/inspector sidebar       | `w-sidebar`; shared named spacing token           |
| File sidebar                 | `w-files-sidebar`; named spacing token            |
| Drawers                      | `w-diff-drawer` / `w-conversation-drawer`         |
| Search surface               | `w-search-panel`; `pt-24` for its placement       |
| Transcript measure           | `max-w-transcript`                                |
| Design preview frame         | `h-workspace-preview` / `min-w-workspace-minimum` |
| Overlay blur                 | `backdrop-blur-workspace`                         |

These custom utilities are implemented through theme tokens. Declare new values
through the appropriate Tailwind theme namespaces in `tokens.css`, such as
`--text-dense`, `--spacing-sidebar`, `--container-transcript`, and
`--blur-workspace`. Use rem-based dimensions and derive spacing-related values
from the base spacing token where appropriate. Literal values belong in the
token definitions, where they can be reviewed and adjusted centrally.

Layout composites own which tokens they use, not private numeric definitions.
Preview geometry is tokenized too, but its tokens remain explicitly scoped to
preview use rather than becoming application sizing requirements.

Apply this rule to typography, line heights, icon sizes, indentation, borders,
radii, shadows, opacity, layering, and motion as well as width and height.
Existing Tailwind utilities are preferred; custom values require named tokens.
Arbitrary selectors for state styling are fine. A token reference is acceptable
when a standard utility cannot express it; an arbitrary numeric value is not.

Exceptions are intrinsic layout values such as `auto`, `min-content`,
percentages for proportional layout, and data-driven values such as meter fill.
Derive meter fill from its value and maximum rather than hardcoding a decorative
fraction. Document any additional exception at its owner rather than silently
introducing a one-off number.

Define shared recipes for selected, hover, focus, disabled, and semantic status
appearance. Selection, keyboard focus, and running status are separate states;
one `active` boolean must not stand for all three.

## Primitive Inventory

| Primitive             | Owns                                                         | Inputs or slots                                                 |
| --------------------- | ------------------------------------------------------------ | --------------------------------------------------------------- |
| Icon                  | Approved Phosphor names, size, decorative treatment          | Name, size; accessible label belongs to enclosing control       |
| Button                | Native button, variant, compact sizing, focus/disabled style | Label/content, leading/trailing icon, size, variant, disabled   |
| IconButton            | Square Button with required accessible name                  | Icon, label, size, selected/pressed appearance where applicable |
| SelectorButton        | Button with value and trailing caret                         | Primary value, optional secondary value, size                   |
| StatusDot             | Status color and accessible equivalent                       | Status, label when no adjacent text supplies it                 |
| ChangeStatus          | Git status abbreviation and meaning                          | Added, modified, deleted, renamed, untracked                    |
| DiffStat              | Consistent additions/deletions formatting                    | Additions, deletions, compact or labeled presentation           |
| Meter                 | Track/fill geometry and accessible range                     | Value, maximum, accessible label                                |
| Keycap / ShortcutHint | Key appearance and key-to-action spacing                     | Keys and action label                                           |
| TabStrip / Tab        | Shared tab appearance                                        | Items, selected ID, optional icon/trailing content              |
| SearchFieldPreview    | Search line, simulated caret, placeholder                    | Placeholder, optional icon/scope, focused visual state          |
| EmptyState            | Restrained title/message in an empty region                  | Message, optional explanatory text                              |

Do not create global `MutedText`, `FlexRow`, `Padding`, or `Border` components.
They obscure markup without centralizing a meaningful decision. Truncation is a
shared recipe applied by row components, not a wrapper around every label.

Tab appearance can be shared without falsely claiming working keyboard tab
behavior in a static mockup. Keep native buttons with a visible selected state;
reserve the full ARIA tab interaction contract for a future behavioral adapter.
Likewise, the search preview is not a functioning text input or search
controller.

## Small Composites

| Composite           | Composition and responsibility                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| ProjectIdentity     | Folder icon and truncated project name; optional location on a second line                                            |
| BranchIdentity      | Branch icon and truncated branch name                                                                                 |
| ChatMetadata        | Project/branch/time arrangement for a named presentation                                                              |
| ChatListItem        | Sidebar presentation: project/time, one-line title, branch/status; selected and run status supplied separately        |
| ChatSearchResult    | Search presentation: chat icon, one-line title, metadata, trailing time; reuses identities, not sidebar card geometry |
| ProjectSearchResult | Project identity with local path and optional shortcut                                                                |
| FileItem            | File icon, truncated name, Git status; flat or tree placement supplied by parent                                      |
| FolderItem          | Disclosure icon, folder icon, label; expansion supplied as static state                                               |
| EditorTab           | Tab appearance plus filename, dirty/change marker, close IconButton                                                   |
| Breadcrumbs         | Path segments, separators, current item; owns the compact bar height                                                  |
| MessageHeader       | Author, role treatment, timestamp                                                                                     |
| ToolActivity        | Tool label, status icon, duration, detail content                                                                     |
| ChangeSummary       | File count, DiffStat, optional explanatory text                                                                       |
| RunStatus           | StatusDot and run text                                                                                                |
| InspectorSection    | Section heading and separator/spacing rules                                                                           |
| MetricList          | Semantic description list with aligned labels and values                                                              |
| LanguageServerItem  | Server name and connection state                                                                                      |
| EditorStatusBar     | Problems summary, position, encoding, language                                                                        |
| KeyboardHintBar     | Thin footer composing ShortcutHint items                                                                              |

Use a private row-frame recipe for common leading/body/trailing geometry where
helpful. Do not force chats, project results, and tree nodes through a public
universal row API with many flags. Their content hierarchy is intentionally
different.

## Major Composites

| Composite          | Children                                                             | Owns                                                                                         |
| ------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| WorkspaceHeader    | Brand/project context, FocusSwitch, drawer control                   | Top chrome and focus indication                                                              |
| WorkspaceStatusBar | RunStatus, ChangeSummary count, Meter                                | Footer alignment and usage formatting                                                        |
| SessionSidebar     | Search button, new-chat IconButton, project SelectorButton, ChatList | Compact chat navigation region                                                               |
| FilesSidebar       | TabStrip, FileTree or ChangedFilesList                               | Files/Changes composition and selected section                                               |
| FileTree           | FolderItem, FileItem, nested groups                                  | Indentation, guides, visible expansion, dense rows                                           |
| ChangedFilesList   | ChangeSummary, FileItem collection                                   | Same file identity/status treatment as tree, without indentation                             |
| ConversationPane   | ConversationHeader, Transcript, Composer                             | Main or drawer presentation and scroll ownership                                             |
| Transcript         | Message collection                                                   | Reading width, spacing, message sequence                                                     |
| Message            | MessageHeader and typed content blocks                               | Author-specific presentation; body can include prose, ToolActivity, ChangeSummary, RunStatus |
| Composer           | Prompt area, attach Button, model SelectorButton, Stop Button        | Floating border/radius, interior spacing, toolbar layout                                     |
| SessionInspector   | InspectorSections, metrics, servers, environment                     | Supporting information rail                                                                  |
| EditorPane         | EditorTabs, Breadcrumbs, CodePreview, EditorStatusBar                | Editor region and code scrolling                                                             |
| CodePreview        | Line gutter and authored code lines                                  | Static code sample presentation, never an editor engine                                      |
| DiffPane           | Header, file context, DiffStat, DiffPreview                          | Diff review presentation                                                                     |
| DiffPreview        | Context/added/deleted lines                                          | Shared line metrics and semantic diff treatment                                              |
| ProjectPicker      | SearchSurface, ProjectSearchResults                                  | Project selection content and hints                                                          |
| ChatSearch         | SearchSurface, ChatSearchResults                                     | Chat search content and hints                                                                |

Composer stays floating with full rounded corners and outside horizontal/bottom
spacing. Model text is “Claude Sonnet · Medium” with a dropdown affordance.
ConversationPane owns the outer composer inset; Composer owns the actual
surface. Do not keep obsolete attached/floating variants unless a screen needs
both.

CodePreview and DiffPreview can share internal line/gutter recipes, but should
remain different public composites. Diff line signs, dual line numbers, and
change backgrounds are not ordinary editor decoration.

## Layout Composites and Screen Assembly

`WorkspaceShell` takes header, leading pane, primary pane, optional trailing
pane, footer, optional full-height drawer, and optional workspace overlay. It
owns flex sizing, shrink constraints, borders between regions, and the two
overlay coordinate spaces.

`WorkspaceDrawer` spans the complete app height, covering the header and footer
within its width. The app title bar owns the open control; the drawer header
owns the reverse-direction close control. `WorkspaceOverlay` covers the complete
workspace, never the design site's title, navigation, or viewport. It owns
dimming and blur. `SearchSurface` owns search header, results slot, and compact
keyboard footer. It does not own the backdrop.

The shell accepts already composed regions, not `isEditor` conditionals that
construct their contents. Two layout recipes choose the regions:

```text
AgentWorkspace
  WorkspaceShell
    WorkspaceHeader
    SessionSidebar | ConversationPane | SessionInspector
    WorkspaceStatusBar
    optional WorkspaceDrawer(DiffPane)
    optional WorkspaceOverlay(ProjectPicker or ChatSearch)

EditorWorkspace
  WorkspaceShell
    WorkspaceHeader
    FilesSidebar | EditorPane
    WorkspaceStatusBar
    optional WorkspaceDrawer(ConversationPane)
```

| Existing route             | Recipe          | Explicit visible state              |
| -------------------------- | --------------- | ----------------------------------- |
| agent-focus                | AgentWorkspace  | Base                                |
| agent-focus-drawer         | AgentWorkspace  | Diff drawer                         |
| agent-focus-project-picker | AgentWorkspace  | Project picker                      |
| agent-focus-chat-search    | AgentWorkspace  | Chat search                         |
| editor-focus               | EditorWorkspace | Files selected                      |
| editor-focus-drawer        | EditorWorkspace | Files selected, conversation drawer |

Prefer a discriminated state such as `base`, `diff`, `projects`, or
`chat-search` to unrelated booleans that permit unintended overlapping states.
Add combined states only when explicitly designed. Add an Editor Changes screen
during migration to preserve that existing view without interactive radio
switching.

Each screen module should be roughly a fixture import and one layout recipe
call. It may select state and regions; it should not specify border colors,
button padding, file-row markup, or overlay positions.

## Data and Component Contracts

Move sample projects, chats, files, messages, usage, and code into `fixtures/`.
Use stable IDs so the selected chat, conversation title, selected file, change
counts, and footer describe the same scenario. Sidebar/search results should
reference the same chat records while selecting different presentation subsets.

Keep fixture data separate from presentation state. A chat has an ID, title,
project, branch, and status; a screen chooses its selected chat ID. A file has
Git status; the tree chooses expanded folder IDs and selected file ID.

Prefer typed, pure rendering functions for static compositions in this scaffold.
Keep light-DOM Web Components where they provide an existing useful contract,
such as `ds-button`; do not require a custom element and lifecycle for every
row. This is an implementation within the local design system, not a change to
the undecided production UI framework.

Use explicit content slots for headers, body, actions, and trailing metadata.
Use data props for repeated records. Avoid arbitrary class overrides as the
public API; expose a small named presentation only when a current composition
needs it. Native text/attribute escaping belongs in the shared rendering
boundary before fixtures are interpolated. Raw markup slots must remain locally
authored trusted content; they must never accept arbitrary project or chat text
as HTML.

Dependency direction is foundations → primitives → composites → layouts →
screens. Fixtures feed screens and examples. Components never import screen
routes or the navigation registry. The registry imports screen entries.
Navigation links between design states belong to the viewer or an explicit
preview adapter.

## Static Design Policy

All workspace states are rendered directly from props. New chat, search, model,
attach, and Stop controls retain their button appearance and semantics but have
no application action. Search does not filter, folders do not toggle, and tabs
do not switch panels inside a screen. Review another state through another
example or route. Do not make controls look disabled merely because this is a
study.

Folder expansion and Files/Changes selection now use explicit static rendering.
The earlier native `details` and radio state changes have been removed from
workspace screens.

The design viewer may still navigate and change theme. Existing interactive
modal/drawer/accordion component demos should be clearly separated as behavior
demos pending a decision about retaining them. They must not be embedded as
controllers in workspace screens. Share overlay surface styling with static
previews; do not use `showModal()` to display a workspace study.

Future production behavior should attach through separate adapters: real search
input, focus management, keyboard tree navigation, menu behavior, editor engine,
and application state. Static previews do not prove those behaviors work.

## Ownership Map

```text
design/
  tokens.css
  primitives/       icon, button, selector, status, meter, tabs, keycap
  composites/
    shared/         identities, search-surface, keyboard-hint-bar
    sessions/       chat-list-item, chat-search-result, session-sidebar
    files/          file-item, folder-item, file-tree, changed-files-list
    conversation/   message, transcript, composer, conversation-pane
    editor/         editor-tabs, breadcrumbs, code-preview, editor-pane
    review/         change-summary, diff-preview, diff-pane
    inspector/      metric-list, inspector-section, session-inspector
    workspace/      workspace-header, workspace-status-bar
  layouts/          workspace-shell, workspace-drawer, workspace-overlay,
                    agent-workspace, editor-workspace
  models.ts         typed presentation contracts
  fixtures/         workspace-scenario
  screens/          explicit compositions for each visible state
  site/             viewer and preview navigation
  navigation.ts
```

Keep tightly coupled helpers in their owning module initially; this is an
ownership map, not a requirement for a file per function. Migrate existing
`components/` exports deliberately rather than maintain parallel button/overlay
libraries. Component examples should live beside their components and register
under foundation, primitive, and composite categories in the viewer.

## Extraction Sequence and Verification

1. Capture all six current screens in both themes, including the lower composer
   region. Record current dimensions and intentional differences. Extract shared
   fixtures without changing visuals.
2. Establish the missing theme tokens and replace arbitrary numeric utilities.
   Establish compact Button/IconButton/SelectorButton, Icon, status, meter, and
   keyboard hint contracts. Replace remaining Unicode control glyphs with
   Phosphor icons. Preserve glyphs where they are actual keyboard labels.
3. Extract SearchSurface and both result types. Verify caret touches
   placeholder, no back arrow, thin footer, and backdrop confined to the
   workspace.
4. Extract WorkspaceShell/header/footer and both overlay containers. Reassemble
   all routes and verify pane widths, footer visibility, scrolling, and
   layering.
5. Extract conversation, composer, inspector, and sidebar composites. Preserve
   the floating composer and ellipsized titles in main and drawer contexts.
6. Extract tree, changes, editor, and diff composites. Align Changes rows with
   dense FileItem styling; show Changes as its own static screen. Represent
   folder expansion through fixtures.
7. Reduce screen modules to compositions. Remove superseded local templates and
   duplicate recipes. Update the catalog and document each component's owner,
   inputs, examples, and intentional variants.

Run the repository verification hook after each coherent migration batch. Add
visual comparison coverage to that workflow when extraction starts: all routes,
light/dark, wide and narrow preview containers. Narrow previews should retain
the current horizontal-scroll behavior rather than silently introduce a
redesign.

Targeted assertions should verify shared compositions appear on every applicable
route, overlays stay within their containing frame, dense file rows retain their
token-defined height, and long titles/paths truncate without pushing trailing
status offscreen. Test multiple previews together to catch duplicate IDs or
shared radio names. Verify static controls do not open global dialogs or mutate
application state.

Add component examples for selected/unselected rows, long text, empty results,
different Git statuses, usage near capacity, and narrow composer toolbars. These
are focused coverage examples, not a mandate to invent every conceivable screen
state. New error/loading/disabled designs should be reviewed before being
treated as approved baseline.

Completion means all six existing screens compose the same reusable regions;
each repeated visual rule has one owner; visual values use Tailwind scale
utilities or named theme tokens; sample data is consistent; intentional variant
differences are named; and the approved baseline survives extraction.

## Implementation Boundaries

Static render functions, shared scenario fixtures, semantic tokens, and
slot-based workspace layouts are implemented. Closely related components share
modules rather than requiring a file per function. The native button remains
wrapped by the existing light-DOM component so there is one button styling
system.

The existing interactive overlay/accordion demos remain under Behavior demos.
Workspace screens never invoke them. Production keyboard navigation, focus
traps, search behavior, editor integration, and application state remain outside
this static design reference.
