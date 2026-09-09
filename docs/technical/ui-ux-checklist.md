# Remaining UI/UX Design Checklist

Cataloged on 2026-09-08 against `docs/requirements/` and the maintained
`design/` source. This tracks design work, not implementation. Requirement
tracker checkmarks mean scope was agreed, not that the UI is designed.

## How to Use

- Work through one checkbox at a time. IDs stay stable for discussion.
- Check an item only after its layout, actions, and relevant states are reviewed
  and linked to examples in `design/`.
- **Partial** means an existing design is a starting point, not a complete flow.
- **Missing** means no dedicated example was found in the maintained catalog
  or relevant components. This is a source audit, not a browser usability test.
- **Decision** marks a UI choice inferred from a requirement or newly requested;
  it is not an already agreed product requirement.
- **Deferred** items remain visible but retain their existing planning deferral.

For each item, cover applicable empty, loading, success, failure, and interrupted
states. Include keyboard/focus behavior, narrow layouts, and both themes in its
review rather than treating a happy-path screenshot as finished.

## Existing Starting Points

The current [screen catalog](../../design/site/screen-catalog.ts) has 13 entries
across agent, editor, and chat screen families. It includes project selection,
new-session and search overlays, context menus, context usage, and drawers.
`design/README.md` still describes an older eight-state baseline.

- Session navigation: `session-sidebar`, `project-picker`, `new-session`,
  `chat-search`, and thread/conversation menus.
- Conversation: `chat-message` renders plain paragraphs, compact tool/research
  summaries, file-change summaries, and status text. It is not yet a rich
  transcript renderer.
- Composer: an attach-context button, model/thinking label, and Stop button.
  Steer/follow-up appears as placeholder text, not a designed submission flow.
- Code review: file tree, editor tabs, code preview, changed files, and diff pane.
- Observability: session metrics, language-server names, context meter and
  breakdown. These are not yet the full inspector or reporting flows.

These foundations do not need to be redesigned from scratch. Menu labels such
as “Fork” and “View thread tree” do not count as designs of their destinations.

## 1. Transcript Content

Sources: [Frontend §§5, 7, 8](../requirements/frontend-and-ux.md),
[Model gateway §3](../requirements/model-gateway-and-routing.md),
[Plugins §10](../requirements/extensibility-and-plugins.md).

- [ ] **CHAT-01 · Partial:** Markdown message samples: headings, lists, links,
      quotes, tables, and syntax-highlighted code blocks. Include long content
      and incomplete Markdown during streaming.
- [ ] **CHAT-02 · Decision:** Mermaid diagrams, requested in this discussion.
      Decide inline versus viewer presentation, source access, and invalid
      diagram handling. Requirements already put large SVG diagrams and full
      documents in the artifact viewer; Mermaid itself is not specified.
- [ ] **CHAT-03 · Missing:** Thinking blocks while streaming, automatic collapse
      on completion, duration, and manual expansion.
- [ ] **CHAT-04 · Missing:** Images and GIFs with zoom; audio/video players with
      playback, scrubbing, and download. Include unavailable media states.
- [ ] **CHAT-05 · Missing:** Generated-image cards with preview, copy, and export;
      distinguish cached media from files saved into the workspace.
- [ ] **CHAT-06 · Missing:** Structured warning/error cards and retry/inspect
      actions. Distinguish these from ordinary agent text and tool output.
- [ ] **CHAT-07 · Missing:** Plugin/custom entry examples and plain text/JSON
      fallback when no renderer matches. Define shared card behavior without
      requiring a bespoke design for every future plugin.
- [ ] **CHAT-08 · Partial:** Streaming and scroll behavior: following the latest
      output, detached reading, incoming activity, and Jump to bottom.
- [ ] **CHAT-09 · Partial:** Detailed versus summarized runs, parallel tool
      groups, expansion, and modified-file counts with hover list and diff links.

## 2. Tool Execution Blocks

Sources: [Tools §§2–10](../requirements/tools-and-execution.md),
[Frontend §§5, 7](../requirements/frontend-and-ux.md).

- [ ] **TOOL-01 · Partial:** Shared execution card across pending, running,
      completed, error, and aborted states. Include arguments, duration,
      expandable output, bounded scrolling, and resize handles.
- [ ] **TOOL-02 · Partial:** `read`, `write`, and `edit` presentations: file/range
      links, read windows, edit diffs, hashline context, and stale-file conflicts.
- [ ] **TOOL-03 · Missing:** `bash` command, streamed stdout/stderr, exit code,
      timeout, cancellation, and handoff to a background terminal.
- [ ] **TOOL-04 · Missing:** `script` runtime, script inspection, patch/retry
      history, output, and failures. Reuse the shared execution card.
- [ ] **TOOL-05 · Missing:** `pty` list/read/write/kill summaries and links to the
      live process panel. Keep tool history distinct from an interactive terminal.
- [ ] **TOOL-06 · Partial:** Deferred tools and research: `search_tools`,
      `search_web`, `read_url`, direct MCP calls, and scripted MCP output.
      Decide which need specialized views versus the standard fallback.
- [ ] **TOOL-07 · Missing:** `consult_expert` and research child-session cards:
      progress, concise result, follow-up continuity, and Inspect Expert Thread
      or equivalent child-thread navigation.
- [ ] **TOOL-08 · Missing:** Large-output head/tail preview, truncation notice,
      and Open Full Log into the editor.

## 3. Composer and Run Control

Sources: [Frontend §7](../requirements/frontend-and-ux.md),
[Architecture §5](../requirements/architecture-and-persistence.md),
[Context §§8–9](../requirements/context-and-memory.md).

- [ ] **INPUT-01 · Partial:** Idle submission versus active-run Steer/Follow-up;
      Enter default, explicit alternate action, injected-message marker, and
      queued-message display. Decide queue editing/cancellation behavior.
- [ ] **INPUT-02 · Partial:** Stop, retry countdown/attempts, steer during retry,
      aborted/error state, and Continue without a new prompt.
- [ ] **INPUT-03 · Decision:** Define what the existing Attach context button
      accepts, how selections are previewed/removed, and how it relates to the
      required annotation tray and reference repositories.
- [ ] **INPUT-04 · Missing:** Slash-command discovery for prompts and user-invoked
      skills; unavailable commands in Restricted Mode; pre-execution progress,
      timeout, and failure output without losing the submitted prompt.
- [ ] **INPUT-05 · Missing:** Disconnect/reconnect and server-interruption states.
      Explain when work is still running versus halted and ready to Continue.

## 4. Artifacts and Planning

Source: [Frontend §8](../requirements/frontend-and-ux.md).

- [ ] **ART-01 · Missing:** ArtifactCard with title, type, size, Pending Review,
      Approved, and Superseded states; Open in Viewer and plan approval actions.
- [ ] **ART-02 · Missing:** Docked artifact viewer for Markdown plans, code,
      diagrams, and sandboxed interactive HTML/widgets. Establish the boundary
      between ordinary chat content and viewer-only content.
- [ ] **ART-03 · Missing:** Plan review → batched feedback → revision → approval
      → agent execution. Show which revision is being approved and what happens
      to a superseded plan.
- [ ] **ART-04 · Missing:** Highlight sections, comment, review staged feedback,
      and submit a single revision request through the shared annotation tray.
- [ ] **ART-05 · Missing:** Materialize into Workspace: destination selection,
      existing-file handling, result, and the distinction between the stored
      artifact and its workspace copy.

## 5. Browser and Visual Feedback

Sources: [Frontend §3](../requirements/frontend-and-ux.md),
[Plugins §11](../requirements/extensibility-and-plugins.md).

- [ ] **WEB-01 · Missing:** Browser workspace surface beside the editor or as an
      active tab; local dev-server pairing, route navigation, loading, connection
      failure, and reload on agent edits.
- [ ] **WEB-02 · Missing:** Inspect versus interact modes; element selection,
      rectangular regions, numbered pins, inline comments, and captured
      screenshot/DOM/CSS context.
- [ ] **WEB-03 · Missing:** Shared annotation tray: add, inspect, edit, remove,
      and batch-submit feedback across routes. Preserve each note's target and
      page context; define what happens when that target changes.
- [ ] **WEB-04 · Deferred:** iOS Simulator/canvas interaction and annotations
      without DOM information; project enablement and unavailable simulator
      states. Keep the display bridge in the dedicated plugin milestone.

## 6. Editor, Diagnostics, and Terminals

Sources: [Frontend §§1–5](../requirements/frontend-and-ux.md),
[Tools §§2–5, 10](../requirements/tools-and-execution.md).

- [ ] **EDIT-01 · Partial:** Conversation/editor coexistence and agent-driven
      file focus/highlights. Resolve when navigation follows the agent versus
      preserves the file the user is reading or editing.
- [ ] **EDIT-02 · Partial:** Inline/side-by-side diffs and manual editing states;
      stale edits, file changes during review, and links from transcript output.
- [ ] **EDIT-03 · Partial:** Diagnostic markers, hover explanations, autocomplete,
      diagnostic navigation, self-healing progress, and missing-LSP fallback.
- [ ] **EDIT-04 · Missing:** Background process panel with live terminal input,
      process name/PID/uptime/status, process switching, termination, and exit.

## 7. History, Branches, and Workspaces

Sources: [Architecture §§3–4](../requirements/architecture-and-persistence.md),
[Frontend §§7.8, 9.1](../requirements/frontend-and-ux.md),
[Context §5](../requirements/context-and-memory.md).

- [ ] **HIST-01 · Partial:** Thread tree, active branch, retained branches, fork
      destination, and navigation between parent and child sessions.
- [ ] **HIST-02 · Missing:** Rewind from user/assistant messages: standard/custom/
      no summary, optional file restoration, destructive-change confirmation,
      and pruned-snapshot fallback.
- [ ] **HIST-03 · Missing:** Cross-provider switch requires a fork: explain the
      handoff, confirm the new branch, and preserve access to the parent.
- [ ] **SPACE-01 · Partial:** Add and distinguish primary workspace, additional
      authorized directories, and managed read-only reference repositories.
      Include reference attachment progress/failure and visible scope.
- [ ] **SPACE-02 · Partial:** Git branch/worktree switcher, branch creation,
      worktree creation/inspection/pruning, and starting an isolated session.
- [ ] **SPACE-03 · Missing:** Completed worktree review: open its editor, merge or
      cherry-pick changes, discard/prune, and handle conflicts or blocked actions.

## 8. Commit Studio

Source: [Frontend §9.2](../requirements/frontend-and-ux.md).

- [ ] **GIT-01 · Missing:** `/commit` and UI entry points; analysis in progress,
      no changes, and proposed ordered commit cards with file/hunk allocation.
- [ ] **GIT-02 · Missing:** Reorder, move files/hunks, split/merge cards, edit
      messages, and exclude changes versus revert them. Include keyboard paths.
- [ ] **GIT-03 · Missing:** Execute Commits and Commit & Push: confirmation,
      sequential progress, partial failure, completion, and push failure.

## 9. Trust, Approvals, and Tool Access

Sources: [Frontend §5](../requirements/frontend-and-ux.md),
[Tools §§7, 9, 11](../requirements/tools-and-execution.md),
[Plugins §4](../requirements/extensibility-and-plugins.md).

- [ ] **SAFE-01 · Missing:** First-open trust dialog, Restricted Mode badge,
      blocked local plugins/prompts/skills, and granting trust later.
- [ ] **SAFE-02 · Missing:** Command/script approval request with the proposed
      action, plain-English consequences, approve/reject, and resulting run
      state. Do not describe ordinary scripts as sandboxed.
- [ ] **SAFE-03 · Missing:** Global/project deny and safe-allow configuration;
      show why an action is denied, auto-approved, or awaiting approval.
- [ ] **SAFE-04 · Missing:** Active-tool controls: read-only/terminal locks,
      available versus disabled tools, and sequential/parallel/adaptive setting.

## 10. Models, Context, and Extensions

Sources: [Model gateway §§1–2, 6](../requirements/model-gateway-and-routing.md),
[Context §§2, 4, 6–9](../requirements/context-and-memory.md),
[Plugins §§4–8](../requirements/extensibility-and-plugins.md),
[Frontend §5](../requirements/frontend-and-ux.md).

- [ ] **MODEL-01 · Decision:** No-provider state and path to backend credential/
      provider configuration. Decide how much setup belongs in the UI; do not
      expose stored credentials to the frontend.
- [ ] **MODEL-02 · Partial:** Model/thinking selection with supported levels,
      expert-model setting, and backend-routed or plugin-disabled states where
      no model selector is required. Use HIST-03 for cross-provider changes.
- [ ] **MODEL-03 · Deferred:** Modes/personas, model role assignment, and
      mode-specific tool profiles. Detailed transitions and persona builders
      remain deferred until post-scaffold.
- [ ] **CTX-01 · Partial:** Compaction/pruning markers, token changes, summary
      inspection, access to earlier history, overflow recovery, and failure after
      the single recovery attempt. Do not confuse hidden model context with
      deleted conversation history.
- [ ] **CTX-02 · Decision:** Presentation of injected `AGENTS.md` rules and stable
      context. Decide what needs a visible entry versus inspector detail; a full
      rules/prompt editor is not explicitly required.
- [ ] **EXT-01 · Missing:** Global command palette with plugin commands, filtering,
      keyboard navigation, and file/mode/Git/panel actions. Existing session
      search is not this palette.
- [ ] **EXT-02 · Missing:** Dockable plugin sidebar/inspector/drawer/status views
      and replacement surfaces. Define placement and navigation with a sample
      contribution rather than designing every possible plugin.
- [ ] **EXT-03 · Missing:** Loaded plugin health, idle-gated Reload Environment
      toast, reloading/result states, and descriptive composition conflict errors.
      Decide whether configuration uses files or a settings UI; a marketplace
      is not an existing requirement.

## 11. Reporting, Storage, and Notifications

Sources: [Frontend §§6, 7.8, 11](../requirements/frontend-and-ux.md),
[Model gateway §5](../requirements/model-gateway-and-routing.md).

- [ ] **OPS-01 · Partial:** Complete run/session inspector: cache creation,
      savings, child-session and one-off call costs, and system health including
      runners/plugins. Clarify metric scope rather than showing ambiguous totals.
- [ ] **OPS-02 · Missing:** Daily spend/quota alerts and monthly reporting across
      projects/models, printable summary, and CSV/JSON export.
- [ ] **OPS-03 · Missing:** Storage breakdown for snapshots/artifacts/media/DB;
      prune actions, confirmation/result, and Open Folder controls. Explain that
      pruning snapshots removes file restoration, not conversation history.
- [ ] **OPS-04 · Missing:** Success/approval/failure audio cues and notifications,
      volume and per-cue controls, background-only/always/muted policy, and
      notification navigation to the relevant session.
- [ ] **OPS-05 · Decision:** Settings navigation and app/project/session scope
      for the controls above. Group existing requirements, not an extra settings
      feature wishlist.

## 12. Terminal Client

Source: [Frontend §§10–11](../requirements/frontend-and-ux.md).
CLI planning is deferred in the technical tracker; these are separate terminal
design tasks, not missing desktop components.

- [ ] **CLI-01 · Deferred:** Streaming Markdown, thinking toggle, compact tools,
      colored diffs, keyboard navigation, and reflow in terminal widths.
- [ ] **CLI-02 · Deferred:** Keyboard-driven Commit Studio review and approval.
- [ ] **CLI-03 · Deferred:** Reattach to running sessions, terminal Markdown
      artifacts, open interactive artifacts in a browser, and terminal alerts.

## Suggested Review Order

Start with transcript content and the shared tool card. Then work through
composer/run controls, artifacts/planning, and browser/annotations. Those choices
establish patterns reused by approvals, history, and the remaining panels.

This order is a proposal, not an implementation plan. Backend-only requirements
(storage schema, transport internals, provider adapters, SDK types, and hook
contracts) are excluded except where they change a user-visible state or action.

## Completion

- [ ] Review all non-deferred items and link their accepted design examples.
- [ ] Confirm the remaining deferrals and explicitly close this design catalog.

Technical planning remains active separately in [the tracker](tracker.md).
