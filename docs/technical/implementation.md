# Production implementation

The September 14 goal authorizes implementation and delegates remaining product
decisions. The requirements and design screens remain the feature baseline.
The prototypes remain reference material; production code lives in `app/`.
`baseline/` is a parallel native-Cordis host, not a replacement. Launch with
`mise run baseline` and verify at <http://127.0.0.1:4050>.

## Restricted Mode and compaction presentation — awaiting native verification

- Restricted Mode is now verified in the patched native app: on port 61608,
  explicitly chose Restricted Mode for `/private/tmp/fathom-initial-repo`,
  switched to Fathom and returned without another dialog. Quit cleanly and
  relaunched on port 61770; selecting the same project again showed no dialog
  and retained the Restricted mode badge. Trust revocation and the compaction
  disclosure still need separate direct-use verification.
- Native switching reproduced a trust dialog every time a known restricted
  project was reopened. The old Restricted Mode action only dismissed the
  dialog; it also failed to revoke trust when used on an already trusted project.
- Explicit trust decisions now persist a review marker in the project registry.
  Both choices use the same RPC; unchanged Restricted Mode does not reload the
  environment. A changed decision reloads it. Trust-file writes are serialized
  and update memory only after persistence succeeds. The frontend prevents
  duplicate submissions and ignores results for a project the user has left.
  Unknown projects still prompt, and the restricted status badge remains.
- The completed compaction record rendered retained context and internal IDs as
  a large JSON block during direct use. Added CompactionNotice using shared
  Disclosure/Markdown components: a collapsed notice expands to the summary and
  message count. Custom plugin entry renderers still take precedence and receive
  the complete original entry. Runtime activity now also labels run finalization.
- These changes await a native rebuild after Astra finishes the child-browser
  implementation. Do not interrupt that active run to verify this UI work.

## Project layout isolation — native verification

- With Astra still running in native Fathom on port 59948, Cmd+N opened the
  shared project-search picker. Enter selected Fathom and created an empty
  session with the welcome view, Choose model control and disabled Send button.
  No model call was submitted. Returned to the original Astra conversation;
  its ongoing tool work remained visible and the app still reported one run.
- In native Fathom on port 59948, switched from the running Astra project to the
  existing `/private/tmp/fathom-initial-repo` verification project in Restricted
  Mode. Opened README.md beside the browser and changed the editor width to 609
  CSS pixels. Switching back restored Fathom's separate 905-pixel preference;
  returning to the verification project restored its narrower split.
- Used Hide browser in the verification project and confirmed Editor expanded
  to fill the workspace. Returned to Fathom in Editor mode: its docked browser
  remained visible at its own saved width. The
  Astra run continued in its original project throughout these switches.
- Found a remaining UX issue: the trust dialog repeats when revisiting the known
  restricted project. Persist the explicit Restricted Mode decision separately
  from an unreviewed workspace, while preserving the restricted status badge.
- Usage writes now publish a project-scoped usage event and the workspace uses
  its existing refresh path to update totals. This fixes stale costs during
  internal compaction calls; native verification awaits the next build after
  the current Astra run finishes. No tests added.

## Runtime activity visibility — awaiting native verification

- Browser transports now expose closed state. Reloading a disconnected page
  disposes its previous transport and recreates the connection through existing
  pairing/navigation ownership; input cannot silently target a fresh blank page.
  Repeated native disposal awaits the same cleanup promise. Source review is
  complete for this change; disconnect/reload needs native exercise.

- Browser integration review fixed overlapping resize overrides reusing stale
  dimensions. Annotation capture now retains the navigation revision as well as
  view/session ownership; completed saves cannot clear a newer view's selection.
  Same-document navigation updates the remembered address and invalidates an
  older capture. These changes still require direct native verification.

- Added an in-conversation live “Compacting context…” disclosure using the shared
  Disclosure component and existing working-state styling. Its detail explains
  that history is preserved and the agent resumes automatically. Completed
  compaction entries remain in the transcript with their expandable summary and
  estimated tokens freed. Following the latest message now observes activity
  changes too. This addresses the inspector-only visibility gap; desktop
  verification awaits packaging after the current Astra run settles.

- The updated native backend, including DevTools send/poll, compiled successfully
  with the pinned Laufey checkout. The FFI library is staged; the active native
  Astra run remains open, so the new transport is not yet packaged or exercised.
- Annotation staging now checks the originating browser view and session before
  capture and after asynchronous work, including before committing the draft.
  This rejects captures whose owner changed while the screenshot was pending.
  Native verification remains pending with the transport integration.

- Native port 62070 now verifies compaction visibility and live usage: Astra's
  inspector displays Compacting context, and successive observations advanced
  model calls from 231 to 233 and cost from $88.7012 to $89.2013 while the
  transcript stayed at the same completed tool entry. Internal model work no
  longer leaves those usage values stale until a later transcript event.
- Native port 61608: Luna session `639cd0da-5c70-495f-b490-2905e1a9ed18`
  displayed Activity → Waiting for provider while answering a simple request.
  Its final “ready” response returned status to idle and removed Activity.
  Model calls advanced from 80 to 81 and session cost from $0.0633 to $0.0661.
  Compaction-phase live usage remains unverified by this short response.
- Added optional in-memory `SessionState.activity` with a label and start time.
  The runtime reports preparation, compaction, provider wait, response reception,
  tool execution, retry wait and step review through existing session events.
  The inspector reuses Metric to show the current activity. It is absent after
  run settlement and is not persisted as durable session state.
- Motivated by direct native use: Astra's long history compaction appeared only
  as “running.” Attributed usage records proved successive summary calls were
  completing while the visible transcript remained unchanged.
- Source implementation is ready, but do not rebuild while Astra's native
  extension run remains active. Verify phase changes and removal on settlement
  in the next native build with Luna. No tests added.

## Native browser backend — implementation in progress

- Annotation input and overlays now use reported frame dimensions/page scale,
  and the backend validates positions against the page's actual visual viewport
  before capturing. New annotations retain capture dimensions; old annotations
  retain the historical 1280 × 800 default. Pins are not shown against a different
  responsive layout size, while their feedback records remain available.
  Source reference: [CDP frame metadata](https://github.com/ChromeDevTools/devtools-protocol/blob/master/json/browser_protocol.json).
  Native resize/annotation verification is still pending.
- Wired the seven-operation native ABI into a `NativeBrowserConnection` using
  the shared BrowserProtocol. It polls bounded batches, validates message sizes,
  fails pending calls on stream errors and disposes through NativeBrowserHost.
  The desktop supplies it through the existing factory only when all exports
  resolve. Viewport updates use generation checks so an older resize cannot
  reveal native content after a newer hide. Source integration is pending build
  and native verification; annotation coordinates still require dynamic sizing.
- Connected browser-panel measurement to the viewport RPC with coalesced resize,
  scroll, visibility and shared-overlay updates. The backend hides on detach
  and before navigation; stale view identities cannot request visible layout.
  Existing bounds are retained when suspending a view. The frontend currently
  hides native content for partially clipped panels and leaves the existing
  frame underneath; native clipping and direct-use verification remain open.
- Added one reactive native-surface occlusion counter, owned by reusable Modal,
  SearchDialog, WorkspaceDrawer, ActionMenu and context-usage popover components.
  Nested overlays retain occlusion until the last owner closes. This preserves
  one shared overlay policy; the upcoming viewport synchronizer consumes it.
  Native overlap behavior remains unverified until child rendering is wired.
- Added the shared viewport value and a view-identity-checked `browser.viewport`
  RPC. It validates native integer bounds, applies layout only to an existing
  transport that supports it and does not start a browser merely to hide or
  resize one. Frontend measurement and native transport wiring remain next.
- Extracted shared `BrowserProtocol` request IDs, pending-call timeouts,
  response/event dispatch and navigation completion from the external transport.
  The socket transport delegates to it; the native channel will reuse it.
  Disconnect now wakes navigation waits immediately, send failures remove their
  pending timers, and external startup has bounded discovery/socket waits plus
  disposal checks. Native regression verification awaits the active Astra run.
- Introduced one browser transport contract and a lazily selected connection
  factory through Application/Environment. Pairing, discovery, annotations and
  tools remain in the existing browser plugin. The external Chromium transport
  implements the same contract; the native adapter will supply the replacement.
  Startup now retains its own connection identity, rejects a closed/superseded
  connection and ignores late events from old connections. These source changes
  await native verification after Astra's active command-channel task finishes.
- Added `NativeBrowserHost` for explicit-window handle ownership, asynchronous
  ready/disposed confirmation, creation-failure cleanup and shutdown draining.
  Timeouts retain ownership and report failure; they do not claim CEF destroyed
  a live view. Desktop shutdown disposes project work before native children.
  The signed build succeeds and native startup on port 62070 renders normally;
  child creation itself still awaits frontend integration.
- On port 62070, sent the next substantive task through Fathom to Astra session
  `cb176dbc-6bc2-43ba-914c-a2cf6778a329`: implement a bounded asynchronous native
  DevTools send/poll channel for the same child browser and enforce parent app
  origin isolation for navigation, redirects and worker requests. The native
  UI confirms the run is active and reading source. Keep this app running;
  root work owns TypeScript/frontend integration, while Astra owns `app/native/`.
- Added the process-owned TypeScript FFI adapter and connected it to native
  desktop initialization. It resolves the pinned five-operation ABI, preserves
  bigint handles, copies navigation text into UTF-8 bytes and distinguishes a
  stock backend from a patched executable. Pointer signature assertions remain
  confined to the native boundary. The desktop owner exposes its explicit
  public window ID with the adapter for the next view-ownership increment.
- Built and physically opened the signed app on port 61956. Startup reported
  `Native child browser backend: available`; the previous conversation and
  connected language server rendered normally. This verifies in-process
  resolver loading, not child creation or rendering. The UI still uses the
  existing browser implementation pending lifecycle/layout/command integration.
- Added `script/build_native_browser.sh` to validate the pinned checkout,
  recognize/apply the repository patch without resetting local changes, build
  the backend and stage its FFI dylib for the existing signing pipeline. The
  recipe uses prepared CEF dependencies and does not restart Fathom. Its first
  execution applied the patch and compiled the upstream sources, renderer
  helpers and FFI shim. The child implementation failed on an incomplete CEF
  callback type and a capturing lambda rejected by `base::BindOnce`. Sent the
  exact findings through the native Fathom composer for Astra to fix; build
  output is in `/tmp/fathom-native-build.log`. No app restart occurred.
- Astra applied the callback fixes through Fathom. Reran the build script:
  the child implementation compiled, the extended executable linked, and the
  FFI dylib was staged under `app/native/`. Inspected the resulting executable's
  exported symbols and confirmed all five `fathom_child_v1_*` operations.
  This proves compilation/export availability, not in-process FFI resolution,
  child rendering, input, overlay coexistence or shutdown behavior.
- Packaged with `LAUFEY_DEV_DIR` through the shared signed builder and launched
  native Fathom on port 61608. The packaged executable contains the five child
  exports and retains the same Apple Development designated requirement.
  Existing conversation, language server and Luna response worked. Normal
  quit removed the process; plain relaunch on port 61770 restored the profile.
  No new macOS permission prompt was observed. Quit after verification; child
  creation is not yet wired into the UI and remains unverified.
- Built pinned Laufey v0.7.0 / CEF 149.0.5 locally on macOS arm64. The CEF
  wrapper and upstream backend compiled successfully. Build tools are isolated
  under `/tmp/fathom-native-build-tools`; the checkout and generated output are
  under `/tmp/fathom-laufey-0.7.0`. The CEF archive matched its published SHA-1;
  its SHA-256 and reproducible commands are in the native development guide.
- Verified Deno v2.9.6 source exposes `BrowserWindow.windowId` and supports
  `LAUFEY_DEV_DIR` for selecting a local backend. No Deno runtime fork is needed
  merely to package the extended CEF backend. `getNativeWindow()` remains a
  WebGPU surface API and is not used as a child-view handle.
- Native Fathom on port 59948 is running Astra session
  `cb176dbc-6bc2-43ba-914c-a2cf6778a329` to implement the repository-owned native
  child-view boundary under `app/native/`. The requested increment covers explicit
  parent ID, custom bounds/visibility, navigation and disposal, with isolated
  page context and no shell bindings. Compaction completed and the native header
  and C++ implementation are authored; integration patch work is still running.
  do not restart or rebuild this app while that run is active. The long pause
  after steering is confirmed context compaction: successive attributed summary
  calls are completing, not a stopped or duplicated implementation run.
- The upstream build is evidence of toolchain readiness, not a working embedded
  Fathom browser. Compile/review the extension when Astra finishes, then wire
  the Cordis/frontend bridge and perform the delivery audit's native checks.
- Source review identified an integration prerequisite: separate page cookies
  do not prevent direct navigation to the app origin from obtaining a fresh
  bootstrap cookie. Explicitly cover navigation, redirects and worker requests
  to that origin before enabling the child browser for external pages.

## Browser reload recovery — native verification

- Native use on port 59383 exposed a stale browser frame after Settings →
  Plugins → Reload environment: terminal discovery cleared, but the old page
  remained visible. Browser state incorrectly treated a plugin-file notice as
  a restart and ignored the completed environment replacement event.
- Browser pairing now reattaches on environment replacement or connection
  recovery with a fresh view identity, clears stale frames and discovery
  revisions, and ignores file-change notices until reload actually completes.
  Session cleanup detaches the latest view identity. The existing pairing owner
  and transport remain responsible for navigation and events.
- Rebuilt native Fathom on port 59608. Luna started server 59655; the browser
  rendered it. Reload cleared the address, frame and server count, with page
  controls disabled. Without reopening the browser, Luna started server 59732;
  it paired automatically and rendered “Fathom rediscovered.” Both earlier
  server ports (59452 and 59655) were confirmed closed.
- Moved Reload environment to the plugin settings header using the same shared
  Button and header layout as provider settings. Verified it is visible without
  scrolling and performs the reload. No tests added.

## Plugin cache crash recovery — native verification

- Generations now carry a private process-owner marker. Project startup prunes
  marked UUID directories only when the owner process is confirmed absent. Live
  owners, uncertain status, symlinks and unmarked legacy directories are preserved.
- Built and used native Fathom on port 59142, then forcibly terminated its idle
  process to leave an actual owned generation behind. Plain native relaunch on
  port 59195 restored the selected Luna session and removed that generation.
  A marked-live fixture and an unmarked fixture both survived, as intended; both
  temporary fixtures were then removed. No tests were added.

## Monaco/browser split — implementation handoff

- Authored in this native Fathom session. Editor mode can show the existing browser
  beside Monaco. The workspace header toggles it; browser toolbar switches between
  docked and active surfaces. Palette commands use the same show/hide/switch actions.
  Closing the dock keeps editor mode; closing the active browser returns to Agent.
  With no selected session, no browser space is reserved; show commands open the
  session picker instead. Window/container resize clamps the displayed split width
  without overwriting the preferred width, allowing restoration on expansion or
  active/split switching. These cases were source-reviewed, not natively exercised.
- `WorkspaceSurfaces` composes the existing editor and one BrowserPanel through
  `SplitPane`. BrowserPanel stays mounted while switching between split and active
  browser mode, preserving its pairing, navigation and in-progress annotations.
  Editor documents continue using the existing editor lifecycle/cache; no alternate
  browser connection, editor store or annotation store was introduced.
- Split visibility preference and editor-side width use localStorage. The shared
  EdgeResizer supports pointer/keyboard resizing and reset, clamps against available
  space, and is removed in single-surface mode. Existing tokens and shared controls
  are reused. Editor diff drawers portal into the workspace overlay host so they
  are not clipped by a split pane; agent and workspace diff drawers retain their
  existing slide-out behavior.
- Evidence is source review only. As requested, no tests, repository checks,
  rebuild, app quit or native exercise were performed. Native verification still
  needs: editing/saving with the browser beside Monaco; split resize/reset and
  persistence; narrow-window/terminal/artifact resizing; active/split switching
  without browser reload or annotation loss; session/project switching; editor
  draft restoration; header/palette/toolbar controls; agent and both diff drawers,
  including Escape and resizing over the split.
- This implements split composition, not native child-webview embedding or browser
  multi-tab identity/lifecycle. Those requirements and full delivery remain open.

## Development-server pairing — implementation handoff

- Authored inside native Fathom with Astra, per the supervising task. Implemented
  `fathom:dev-servers`, typed discovery/terminal contracts, revisioned RPC/events,
  streaming ANSI-aware bounded URL discovery, and terminal-exit removal. Reused
  the project event subscription supplied by the supervisor.
- `bash(background: true)` now delegates to the terminal service. Command PTYs
  launch `/bin/bash -c` directly, preserving process/session identity and allowing
  command completion to remove candidates. Interactive shells retain their lease
  until the shell terminal exits/stops; discovery is not a health probe.
- Browser pairing uses the existing BrowserConnection owner, serialized navigation,
  per-session manual/server choices, view-scoped events, stale-request suppression,
  and the existing approved SearchDialog/SearchList primitives for server selection.
  Explicit Go navigation is retained; server choices expire with their terminal.
- Evidence: source implementation/review only in this turn. No tests, standalone
  checks, rebuild, app quit, or native exercise were performed by this agent, as
  requested. Supervisor must rebuild and directly exercise split URL/ANSI chunks,
  credential/nonloopback rejection, background command exit, multiple-server
  selection, manual navigation, restart/new port, rapid session switches, close/
  reopen, plugin reload/reconnect, and annotation source retention.
- Native child-webview embedding, tabs, browser/Monaco split docking, and complete
  browser delivery remain open. Current browser surface is still Chromium frames;
  server-owned hot reload is not proof of a native embedding/live-reload milestone.

## Boundaries

- `sdk/`: versioned, browser-safe data and plugin contracts; no implementations.
- `kernel/`: Cordis composition validation, loading, trust and lifecycle.
- `plugins/`: replaceable storage, providers, runtime, tools and product services.
- `server/`: authenticated local WebSocket transport and desktop lifecycle.
- `ui/`: Solid primitives, reusable feature components and slot composition.
- `scripts/`: packaging utilities. No new tests; verification uses the software.

Use the integration prototype's exact dependency pins. Cordis owns service
injection, scoped effects, listeners and disposal. Pi owns provider protocols,
credentials refresh, thinking translation and usage. Each open project gets
its own plugin context and SQLite database. The global registry lives outside
repositories. No default plugin downloads occur on launch.

## Ordered delivery and completion evidence

Each item remains open until exercised in the running application.

- [ ] Foundation: SDK, Cordis composition, global/project discovery, trust,
      reload, atomic configuration and per-project persistence.
- [ ] Connected agent: provider login/settings, live streaming, durable intent,
      recovery, stop/continue, steer/follow-up, retries and tool integrity.
- [ ] Editing workflow: hashline files, bounded processes, scripts, approvals,
      terminal, deferred tools, MCP and shared LSP diagnostics.
- [ ] Reusable workspace: design-matched agent/editor/chat views, navigation,
      command palette, inspector, settings, menus, density and themes.
- [ ] Durable workflow: branches, snapshots, worktrees, commit studio,
      compaction, skills, custom prompts, artifacts and child sessions.
- [ ] Complete surfaces: integrated browser, annotations, media, reports,
      storage management, notifications and CLI attachment.
- [ ] Extension experience: SDK exports, global and repository examples,
      frontend contributions, self-authoring documentation and live reload use.
- [ ] Final use: native launch, real provider task, editor/terminal interaction,
      restart/reconnect, extension workflow and final quality review.

Previously deferred mobile tunneling and specialized iOS simulator bridging
remain subsequent domain milestones. A standalone streaming renderer remains
deferred; use the selected Markdown libraries. Track any external publishing
prerequisites explicitly rather than claiming an SDK has been published.

## Verification

- September 15 native port 58994: extended the portable split-view plugin with
  a shared button that cycles first-only, second-only and both panes. Installed
  it in the isolated machine scope, dragged the divider to a reported 541 pixels,
  and exercised all three states. Both panes returned with the selected width
  and existing message/diff content. This directly verifies the SDK adapter's
  visibility updates, beyond the built-in workspace split. Removed the temporary
  installation after use; the runnable example remains under app/examples.

- September 15 native port 58851: exposed the shared IconButton and ConnectionRow
  through typed host.ui component adapters, moved IconName into the SDK with a
  UI re-export, and exposed SplitPane visibility props. Added the portable
  connection-controls example and documented composition/disposal. Installed the
  same example first in the isolated Fathom home's plugins directory, then in
  the trusted repository's .fathom/plugins directory. Native clicks updated row
  status and icon state in both scopes. Removing the global manifest and reloading
  removed its view; repository loading recreated one fresh view. Temporary plugin
  installations were removed after verification. Split visibility adapter props
  are wired but not separately exercised through this example.

- September 15 native port 58697: provider settings now have a direct Refresh
  action for status recovery instead of requiring Settings to be reopened.
  Extracted ConnectionRow for providers and MCP connections, removed duplicate
  row CSS, and used shared tokens for login cards. Login headings show the
  provider display name and readable status. Native use verified refreshing,
  opening the unconnected OpenAI API-key prompt, disabled empty submission, and
  cancellation returning to Not connected without entering credentials. Reviewed
  Pi 0.85.1 MutableModels.login: it races provider login against abort before
  credential mutation, so the existing cancellation mechanism remains unchanged.
  Network-failure refresh recovery and complete new-account authentication are
  not established by this check.

- September 15 session/appearance persistence: selected the older Luna
  conversation at native port 58348, quit, and port 58390 reopened that selection
  while Astra remained the most recent session. Selection is project-backed via
  session.selection.get/set; writes validate project ownership and startup skips
  archived/missing remembered sessions. Native theme toggle at port 58467 saved
  light mode in profile-level appearance.json. Initial relaunch exposed a
  mount-only document-theme assignment; made that assignment reactive. Port
  58568 restored light mode, then the native command restored dark. Appearance
  writes are atomic, serialized and awaited during application shutdown.
  Archived-session fallback and concurrent selection remain to exercise directly.

- September 15 native ports 58206 → 58257: browser docking and a manually
  resized editor width survived quitting and reopening on a different local
  origin. Replaced browser layout localStorage with validated project-backed
  settings.layout.get/set and the shared WorkspaceLayout contract. One workspace
  state owner serializes writes, captures their project, and restores settings
  before displaying a newly opened project; WorkspaceSurfaces owns no storage.
  Project changes wait for pending layout writes before reading preferences.
  Other origin-local preferences (such as theme/session selection) remain to
  audit separately; this evidence covers browser placement and split width.

- September 15 native Astra self-authoring completed the editor/browser split
  in session cb176dbc-6bc2-43ba-914c-a2cf6778a329. Native port 57893 verified
  Monaco displaying AGENTS.md beside example.com, drag resizing, switching to
  active browser and back with the page and split width retained, and the agent
  drawer overlay. Window shrink/restore exposed preferred-width loss. Root fixed
  competing resize ownership: EdgeResizer can delegate window sizing to its
  containing layout, while SplitPane retains user width and clamps only display
  width. Port 58031 verified width restoration after narrowing/widening and the
  file-diff overlay over the split. Browser placement/width use localStorage;
  persistence across changing native origins is still unfinished. No-session
  behavior has a code guard but needs direct verification. Native child-webview
  embedding and multi-tab browser ownership remain open.

- September 15 native port 57533: a fresh Luna run read Disclosure and ToolGroup
  in separate calls, completed successfully, and displayed one two-file activity
  summary with final prose outside it. This verifies the fresh run result; the
  short stream completed before the intermediate frame was inspected.

- September 15 native port 57478: activity groups now expand directly into
  thinking and individual tool rows, without redundant per-turn tool summaries.
  The group uses the approved inset border/spacing; ToolCard uses the approved
  compact disclosure layout instead of boxed cards. Native Luna history verified
  one group containing three tools, independent thinking expansion with visible
  content, and a PTY row exposing its arguments and output. Fixed nested carets
  inheriting an ancestor's open styling by binding each Disclosure caret to its
  own state. Empty thinking text is suppressed and cannot create a synthetic
  thinking-only segment beside prose. Fresh streaming with these changes remains
  to exercise; this pass verified persisted conversation interactions.

- September 15 native port 57151: extracted BrowserToolbar from navigation and
  annotation state. Reused IconButton and SelectorButton, removed the browser's
  bespoke toolbar CSS, and added pressed/form-submit semantics to IconButton.
  Native use verified Go navigation to example.com, enabled annotation controls
  after rendering, area selection and Escape cancellation. Resizing the native
  window from 1177 to 826 pixels placed browser actions on a second row while
  preserving the address field; the shared server search remained usable.
  This improves primitive reuse and responsive composition, not proof of complete
  browser design parity or native child-webview embedding.

- September 15 native port 56848: Luna launched one PTY terminal owning two
  Deno servers. The output included credential/non-loopback fixture URLs and an
  ANSI-colored loopback URL split across an eight-second pause. The browser
  discovered exactly two candidates (56976 and 56977), automatically rendered
  Server A, and the shared server search selected and rendered Server B. No
  additional macOS approval appeared during this run. Killing the owning terminal
  through Luna removed both candidates and cleared the paired browser page.
  Earlier fixture attempts
  were invalid due to escape characters in the verification prompt, not server
  discovery; one failed with a syntax error and one was declined before execution.

- September 15 after the user's latest App Management approval: rebuilt and
  reopened native Fathom at port 56848. Its designated requirement is byte-identical
  to the earlier certificate-signed launch, and the scoped recent TCC log contains
  no new code-requirement mismatch. Workspace and Luna history survived. This
  confirms stable rebuild identity; a logged App Management authorization using
  the retained grant is still needed before claiming end-to-end retention.

- September 15 native launch-path recovery: port 56573 recorded the explicitly
  launched development profile. Quit, then opened the signed bundle with no
  FATHOM environment flags. Port 56618 restored the same Fathom workspace, Luna
  session/history and Connected Deno server. A private per-executable path record
  restores only home/workspace/runtime/auth-file paths; credentials are not stored.
  An explicit home change does not inherit another profile's paths. With no record,
  desktop startup uses a recent project or the picker instead of the OS working
  directory. The designated signing requirement remained unchanged after this
  code rebuild too. Fresh-profile and explicit-profile-switch cases remain to
  exercise separately.

- September 15 signed native port 56326: Luna completed two tools without a
  permission interruption, started the PTY-backed Deno server on port 56369,
  read its announced URL, and reached idle. Opening the integrated browser
  automatically rendered “Signed Fathom”. Quit stopped the app and fixture
  process. The scoped TCC log still compared the old ad-hoc cdhash grant with
  the new certificate requirement at 14:05. That is the identity transition;
  the OS grant has not yet been proven migrated. This proves signed launch,
  native-addon/PTY use and pairing. One approval for the certificate identity
  and a subsequent App Management operation after rebuilding remain necessary
  to prove grant retention end to end.

- September 15 macOS permission investigation: TCC logs at 13:44, 13:46 and
  13:52 explicitly reported failure to match the saved code requirement for
  `dev.fathom.desktop` / App Management. The previous bundle was ad-hoc signed
  with no team identity. Added one shared desktop builder, persistent local
  certificate selection, explicit-only ad-hoc builds, and documented native
  entitlements. The first real-identity build exposed missing JIT permission;
  the next exposed native addon library validation. The final main host carries
  JIT plus native-plugin library loading; CEF helpers carry JIT only. Native PTY
  code is signed before embedding. Certificate-signed native launches succeeded
  at ports 56204 and 56326, and their designated requirements were byte-identical.
  Evidence: /tmp/fathom-signing-requirement-first.txt and
  /tmp/fathom-signing-requirement-second.txt. Agent/terminal use after signing and
  OS grant retention remain the final direct-use checks for this correction.

- September 15 native port 55823: exact `Deno.serve` launch through Luna's
  background bash tool succeeded without a command-level environment workaround.
  Server port 55863 was discovered and its “Fathom pairing C” page rendered.
  The subsequent multi-server exercise was interrupted by an app exit during
  the repeated macOS permission cycle, so that exercise remains incomplete.

- September 15 follow-up on native port 55493: direct `Deno.serve` still inherited
  the host address through PTY environment overlay, so omitting the variable from
  the supplied map was insufficient. The PTY now starts `/usr/bin/env -u
DENO_SERVE_ADDRESS` followed by the selected shell; env replaces itself, keeping
  terminal ownership intact. The bounded Node process runner uses the filtered
  environment map. Native retry is pending on the next build.
  A separate `Deno.listen` fixture rendered and disappeared when stopped, but
  that API does not prove the `Deno.serve` fix. Tool review also twice rejected
  authorized individual steps for not completing the entire multi-step request.
  Clarified its prompt to judge each action's authorization and effects; destructive,
  credential, outside-workspace and external-side-effect escalation remains.

- September 15 native pairing on port 55308: Luna used `bash(background: true)`
  to start a temporary Deno server. Its first launch failed because the child
  inherited `DENO_SERVE_ADDRESS` and attempted to bind Fathom's port. Luna retried
  with that variable unset; the browser automatically paired to port 55407,
  rendered the fixture, followed `/second`, cleared on switching to the Astra
  session, and restored `/second` on return. The server picker used the shared
  search dialog and showed the correct terminal. Quit stopped the app and fixture
  process. Added shared `workspaceEnvironment()` for terminal and bounded-command
  children to remove the host address; rebuilding to verify without the workaround.
  Deno documents this address override in its
  [desktop serving guide](https://docs.deno.com/runtime/desktop/serving/).

- September 15 native recovery retry on port 54321: two failed restarts each
  retained one error and an enabled retry action. Made the fixture executable
  available (wrapper around installed Deno LSP) without changing/reloading its
  registration; Restart reached Connected and cleared the prior error. Unloading
  the restarted plugin left Deno alone. Fixture and wrapper moved to
  /tmp/fathom-recovery-verification-54321. App quit and main process stop confirmed.

- September 15 unavailable-server exercise exposed a desktop startup crash from
  JSON-RPC writing before a missing executable's spawn failure was delivered.
  Initialization now waits for the child spawn/error outcome before writing.
  Rebuilt native port 54230 started with Deno Connected and the fixture
  Unavailable, reported ENOENT on Restart, and kept the retry control enabled.
  Unloading the fixture restored Deno alone. Fixture moved to
  /tmp/fathom-recovery-unavailable-54230.js; app quit and process stop confirmed.
  The failed restart displayed duplicate errors; consolidated action/server
  errors into the reusable recovery action afterward. That presentation change
  still needs a native rebuild and check.

- September 15 native recovery with unsaved content on port 54027: changed a
  temporary TypeScript buffer from a saved string to a number without saving.
  Restart replaced Deno PID 24307 with 24423; the dirty buffer survived and its
  type error returned after diagnostics refreshed. Typing `console.` afterward
  produced member completions. Disk content stayed unchanged. Discard restored
  the saved text and cleared errors. Fixture moved to
  /tmp/fathom-restart-buffer-54027.ts, its tab closed, and the app quit; main
  process disappearance confirmed. Failure/retry and concurrent unload cases
  remain separate verification work.

- September 15 native custom renderer lifecycle on port 53936: loaded a
  temporary global renderer, reloaded through the app, and confirmed its entry
  id and complete message matched persisted session entries. Checked Luna text
  replies and Astra entries containing both thinking and text. Removing the
  plugin and reloading restored the consolidated built-in activity summary and
  prose. An initial fixture export error was displayed without hiding the
  transcript; corrected to the documented default frontend export before use.
  Fixture moved to /tmp/fathom-renderer-verification-53936; no verification
  plugin remains installed. Quit and confirmed the native process stopped.

- September 15 renderer compatibility review: transcript thinking/prose splits
  now defer to matching plugin entry renderers, preserving their original entry
  identity and full content. Shared renderer matching retains predicate failure
  isolation; memoized transcript segments react to plugin registration changes.
  Native rebuild and port 53873 restored both Luna activity summaries and prose.
  Custom assistant-renderer install/unload still needs direct verification.
  Quit afterward and confirmed the native process stopped.

- September 15 live grouping verification on native port 53722 with ChatGPT
  Luna: two separate read calls displayed one `2 files read` summary before
  final prose. A slower sequence (sleep, read, sleep) displayed one active
  command summary; expanding it during execution stayed expanded as subsequent
  steps arrived and updated to `1 file read · 2 tools ran`. After the reply
  completed, collapsing hid the activity while `done` remained visible. Session
  returned idle (10 cumulative model calls, 5 tool executions). No files were
  changed by these runs. Quit and confirmed the native process stopped.

- September 15 transcript grouping correction: consecutive assistant steps
  without prose now share one activity disclosure using the approved disclosure
  and tool summary primitives. Thinking attached to a prose reply joins the
  preceding activity; prose remains visible and separates groups. Preserved
  entry renderers, per-tool details and message actions. Native port 53652
  displayed the real Astra implementation sequence as one summary (12 files
  read, 6 edited, 1 written, 5 other tools, 2 failed); expanding exposed its
  thinking/tool history. Live streaming transitions still need direct use.
  Quit the app afterward and confirmed its process stopped.
- September 15 native recovery check on port 53527: inspector Restart replaced
  Deno PID 21301 with 21365 under the same app PID 21276 and returned Connected.
  Astra self-authoring session 5d344e9c-e36e-4848-9605-fbe9429706d8 completed
  with 37 model calls and 37 tool executions before the rebuild. Unsaved-buffer,
  failure and concurrent lifecycle recovery cases remain unverified.

- Language-server recovery implementation (Astra self-authoring in the active
  native Fathom session): added scoped `LspService.restart(id)`, validated
  `lsp.restart`, and a reusable inspector recovery action using the shared Button.
  Recovery retains configuration/priority and unsaved gateway text, invalidates
  old process diagnostics, coalesces concurrent requests and checks registration
  identity before startup and after asynchronous work. The original scoped
  disposer follows restarted generations; unload/replacement/project disposal
  cannot resurrect retired registrations. Existing severity normalization and
  snapshot cancellation work were not modified.
  Source review only in this session; no tests, standalone checks, manual app
  checks, native rebuild/launch/quit or staged feedback submission performed.
  Supervising agent owns native build and direct verification: exercise healthy
  and failed-server restart, pending/error/retry UI, unsaved-text diagnostics and
  completion, priority fallback, duplicate concurrent calls, malformed/unknown
  RPC ids, unload/replacement during shutdown/startup/rebinding, project switch
  and disposal races, and confirm old process trees/markers are gone. Recovery
  delivery remains unverified until that evidence is recorded.

- September 15 diagnostic consistency audit: the editor treated omitted LSP
  severity as an error, but status counts and automatic review ignored it.
  Normalize omitted severity to error at the gateway boundary, preserving
  explicit warning/information/hint values. This follows the protocol's
  client-defined default and keeps UI and agent consumers consistent. Native
  verification with a server that omits severity remains outstanding. Rebuilt
  and opened native port 53157: the saved Luna conversation restored and Deno
  connected without a startup error. Quit and confirmed the main process stopped.

- September 15 snapshot cancellation audit found that callers waited for queued
  work and lock retries after their signal aborted. Snapshot operations now
  return cancellation promptly while the underlying queue retains ownership
  until work and lock cleanup finish. Canceled queued operations check their
  signal before acquiring a lock. The native bundle rebuilt successfully;
  contention and Stop timing still require direct verification. On native port
  53014, created a session through the project search UI, selected ChatGPT Luna
  through model search, and completed a no-tool reply (one model call, idle).
  This exercises normal admission after the queue change. Quit afterward and
  confirmed the native main process stopped.

- September 15 native access restored after the user's Mac approvals. Rebuilt
  and launched the desktop bundle on port 52882, including the SDK model type
  extraction. Exercised Luna thinking low → medium → low and confirmed both
  the combined selector and session inspector updated. Opened and dismissed
  the editor's agent drawer, then opened the AGENTS.md diff as a right-side
  slide-out drawer with the editor behind its scrim. Quit the verification app
  and confirmed its main process stopped. Failure and in-flight session-switch
  cases still need direct verification; these observations do not establish
  complete design fidelity across all screens.

- September 15 model-selector lifecycle follow-up: model and reasoning changes
  share pending state, reasoning failures render locally and restore the saved
  selection, and a session change closes the picker. Reasoning updates capture
  their project/session before awaiting completion. Fixed explicit spacing in
  the combined selector. Extracted ModelChoice into the SDK and checked the
  server's models.list mapping against it, removing state/picker imports from
  the composer component.
- The native build completed, but desktop verification could not begin because
  the computer-use tool reported the Mac locked and automatic unlock failed.
  Requested manual unlock. The SDK extraction was made afterward and still
  needs the next build; no native verification is claimed for these changes.

- September 15 composer fidelity pass compared the approved conversation header,
  transcript spacing, message actions and tool execution components with their
  production counterparts. Their relevant layout classes match. Found and fixed
  a composer mismatch: model and thinking effort now use the approved combined
  selector shape through a reusable SelectorButton. Thinking options live inside
  the shared model search dialog using the existing Field control.
- Rebuilt native Fathom at port 52463. Opened the combined selector, changed Luna
  thinking from low to medium, and confirmed both the composer label and inspector
  updated. Restored low and verified it. No model call was needed for this control
  check. This is a component-specific correction, not completion of the full
  design fidelity audit.

- September 15 deleted-document cleanup verified in rebuilt native Fathom at
  port 52290. Luna created an invalid TypeScript fixture and removed it through
  bash. The run finished idle with no stale review prompt, and the inspector
  returned to zero errors and zero warnings. Confirmed the fixture no longer
  existed. Cleanup failures now become incomplete-review details rather than
  failing an otherwise completed run; cancellation still propagates.

- September 15 review edge cases: read-only runs skip workspace comparison;
  failed mutating commands still trigger it. Review uses diagnostics only for
  successfully refreshed files and removes deleted paths from its work list.
  Native Fathom at port 52155: Luna wrote an invalid fixture, then moved it to
  `/tmp/fathom-deleted-review-52155.ts` through the approved outside-workspace
  command. It finished idle without a stale repair prompt. The inspector still
  showed the deleted document's error, so added `LspService.close` to clear its
  cached document and diagnostics. This follow-up needs native verification.

- September 15 shell-change review: added `SnapshotService.changedSince`, using
  the locked isolated snapshot index and NUL-delimited Git output. Review uses
  the admission snapshot to discover new/modified files, including shell edits,
  then refreshes through the existing editor RPC so draft handling is shared.
  Discovery, refresh and diagnostic waits are bounded and observe cancellation.
  Concurrent edits after admission are part of the same time-based comparison;
  ignored/deleted files are excluded. Factored bounded waits into one helper.
- Native Fathom at port 52011: Luna created an invalid TypeScript fixture through
  bash, attempted to conclude, and received automatic diagnostic feedback for
  that file. Luna repaired it and finished idle with zero errors, 157 cumulative
  model calls. The existing dirty repository was not included as pre-run work.
  Preserved the repaired fixture at `/tmp/fathom-shell-review-52011.ts`.

- September 15 unavailable-server review: a configured language with no healthy
  matching server now produces a not-reviewed result rather than silently
  treating empty diagnostics as successful review. Rebuilt native Fathom at
  port 51832 with the unavailable Rust Analyzer example. Luna wrote one Rust
  fixture; the completed run displayed an attributed Diagnostic review notice
  that no matching server was available and review was incomplete. A transient
  provider overload recovered during this run. Preserved fixture and plugin at
  `/tmp/fathom-unavailable-review-51832`. Cancellation and repair-limit checks
  remain open.

- September 15 review attribution: entries now support persisted source labels,
  and step continuations can provide their plugin id and display label. The
  existing transcript card renders that source instead of “You” and suppresses
  user-message editing. Unlabeled hook continuations default to Harness feedback;
  the diagnostic plugin labels both repair prompts and terminal reports.
  Native Fathom at port 51703 displayed Diagnostic review with its timestamp
  and no Edit and resend action. Luna repaired the intentional type error and
  finished idle with zero errors (148 cumulative model calls). Preserved the
  repaired fixture at `/tmp/fathom-review-label-51703.ts`.

- September 15 automatic diagnostic review: added the separate
  `fathom:diagnostic-review` Cordis plugin using successful file-tool hooks and
  the existing step continuation hook. Runtime now passes its abort signal to
  `step:after`. Review waits briefly for asynchronous diagnostics, bounds reads
  and repair passes, and records incomplete/unresolved review results instead
  of looping indefinitely. Shell-only changes and compiler-barrier freshness
  are not covered by this initial integration.
- Rebuilt native Fathom at port 51538. Luna wrote an intentionally invalid
  TypeScript fixture, attempted to conclude, and received an automatically
  generated review message with the exact assignment error. Without another
  user prompt, Luna read and edited the fixture to
  `const answer: string = "42";`, then finished idle. The inspector showed zero
  errors and one unused-variable warning. The completed session recorded 143
  cumulative model calls. Preserved the fixture at
  `/tmp/fathom-diagnostic-review-51538.ts`. Review-limit, Stop-during-review,
  multi-file and unavailable-server behavior still need native verification.
  Automatic feedback currently uses the existing user-message continuation
  representation; explicit review-source presentation remains to be improved.

- September 15 syntax lifecycle review fixed cleanup ownership when a plugin
  mutates its contribution object's id, and rejected pending asynchronous
  registration after activation failure. Rebuilt native Fathom at port 51414;
  a temporary plugin began language registration and deliberately threw during
  activation. Its pending promise rejected with “Plugin scope was unloaded,”
  visible in the app, while the workspace and Deno remained operational. The
  fixture plugin was moved to `/tmp/fathom-syntax-failure-51414.js`.

- September 15 frontend language plugins: added awaited `registerLanguage` to
  the frontend host with typed Monaco Monarch grammar, editor configuration,
  extensions and priority. Project-scoped stable ids isolate registrations;
  duplicate contribution ids fail, selection is deterministic, and lifecycle
  cleanup disposes tokenizers/configuration. Editor and diff models share one
  binding implementation and fall back when a contribution unloads. Consulted
  the installed Monaco 0.56 API declarations for token-provider disposers,
  language configuration, model language changes and language-id registration.
- Extended the portable Rust example with a frontend grammar and documented
  both installation files. Native Fathom at port 51177 displayed Rust keyword,
  comment, string and number highlighting in the editor and slide-out diff
  drawer while Rust Analyzer was unavailable. Unloading removed highlighting
  from both open views. Fixed the stale status label discovered during that
  exercise by subscribing to Monaco's model-language-change event.
- Rebuilt and repeated native unload at port 51284: highlighting and the footer
  both changed from Rust to plaintext, retaining the document and cursor at
  line 3, column 26. Closed the fixture and preserved it with the verification
  plugin under `/tmp/fathom-syntax-verification-51284`; quit the verification
  app and confirmed its LSP process exited. The example grammar is intentionally
  extensible and is not a complete Rust parser. Cross-project isolation and
  conflicting syntax priorities still need direct-use verification; automatic
  diagnostic review before agent completion remains unfinished.

- September 15 language-server gateway was implemented through native Fathom
  using GPT-6 Astra. Its completed task recorded 61 model calls and 67 tool
  executions. Reviewed scoped registration, deterministic selection/replacement,
  bounded startup/completion, protocol-error handling and process disposal.
  File reads now stream through small buffers with a shared four-reader limit;
  diagnostic batches also bound authorization and synchronization concurrency.
- Built the native bundle and exercised it at port 50850. Installed the portable
  Rust Analyzer example globally in the isolated Fathom home: it reported
  Unavailable while Deno remained Connected. The editor displayed an intentional
  TypeScript assignment error and live `console` completion suggestions. Discard
  restored the original file and its single diagnostic.
- Loaded a repository plugin registering the installed Deno binary at priority 10. Both Deno instances appeared alongside the global unavailable server.
  Luna's shared `lsp_diagnostics` tool selected Repository Deno. Its initial
  configuration omitted Deno's named configuration section and returned no
  diagnostics; adding nested `deno` settings and reloading produced the expected
  “Type 'number' is not assignable to type 'string'” result. Documented this
  configuration distinction in the plugin guide.
- Unloaded both verification plugins through the native reload notice. The
  inspector returned to Deno only, and process inspection confirmed one owned
  LSP child instead of two. Closed the fixture, preserved it and the plugins in
  `/tmp/fathom-lsp-verification-50850`, and quit the verification app. No tests
  were added. Frontend Monarch registration, diagnostic review before run
  completion, and broader LSP capabilities remain unfinished; this pass does
  not establish completion of the entire editor or plugin requirement.

- September 15 native restart recovery: the app reopened with the default `/`
  workspace after the user approved macOS permissions. Restored the isolated
  development launch configuration without trusting `/`. At port 50550, the
  saved Astra task showed its prior response as interrupted, with its edits and
  usage intact. Submitted a continuation through Fathom; the inspector showed
  GPT-6 Astra running and new tool executions. The cause of the earlier process
  exit has not been established.
- Language-server integration is in progress: the frontend consumes
  `lsp.servers` for the inspector and path-specific `lsp.status` for the editor.
  The inspector retains the approved server rows and shared aggregate diagnostic
  summary. The plugin guide now links the portable registration example.
  These changes still require a fresh native build and direct-use verification.

- September 15 dirty-file live-follow verification ran Luna alongside Astra's
  substantive language-server implementation in native Fathom at port 49783.
  The editor retained “Local unsaved revision.” while Luna read the same file;
  its single write attempt was rejected for unsaved editor changes. Disk still
  contained “Original disk revision.” Luna finished idle (131 cumulative model
  calls, 91 tool executions). A transient reconnect rejected the first discard
  request; after the connection recovered, retrying Discard restored disk text
  and removed the dirty marker. The fixture was closed and moved to
  `/tmp/fathom-draft-protection-49783.txt`. Astra remained active throughout.

- September 15 line navigation: SDK `FileActivity`/`FileRange` describe one-based
  inclusive ranges. Built-in reads publish their read window, writes publish
  the replacement range, and hashline edits publish affected lines. The visible
  editor follows file activity from the active session when Following agent is
  enabled, using Monaco's documented `revealLinesInCenter` and owned decoration
  collection. Highlights use the approved action tint and clear after four
  seconds. The existing dirty-document guard preserves unsaved contents.
- Native Luna verification at port 49420 read `zz-line-focus.txt` at offset 60,
  limit 3; the editor automatically opened it at line 60. With follow disabled,
  a subsequent `.gitignore` read left the fixture selected. The transcript's
  Open file action then highlighted `.gitignore` lines 1–3. Both runs finished
  idle (126 model calls and 88 tool executions cumulative); no files were edited
  by these requests and staged feedback remained intact. Following agent was
  restored. Write/edit range events and dirty-file live following still need
  direct exercise.

- The same native pass exposed lost cursor/scroll state when switching modes.
  Editor workspace state now retains Monaco view states per URI alongside open
  documents. Native build at port 49646 preserved line 70, column 22 and the
  scrolled viewport after editor → agent → editor. The fixture was closed and
  moved to `/tmp/fathom-line-focus-49646.txt`; Fathom was stopped. View state is
  retained across mode changes within the process, not across app restarts.
- September 15 transcript file navigation: built-in read/write/edit tool cards
  now expose Open file; completed writes/edits also expose Review current
  changes. The review explicitly shows current saved contents versus HEAD,
  rather than presenting them as the historical tool-time patch. Navigation
  goes through workspace state into the shared editor/diff components.
  Project-scoped file targets are consumed after dispatch; editor reads ignore
  disposed owners and superseded focus requests. Native verification at port
  65423 used the previously recorded Luna write, temporarily restored its
  `zz-review-event.txt` fixture, opened its +1/−0 diff directly from the tool
  card, and opened the same contents in Monaco. No provider request was needed
  for this UI navigation check. Historical snapshot diffs and automatic
  agent-driven line highlighting remain separate unfinished requirements.
  A second native build at port 49169 verified that closing the target and
  switching agent → editor does not reopen it. The temporary fixture was moved
  to `/tmp/fathom-transcript-navigation-49169.txt`; the app was stopped.

- September 15 agent-mode drawer follow-up: the workspace header's “Open diff
  drawer” action now opens `WorkspaceChanges`, rather than the Changes & commits
  modal. `DiffDrawer` shares the approved header, breadcrumbs, line counts,
  viewer and resize container with editor file review. Repository management
  remains a separate action from that review. Native verification at port 65199
  opened the 368-file list, reviewed `.gitignore` (+5/−0), returned to the list,
  and opened Changes & commits. The editor used the same component and its
  Open in editor action opened `.gitignore` without changing its contents.
  Drawer conversation titles now use the approved smaller type size. The
  reusable workspace checklist remains open for the remaining fidelity audit.

- September 15 drawer/search correction supersedes the earlier modal diff
  implementation. Editor file review and the editor agent overlay now share
  `WorkspaceDrawer`, using the approved width tokens, workspace glass, left
  `EdgeResizer`, and drawer header close control. Conversation content stays
  mounted across mode changes. Native verification covered opening and closing
  both drawers, resizing both, Escape dismissal, and inline/side-by-side review.
- `SearchDialog` and `SearchList` now reproduce the approved search surface,
  field, heading, result frame and keyboard hint bar. Session search, new-session
  project selection, commands, models, project opening and archived sessions
  use these shared components. Native use verified filtering, Enter selection,
  command-to-search focus, new-session creation, and a Luna response (one model
  call, no tools). Existing staged feedback stayed attached to its original
  session. Project-opening search and the archived-session result were also
  inspected in the rebuilt native app; the disposable Luna check was archived.
- Cross-project search uses `sessions.catalog` and a read-only reader owned by
  the storage plugin. It reads only registered project databases, closes every
  connection, reports unavailable databases, and does not activate project
  plugins just to search. This fixes the failed attempt to call the active
  environment's `sessions.list` API for unopened projects. Native search opened
  `fathom-initial-repo` in restricted mode and returned to the Fathom implementation
  session. Catalog failure handling and corrupt/newer database cases remain
  unexercised. The broader design and feature checklist remains open.

- Verified stale-review events with a real native agent edit. Rebuilt Fathom,
  selected OpenAI Codex GPT-5.6 Luna, and asked it to wait briefly before reading
  and writing only a temporary review document using the built-in tools. Opened
  that document's diff while Luna ran. The write changed the caption to Files
  may have changed while the original snapshot stayed visible. Refresh displayed
  Updated by Luna through Fathom and cleared the stale caption. Returned to Agent
  mode and confirmed Luna's read/write activity and idle completion (118 model
  calls, 84 tool executions accumulated in this session). No other implementation
  task, staged feedback or checks were requested from Luna. Read back the file,
  moved it outside the repository and quit the native app. The latest lifecycle
  hook passed. This closes the direct file-write stale-notice check; request-close
  races and comprehensive external filesystem watching remain open.

- Extracted createFileReview for editor and commit review request ownership.
  It rejects late responses after close, selection changes, project changes or
  disposal, and tracks writes/Git/connection changes while requests are pending.
  Both screens expose Refresh and a saved-snapshot caption; known change events
  conservatively mark the project review stale without moving the reader.
  Read-only file events do not invalidate a review. Refresh preserves the chosen
  comparison mode while replacing the Monaco models through existing disposal.
  The preceding lifecycle hook passed after the IconButton disabled/icon fixes.
  Rebuilt native Fathom, opened a temporary new-file comparison, selected Side by
  side, changed that file on disk, and clicked Refresh. The second revision and
  its added line appeared with Side by side still selected. Closed review, moved
  the temporary file outside the repository and quit. No model or tests ran.
  Direct stale-event and in-flight-close verification remain open; external writes
  are not comprehensively watched. A final event filter refinement ignores read
  events and invalidates project writes regardless of absolute/relative tool paths.

- Added shared FileDiff/Monaco diff-engine components for editor Changes and
  commit review. Both use the same language registrations, worker setup and
  design-token theme as the normal editor, with semantic inserted/removed colors.
  Added the FileDiff SDK data contract; git.diff uses a renamed file's previous
  path for its HEAD baseline and bounds baseline size. The viewer offers inline
  and side-by-side modes, previous/next changes and initial change focus; models
  and listeners are disposed when the view closes or changes files. Editor review
  keeps its Open in editor action visible in a constrained modal. Commit review
  bounds its file list independently from the comparison. Consulted installed
  Monaco diff-editor options, events and navigation documentation.
  Rebuilt native Fathom and reviewed the existing .gitignore changes in both modes,
  navigated between hunks and opened the file in the regular editor without editing.
  Opened Changes & commits through the command palette and exercised the same
  viewer and next-change action with 361 changed files in the bounded list. Closed
  review and quit. No model, commit or test was invoked. Rename/deletion/binary
  cases, stale-review refresh, editing directly inside a diff and narrow layouts
  remain unverified or incomplete. This is not completion of EDIT-02.

- Replaced Monaco's default syntax/widget palette and hard-coded 12px font with
  an editor theme adapter over the shared widget token reader. It consumes the
  approved code-preview's font-mono, text-sm, leading-relaxed and py-4 tokens;
  syntax, diagnostics, selections and suggestion surfaces/icons use semantic
  colors from design/tokens.css. Theme definitions are cached by resolved tokens
  so document updates do not redefine them. Apply the root theme attribute before
  notifying reactive consumers, allowing canvas widgets to read the new tokens.
  Consulted installed Monaco theme and symbol-color definitions. Rebuilt native
  Fathom and inspected TypeScript comments, keywords, strings, numbers and the
  completion menu in dark mode. Switched Appearance to Light with the editor open;
  the editor and suggestions repainted together with semantic icon colors. Restored
  Dark, discarded the temporary draft, closed its tab and quit. No model or tests
  were needed. This fixes code typography/palette fidelity; full editor geometry,
  Monaco diff presentation, other widget states and all-screen parity remain open.

- Reconciled editor and WebSocket size limits. One editor text validator enforces
  the same 4,000,000 UTF-8-byte limit for reads, draft changes, saves, recovery and
  completions, with binary/NUL rejection before writing. Shared transport constants
  allow 25 MB requests including JSON escaping; the client rejects larger requests
  before sending. Slow server connections now close explicitly at the buffer
  threshold instead of silently dropping events/responses. Consulted MDN's
  WebSocket send/bufferedAmount documentation. Rebuilt native Fathom, opened a
  3,030,000-byte document, edited and saved it, and read back the saved change.
  Opened a 3,999,999-byte Unicode document, added two ASCII characters, and saw the
  explicit 4 MB error with the dirty draft retained and connection still usable.
  Removed one character, saved successfully, and confirmed exactly 4,000,000 bytes
  on disk. Closed the clean documents and stopped the desktop verification app.
  No model calls or tests were needed. Slow-connection closure and maximum JSON
  escaping remain unverified; multi-document draft response scaling is still open.

- Used GPT-6 Astra through native Fathom to implement the LSP completion backend
  in sdk/editor.ts and plugins/editor/{index,lsp}.ts. Reviewed those changes and
  connected a separate Monaco completion adapter with model ownership, disposal,
  stale-result guards, edit validation and explicit LSP-to-Monaco kind mapping.
  Direct use exposed Deno returning insert/replace edits despite advertising only
  simple edits. Extended the SDK union and adapter to preserve both ranges, then
  advertised that supported capability. Consulted the official LSP completion
  specification and installed Monaco provider/type documentation. Diagnostic
  types now live in the browser-safe SDK instead of a backend implementation.
  Rebuilt native Fathom; typing greeting. displayed string methods, typing toUpper
  filtered to toUpperCase, and Enter inserted it. Added parentheses, saved, and
  read back greeting.toUpperCase(); from disk. Closed the clean tab, moved the
  temporary document outside the repository, and quit the desktop process.
  No routine model call or test was needed. Removed tracing instrumentation.
  Snippet/additional-edit acceptance, timeout/cancellation races, completion-item
  resolution, and custom language-server registration still need work or direct
  verification. The transport's 2.1 MB frame limit also needs reconciliation with
  the editor's larger text limit before claiming large-document support.

- Added fathom.split-pane around the approved EdgeResizer, with typed content
  containers, width/minimums and resize callback. It reuses the workspace handle's
  pointer, keyboard and reset behavior, and clamps to parent space. The portable
  split-view example composes existing registry message-card and diff instances.
  Rebuilt native Fathom; dragging changed the first pane to 517 CSS pixels, Left
  reduced it to 501, Home clamped it to the configured 180 minimum, and Enter
  restored the original 360 width. Child content remained visible and reflowed.
  No model was called. Documented caller-owned child cleanup and horizontal-only
  scope. Vertical splits, layout persistence, constrained parent resizing and
  interrupted drag disposal remain unverified or unimplemented as applicable.

- Added fathom.terminal as an adapter over TerminalPanel, with the panel depending
  only on the frontend request/event/project contract rather than concrete
  Transport. Exposed host.projectId and an autoStart option; plugin mounts default
  to attaching without creating a shell. Added a portable terminal-view example
  with theme observation and view cleanup. Rebuilt native Fathom, loaded the
  example, observed an empty terminal, explicitly created a shell, and ran printf
  to produce FATHOM_PLUGIN_TERMINAL_OK. Closed and reopened the plugin view;
  one Shell tab and its previous output returned. Stop changed the tab to stopped.
  No model was called. Documented frontend disposal versus backend process
  ownership. Concurrent views resizing the same terminal and session changes
  during an in-flight start still need direct-use verification.

- Exposed fathom.diff through the typed UI registry as a thin adapter over the
  existing DiffPreview. Added a portable diff-view example using the shared
  button to update between a supplied unified patch and empty content. Rebuilt
  native Fathom, observed +1/−1 counts and highlighted changed lines, clicked
  Clear preview and observed No text diff available, then restored the same
  preview with Show preview. Startup briefly showed the native blank window
  before the existing process completed initialization; no restart was needed.
  No files were patched and no model was called. Terminal and split-pane
  registry adapters remain open; large-patch performance is not verified here.

- Extracted MessageCard as the shared article/header container used by the main
  transcript and the new fathom.message-card registry adapter. The adapter reuses
  the existing Markdown renderer and accepts typed author, timestamp, status and
  text props. Extended the portable UI-kit example to update its card through the
  shared button, with existing spacing utilities. Rebuilt native Fathom and
  observed formatted initial content, typed Fathom, clicked Greet Fathom and saw
  the card change to Hello, Fathom. Reload remounted the example; Agent and Chat
  transcripts still rendered their shared headers and Chat history navigation.
  No model request was needed. Complex message attachments remain separate from
  this presentational adapter. Diff, terminal and split-pane adapters remain open.

- Added typed UI-component factories with update/dispose instances. The built-in
  registry adapts the existing Solid Button and Field components and reserves
  their names across plugin reloads; custom component registrations retain host
  lifecycle cleanup. Documented the unpublished registry signature change and
  added a framework-free ui-kit example. Rebuilt native Fathom and observed the
  inspector field with a disabled button, typed Fathom, observed Greet Fathom
  become enabled, and clicked it to display Hello, Fathom. Reload remounted one
  empty field/disabled button with built-in components still available. No model
  was called. Removed verification installation after use. Message cards, diffs,
  terminals and split panes still need registry adapters; custom-provider ordering,
  failed mounts and repeated disposal remain unverified.

- Wired frontend command shortcuts through the existing workspace key listener.
  Registration parses modifiers, rejects reserved/duplicate bindings and tracks
  bindings with command disposal. Dispatch ignores handled/composing/repeated
  events and open dialogs, catches command errors and prevents overlapping
  shortcut runs. The command palette displays declared shortcuts. Added
  Mod+Shift+U to workspace-info and documented syntax and boundaries. Rebuilt
  native Fathom; Command+Shift+U returned workspace metadata, the palette showed
  the hint, and invoking it inside the palette did not run behind the dialog.
  Removed the installed example, reloaded, and confirmed the shortcut no longer
  produced a notification. Conflict rejection, alternate keyboard layouts,
  Windows/Linux modifiers and asynchronous failure display remain unverified.

- Reordered the plugin guide so the runnable example, installation scopes,
  lifecycle and agent workflow precede service reference material; retained
  existing heading anchors and added direct navigation. Followed its copy
  instructions to install workspace-info in this repository. Native command
  discovery and execution returned fathom, Trusted and 3 sessions. Moved the
  unchanged files to the isolated profile's global plugins directory; the watcher
  raised a reload notice, reload retained exactly one command, and its RPC
  returned the same metadata. Luna discovered and called workspace_info through
  the native harness and reported the same result. Added the documented disable
  entry and reloaded; command search returned no matching commands. Verification
  copies/configuration were moved outside discovery afterward. This proves this
  example's repository/global command-tool workflow, not all plugin capabilities.
  Audit identified unwired frontend command shortcuts and a component registry
  without built-in UI-kit registrations as remaining extension work.

- Ported the shared ActionMenu to the approved context menu's native auto
  popover behavior and retained its imported design styles. Menus now use the
  top layer, clamp/flip against the viewport, reposition on scroll/resize, and
  reuse native outside dismissal instead of one document pointer listener per
  menu. Keyboard navigation skips disabled actions; Escape restores trigger
  focus. Followed the [Popover API documentation](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using).
  Rebuilt native Fathom and verified provider connection by pointer, replacement
  of an unanswered prompt (old placeholder cleared), cancellation, Escape
  dismissing only the menu, and outside dismissal. Conversation options used the
  same menu and pointer activation opened Rename; cancelled without changing the
  session. Initial pointer coordinates near the provider row's upper area still
  missed activation; a lower point within the action activated correctly.
  Extreme viewport sizing and scroll anchoring remain unverified.

- Reviewed Pi's installed MutableModels login contract and implementation:
  provider login uses the interaction abort signal through credential mutation.
  Fathom now cancels pending provider flows before logout, sharing the same
  cancellation helper used when replacing a login. The ten-minute deadline now
  records an explicit expiration error; late promise settlement preserves an
  already-terminal flow rather than overwriting its status. Native rebuild
  succeeded. In Settings, entered an unsent placeholder, activated a replacement
  login through keyboard menu navigation, observed one empty replacement prompt,
  then cancelled it. Pointer activation did not consistently replace the prompt
  in this run and needs follow-up. No credential was submitted or disconnected.
  Actual timeout display and logout racing credential persistence remain
  unverified; this is not completion evidence for all authentication recovery.

- Extracted provider listing, authentication resources/events, action state and
  disconnect confirmation from the Settings shell into ProviderSettings. Each
  provider now renders its own sign-in flows immediately beneath its row;
  provider IDs keep those rows stable across resource refreshes. Native use
  first reproduced OpenAI's API-key prompt appearing below the entire provider
  list. After rebuilding, the complete prompt appeared directly below OpenAI,
  with Continue disabled for an empty answer. Switching to Appearance and back
  restored the pending flow; Cancel sign-in removed it. No credential was entered
  or changed. OAuth completion, failure recovery and full settings design parity
  remain separate verification work.

- Fixed the detached transcript control with an opaque surface wrapper around
  the shared secondary button and shared arrow icon. Native Chat verification
  scrolled into history, confirmed the readable control, and clicked it to
  return to the latest message with the control removed. That exposed fixed
  transcript padding hiding message actions under staged feedback. Composer now
  reports its observed overlay height; the shared transcript reserves that
  height while retaining the approved grid and glass styling. Rebuilt native
  Fathom, verified unobscured latest actions in Agent and Chat, and expanded the
  three-comment browser tray to confirm the transcript follows the taller
  composer. Full screen parity and very short-window layout remain open.

- Compared production message actions and shared headers with the approved design
  components. Message action markup already matched. Legacy global h2/h3 sizing
  overrode the design's inherited base size in conversation and author headers;
  both shared components now explicitly use text-base. Rebuilt native Fathom and
  inspected Agent and Chat views. The title and author typography now follow the
  design token. Native Chat inspection exposed Jump to latest blending into the
  transcript; its secondary-button background conflicts with the surface class
  and remains the next focused control fix. Full screen parity is still open.

- Browser captures now persist their page scroll origin. Pins and area outlines
  offset their original coordinates using CDP frame scroll metadata. Native
  verification captured the top label on the local reference page as annotation
  3, scrolled to the next section and observed the new overlay leave the viewport,
  then returned to the top and observed its outline and pin align with the label.
  Legacy annotation 2 retained its old positioning, as expected without a saved
  origin. The reference server required recovery from empty responses after its
  earlier tool session ended; no app feature change was needed for that failure.
  Dynamic layout, fixed/sticky elements and nonzero-origin capture followed by
  scrolling still need verification. This closes the basic document-scroll gap,
  not the complete browser or design fidelity checklist.

- Used OpenAI GPT-6 Astra inside native Fathom to implement the bounds SDK,
  strict backend rectangle validation and scroll-corrected CDP capture in the
  three browser backend/SDK files. Reviewed its edits, then implemented native
  pointer dragging, cancellation and shared area outlines in the frontend.
  Switched back to Luna after substantive authoring. Rebuilt native Fathom and
  selected the Example Domain heading and explanation; the persisted bounds
  produced an 831 × 125 PNG containing exactly that crop. Escape cancelled a
  second unstaged rectangle while preserving the staged area. A temporary local
  scroll-reference page initially timed out, then loaded in the same browser;
  scrolling to its second section and selecting it produced the expected
  802 × 172 crop. Inspected both cached images directly. Capture follows the
  [CDP screenshot contract](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-captureScreenshot);
  drag capture follows [Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture).
  Saved overlays still use viewport-relative positions after later scrolling.
  Invalid-input RPC checks, navigation during capture and pointer cancellation
  outside the window remain unverified. This does not complete browser parity.

- Added one StagedFeedbackList editor for browser and artifact composer trays,
  using shared CommentField and controls. Editing state lives outside refreshed
  rows; send actions wait for editing to finish. Browser update/remove RPCs use
  the shared submission guard and preserve captured metadata. Rebuilt native
  Fathom and verified browser save, cancel and removal. Saving preserved annotation
  37695ecf-220b-4639-8475-896c570bdbaa and screenshot
  b6349d7a-6eba-45f6-9906-d9964a1ac898; removal cleared its pin and draft.
  Staged an artifact comment in the viewer, edited its passage and comment in the
  composer, and observed the saved passage in the viewer. Storage confirmed both
  updated fields. No model request was needed. Interrupted saves, session switches
  during edits and concurrent editing across surfaces remain unverified.

- Added the replaceable FeedbackService coordinator and separate RPC integration.
  Artifact and browser plugins register source preparation/reconciliation instead
  of owning independent submission locks. Existing source-specific routes and
  the composer's Send all staged feedback action use the same coordinator;
  combined admission carries all source IDs and media in one follow-up. The SDK
  and plugin guide document source ownership, lifecycle and mutation guards.
  Rebuilt native Fathom and staged browser feedback alongside an existing artifact
  comment. The browser draft appeared live in the composer. Combined submission
  produced one accepted message (9293b1f1-b863-46b8-9597-425f9056f3b1) containing
  artifact-feedback, browser-feedback and media attachments. Luna summarized both
  sources; both draft stores became empty and the browser pin cleared. Forced
  preparation/admission failures, third-party source registration, replacement
  providers and cross-process recovery remain unverified for this coordinator.

- Moved browser batch review and clear/send actions above the prompt. Browser
  and artifact groups reuse FeedbackTray, and their viewer/composer resources
  share sessionDraft subscription and cleanup. Removed the old browser tray and
  its CSS. Rebuilt native Fathom and verified two persisted browser comments and
  one artifact comment appeared in the composer. Expanded browser feedback,
  reviewed both page URLs and comments, and sent the batch with the browser
  closed. Luna summarized both comments; the browser tray cleared while the
  artifact draft remained. Read-only storage inspection confirmed zero remaining
  browser comments and one accepted batch with two media attachments. Combined
  source submission, composer editing and fresh cross-surface staging still need
  implementation or direct-use evidence.

- Fixed browser annotation pins being renumbered independently on each page.
  Pins now use their position in the complete batch, matching the tray. Rebuilt
  native Fathom, staged a second comment on example.org, and observed pin 2 and
  tray item 2. Navigating back to example.com restored pin 1 while both tray
  items remained. No model request was needed for this interaction check.

- Browser feedback controls now share a guarded clear/send action with progress
  labels, disable conflicting staging and submission, and follow session events
  for draft refresh. Annotation pins track the loaded URL rather than unfinished
  address edits. Rebuilt native Fathom and verified a restored pin remained on
  the loaded Example Domain page while the address field contained a different,
  unsubmitted URL. Opening a comment disabled Send feedback; cancelling restored
  it and preserved the existing staged batch. Delayed-response controls and
  cross-surface refresh still need direct-use evidence.

- Browser annotations now store screenshot references through the shared media
  cache instead of embedding PNG data in settings. Annotation persistence and
  submission live in a separate module from browser controls. Browser and
  artifact feedback reuse the same accepted-ID reconciliation helper. Submitted
  browser screenshots become normal media attachments, and the transcript uses
  the shared annotation summary component.
  Native verification migrated one existing screenshot, submitted it once with
  its feedback ID and media attachment, and cleared the accepted browser draft.
  GPT-5.6 Luna identified the Example Domain heading and summarized the requested
  change. A fresh point annotation then rendered its pin and staged comment;
  read-only storage inspection confirmed a 17,182-byte cached PNG reference and
  no embedded image. Plugin documentation explains cache ownership and delivery.
  Crash recovery and cross-process contention remain unverified. Unused cache
  cleanup, cropped captures and unified composer feedback remain open; automatic
  vision context still admits only the latest four images within its 8 MiB budget.

- Replaced the browser's native comment prompt with an inline selection editor.
  Browser and artifact feedback now share CommentField, including label, input
  sizing, 4,000-character limit and disabled state. Selecting a browser point
  focuses the editor; Stage and Cancel stay inside the workspace. Staging checks
  session existence, nonblank comment length, a 20-comment cap and page identity
  before/after capture. Annotation loading is keyed to the selected session;
  stale draft selections clear on session/navigation changes. Toolbar actions
  now use text/shared close icons instead of Unicode glyph controls. Native build
  passed. Opened example.com inside native Fathom, selected its heading, entered
  a comment and staged pin #1 with the expected tray text. Cancelled a second
  draft, switched sessions to confirm pin/tray isolation, then switched back and
  recovered the original staged comment. No model request was needed. Screenshot
  binaries still use the old settings storage; area selection, durable submission
  reconciliation, unified composer staging and complete browser design parity
  remain open. Stopped the app and its owned browser after verification.

- Hardened the default artifact service's direct-call boundary: validate session,
  filename, content, title and supersedes before writing; require titles of
  1–200 characters and trim them. Publish private files with atomicCreate rather
  than replacement. Recheck revision availability inside the metadata transaction
  after the async file write, so a concurrent revision cannot silently reuse a
  superseded target. On persistence failure, inspect recorded entries before
  removing the new file; retain it when persistence is recorded or uncertain.
  Native build passed. Luna's actual blank-title attempt returned Use an artifact
  title between 1 and 200 characters, then valid creation/readback returned
  Validation ready. SQLite/cache inspection found exactly one matching entry
  (`13d13e46-8f0f-4980-ac3d-9d03d531cd73`) and one mode-0600 file. Concurrent
  creators, database failure cleanup and ambiguous commits remain unverified;
  the final cleanup guard was reviewed and included in the successful follow-up
  build. Reopened the artifact in the native viewer after restart and confirmed
  Validation ready, then stopped the app.

- Separated artifact persistence from stable integrations. The default
  fathom:artifacts plugin now requires only storage, workspace, runtime and
  events; fathom:artifact-integration consumes its service and owns tool/RPC
  registration, feedback and model-context projection. Context now points to
  artifact_read by ID instead of assuming a private file layout. Documented
  provider replacement, required metadata contracts and whole-feature disabling.
  Native build passed. In the isolated development profile, disabled the default
  provider and installed a temporary alternate provider wrapping the same storage
  implementation, marking returned titles with Provider check. The native viewer
  displayed marked list/read titles with unchanged content. Luna's artifact_catalog
  call returned Provider check: Service check and eight artifacts, proving consumer
  and viewer integrations resolve the replacement service. Moved the temporary
  provider/config out of discovery, relaunched and confirmed the default titles
  returned. Verification files are retained in
  `/tmp/fathom-artifact-provider-verification/`; the default configuration is
  restored. Stopped the native app afterward. This verifies provider substitution
  and read paths, not a second persistence implementation or all write failures.

- Used OpenAI GPT-6 Astra inside native Fathom to implement ArtifactInput and
  ArtifactService, declare/provide the artifacts Cordis service and route the
  existing artifact tools/RPCs through it. Reviewed the actual source changes;
  branch checks, immutable files, export preflight/non-overwrite writes and
  approval flow remain in the shared implementation. Exported artifact service,
  input and feedback types from the public SDK. Added a portable read-only
  artifact-catalog example and documented repository/machine installation and
  backend API use. Installed the example in the development profile's global
  plugin directory. Native build passed. Switched to Luna: its native tool log
  showed artifact_catalog, then artifact_read; it reported seven visible
  artifacts and read Counter demo revision
  `9e3b1fd4-9ba7-4008-bed6-e201e6480984`. The native viewer also opened that HTML
  revision through the refactored RPC. This proves a consumer plugin can receive
  the service through Cordis; replacing the provider while preserving separate
  UI/tool bindings remains unfinished architecture work. Approval/export failure
  paths were not re-exercised during this refactor. Luna then created and read
  `446947cd-121b-4251-9fbd-ab01e78222ea` through the refactored tools; the native
  card showed Service check and readback returned Artifact service ready.
  Stopped the app after verification. The example remains installed only in
  `/tmp/fathom-dev-data/plugins/` for subsequent extension work.

- Continued active-message fidelity and reuse: ported the approved chip primitive
  into a shared Solid Chip and used it for submitted artifact-feedback annotation
  counts, matching the design attachment summary layout and icon. Media spacing
  now depends on actual media attachments instead of any attachment metadata.
  Copy is absent for messages with no copyable text; built-in Artifact, Media
  and Approval headings no longer expose raw lowercase event names. Artifact
  status projection is memoized once per transcript and passed to message bodies,
  removing repeated full-history scans per card. Native builds passed. Agent and
  Chat showed the submitted one-annotation chip; custom artifact cards retained
  Copy message link without the empty Copy action. Current and older cards showed
  Pending review and Superseded respectively after the lookup refactor. Stopped
  the native app after verification. This is a focused fidelity pass, not proof
  of complete screen parity or overall transcript performance.

- Added a composer feedback tray using the shared Disclosure, Icon and Button
  components. A shared feedback resource helper serves both viewer and composer,
  follows session events and disposes its subscription with the component.
  Persisted comments appear above the input, expand into a bounded list and open
  their exact artifact revision through Review and send. Editing/submission
  remain in the shared viewer form. Native build passed; launch restored the
  staged area comment, review opened the correct counter revision, and editing
  its comment updated both surfaces immediately. Switching sessions cleared the
  tray. That check exposed stale artifact-read errors on session changes;
  selection errors now use the same session/version guard as successful reads.
  A final native build verified switching without the stale error and the shared
  tray in both Agent and Chat modes. Direct composer submission/editing, browser
  annotations, numbered pins and visual crops remain open. Stopped the app after
  verification; no new model request was needed for these UI checks.

- Added rectangular HTML area selection and Escape cancellation. Extracted the
  serialized preview picker from the HTTP response module; element and area
  modes share overlay rendering, DOM context and bounded messaging. Pointer
  capture keeps a drag coherent at element boundaries; switching modes, scroll
  and cancellation clear the current drag. Consulted MDN setPointerCapture
  documentation. Native build passed. In the Luna-created counter revision,
  dragging an area populated Selection: area, its center element and bounds
  x=8, y=72, width=297, height=81 document CSS pixels. Staged those details in
  the existing feedback tray. Escape inside the frame restored the normal
  controls. Element selection still left Count: 0 unchanged, and the next
  ordinary click changed it to Count: 1. Numbered pins, visual crops, composer
  tray integration and browser/simulator reuse remain open. The staged area
  comment remains in the development profile for follow-up verification.

- Added HTML element selection through the shared artifact feedback form.
  Native use with Luna created `f09a033c-473c-4fb5-9682-b0d5aa5c9827`, a
  self-contained counter widget. The first native check exposed that srcdoc
  inherited the main app policy and blocked both widget and picker scripts.
  Previews now use an authenticated, branch-visible HTML response with its own
  opaque-origin sandbox policy. The main app policy is unchanged; preview
  network connections, external resources, forms and nested frames are denied.
  Consulted [MDN sandbox documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/sandbox)
  and postMessage source/origin guidance. In the rebuilt native app, a normal
  click incremented Count: 0 to Count: 1; element selection kept Count: 1 and
  populated hierarchy, id, class, text and document bounds. Staging preserved
  those details across reopening the viewer. Messages are bounded and checked
  against the selected frame, opaque origin and per-preview channel; selection
  only fills an editable passage and never submits an agent request. Area
  selection, numbered pins, visual crops and full annotation design fidelity
  remain open. Staging also exposed a shared session identity refresh bug;
  sessionId is now memoized so updates do not clear a card-opened artifact.
  The final native build passed. After restart, the staged HTML selection was
  restored; editing and sending kept the card-opened preview visible. Luna
  created revision `9e3b1fd4-9ba7-4008-bed6-e201e6480984`, preserving the old
  version. Its native preview showed the requested explanation and the counter
  still incremented on click. Quit the verification app afterward.

- Added staged-feedback editing with shared text validation and a transactional
  update RPC. Edit focuses the comment field; save replaces the existing row,
  cancel preserves it, and dispatch is disabled during editing. Backend edits
  are rejected during submission. Native use staged one comment, edited it to
  request Version four verified and confirmed one row remained. A separate
  process then held the snapshot lock: Send failed with inline busy feedback
  while preserving the edited tray. After release, retry succeeded and Luna
  created `1489eb74-0322-4f0a-a25c-a79bc301ff5f`; its native preview showed
  Version four verified. SQLite inspection found feedback ID
  `ae182d3d-159c-4837-9f9e-8cc7357b2e0d` in exactly one accepted entry and an empty
  tray. This verifies admission-failure recovery; lost-response/crash recovery
  and cross-process draft mutation remain unverified. Follow-up polish groups
  Edit/Remove with shared spacing, fixes singular confirmation text, and derives
  viewer approval availability from the refreshed branch list so superseded
  previews cannot keep an enabled approval button.

- Added artifact passage feedback and a durable staged-comment tray. The viewer
  captures selected text only within its preview, supports an optional manually
  entered passage and stages up to 20 comments with 4,000-character limits per
  passage/comment. A separate artifact feedback module registers list, stage,
  remove and send RPCs under the artifact plugin lifecycle. Staging is stored in
  per-session SQLite settings. Send validates branch visibility and dispatches
  one follow-up carrying feedback IDs as entry attachments; list reconciles
  accepted entry/queue IDs before removing drafts, supporting retry after an
  interrupted response. Native build passed. In the native viewer, selecting
  Version two populated the passage. Two staged comments survived closing and
  reopening the panel. Send produced one accepted entry with both IDs and an
  empty persisted tray. Luna created revision
  `2c5a922e-c3fb-4408-ac12-d1b0010b0274`; the open artifact list updated and its
  preview showed Version three, preserving prior revisions. No workspace files
  were changed by that revision request. Consulted MDN getSelection and contains
  documentation for selection boundaries. HTML element/area overlays,
  crash/reconnect and admission-failure recovery, cross-process contention,
  staged-comment editing and complete annotation design fidelity remain open.

- Moved Artifacts from a modal into a reusable WorkspacePanel beside the
  conversation or editor. The panel imports the approved design EdgeResizer
  implementation directly and uses its existing shared CSS, drawer width token,
  border, spacing and header controls. A first build caught duplicate standalone
  Tailwind processing; removing the redundant stylesheet copy fixed it. The
  final native build passed. Selection requests now ignore stale completions,
  card targets can change while the panel stays open, session changes clear
  stale previews, and session events refresh the artifact list. Resource errors
  no longer read through a failed Solid resource. Native use verified opening
  alongside the conversation, dragging the panel narrower, viewing Version two
  beside an open AGENTS.md in Monaco, and switching to another conversation
  where the panel correctly showed its empty artifact list. No model request
  was needed. Keyboard resize, narrow-window behavior, HTML viewport sizing,
  selection during concurrent requests and annotation workflows remain open.

- Added direct approval on pending Markdown artifact cards and extracted the
  shared ArtifactApproval component used by both cards and the viewer. It owns
  pending/completed state, prevents repeat local clicks and displays inline
  failures. The artifact backend rejects overlapping approvals for the same
  session/artifact within its project instance and clears that guard in finally.
  Native build passed. Luna created `3f97516c-beb0-4414-8c9d-1daab2fd5b15`
  (Card approval check); its pending card showed both viewer and approval actions.
  Clicking Approve & proceed directly submitted the follow-up, rendered the
  approval confirmation and removed the now-inapplicable card action. Luna replied
  `Approval card verified` and returned idle. Concurrent
  cross-process approval deduplication and request-failure recovery remain open.

- Artifact entries now render a shared compact ArtifactCard instead of raw
  metadata, with file icon, title, name, byte size, branch-derived status and
  Open in viewer. The selected artifact ID flows to the viewer so a card opens
  its exact immutable revision. Approval entries render a concise confirmation.
  Backend listing and frontend cards reuse the SDK's `artifactsOnBranch` status
  projection. The native build passed. Native Agent mode showed the superseded
  Revision demo card; its action opened Version one with approval disabled.
  Chat mode reused the same card and layout tokens. Existing entry renderer
  overrides continue to wrap the default MessageBody, allowing plugins to
  replace this presentation. Direct approval from pending plan cards, docked
  viewing, annotations, complete artifact fidelity and large-history performance
  still need work. No new model call was needed for this verification.

- Added immutable artifact revisions through the optional `artifact.supersedes`
  tool parameter, moved the shared Artifact type into the SDK, and derive status
  from branch-local artifact and approval entries. Approval now targets the
  active conversation rather than the artifact's originating session, rejects
  superseded/already-approved versions and records approval after submission
  succeeds. The viewer disables repeat approval while pending and separates
  version rows. Content limits now count UTF-8 bytes. Luna created versions
  `78b4eb30-10f8-4d27-9b33-793a051ddb98` and
  `9e63455a-a56b-4632-887c-ec03f16ca682` through native Fathom. Both immutable files
  remained outside the repository. Native use showed the first as superseded
  with approval disabled and the second pending. Switching exposed stale preview
  content; keying the selected revision fixed it, verified after a native rebuild
  and restart by switching from Version one to Version two. Approving the second
  emitted the follow-up and artifact-approval entry in this conversation. Luna
  acknowledged approval and returned idle; reopening the list showed approved.
  Forked approval isolation, simultaneous approvals and failure recovery still
  need direct verification. Transcript cards, docked viewer, annotation staging
  and complete artifact design fidelity remain open.

- Fixed stale submission feedback: starting a new composer send clears the old
  workspace error before admission. Submission and subsequent refresh failures
  are now handled separately, so a refresh error after accepted admission does
  not cause the composer to retain an already-submitted prompt for resend.
  Native build passed. Repeated the separate-process lock exercise: the new
  actionable snapshot-busy banner appeared, the draft remained, and model calls
  stayed at 18. After lock release, sending the same draft immediately removed
  the banner and completed with Luna (`retry feedback recovered`), returning to
  idle with 19 model calls and an empty composer. This closes the stale-banner
  issue noted below. A post-admission refresh failure has not been induced.

- Snapshot operations now combine lock-compromise cancellation with plugin
  lifetime cancellation: disposing a project aborts active Git work and rejects
  queued work before it acquires ownership. Cleanup feedback now distinguishes
  an unconfirmed client request from a completed backend failure; a timed-out
  request can still be running. Native build passed. A separate live process
  held the development project's proper-lockfile lock for 30 seconds while a
  Luna request was submitted through the native composer. Admission exhausted
  its bounded retries, remained idle with model usage unchanged, and preserved
  the prompt in the composer. After the holder released its lock and exited,
  resubmitting the preserved draft completed with Luna (`snapshot lock recovered`),
  proving the queue recovered. The earlier error banner remained visible after
  successful retry; that UI issue remains open. The raw lock-library error exposed by this use
  has been replaced with an actionable snapshot-busy message. Project disposal
  during active Git work and timeout feedback still need direct verification.

- Added a snapshot cleanup service contract, project-scoped RPCs and a reusable
  Storage Settings cleanup section. The review selects snapshots unused for
  30 days. Execution rechecks eligibility under the cross-process lock, limits
  deletion to reviewed tree IDs and checks each ref's expected object before
  deletion. Foreground GC holds the lock until completion and can be retried
  with no eligible refs after a partial failure. Legacy refs receive fresh
  retention records; malformed records remain protected. Existing conversation
  entries are preserved. The native build caught an incorrect plugin cleanup
  return type, corrected to the SDK's scoped effect lifecycle; the next build
  passed. Native Settings review showed 0 eligible and 40 retained snapshots,
  displayed restoration consequences and legacy retention policy, and Cancel
  returned to the review action. Deletion, space recovery, contention and
  interrupted cleanup have not yet been exercised. No snapshots were deleted.

- Snapshot retention now records one atomic, private last-used timestamp per
  tree under `shadow.git/fathom-retention/`, inside the shared snapshot lock.
  Capture refreshes it before returning to admission; restore refreshes both
  its target and backup before changing workspace files. This closes the gap
  between capture and recording the user entry that future age-based pruning
  must respect. The shared atomic writer accepts an optional AbortSignal and
  checks it before publishing. A native build passed, then two Luna requests
  captured the unchanged workspace tree `94687f9f9c0ee7031fb5f1cfc629bd146128a2f8`.
  Direct metadata inspection showed the same 0600 record advancing from
  `1789462912262` to `1789462933082`; both responses completed in the native app.
  Restore timestamp updates and interrupted publication remain unverified.
  Pruning must treat missing/invalid retention metadata conservatively, account
  for existing snapshots, and recheck eligibility under this same lock before
  deleting refs. No pruning action is implemented or exercised yet.

- Astra implemented cross-process snapshot locking through native Fathom in
  session `6e338112-ca94-4637-8e4f-1d8eb8927bae`. Snapshot initialization,
  exclusion writing, capture, restore and existence checks now share a
  proper-lockfile lock alongside the existing in-process queue. Acquisition
  retries are bounded; heartbeat compromise aborts Git subprocesses and prevents
  subsequent mutations, and ownership is released in finally. The native build
  passed. Luna then exercised admission and inspected the source through the
  running app. Cross-process contention, stale ownership recovery and restore
  under contention remain unverified; snapshot pruning remains open.
  That use exposed four false diagnostics caused by omitted LSP workspace
  capabilities. Deno 2.9.6 skips workspace discovery without that field; the
  initialization handshake now includes it. After rebuilding, Luna's native
  diagnostic request reported no diagnostics and the inspector showed zero
  errors/warnings. This verifies nested `app/deno.json` discovery in this repo;
  larger workspace discovery limits and live configuration changes remain open.

- Added Storage Settings and the replaceable `fathom:resources` service with
  shared SDK report types. It inspects all projects under the active profile,
  classifies snapshots/artifacts/media/SQLite/other files, includes SQLite sidecar
  files, and exposes predefined resource-folder actions. Metadata traversal skips
  symbolic links, handles disappearing files, marks unreadable/limited scans as
  partial, and has 15-second/100,000-path bounds with disposal cancellation.
  The Meter component copies the approved `design/primitives/meter.ts` dimensions,
  tokens and range normalization. Native use showed 8.7 MiB across the development
  profile, including 1,529 snapshot files and 12 media files. Refresh updated the
  timestamp and total as files changed. Open projects folder opened the expected
  `/private/tmp/fathom-dev-data/projects` directory in Finder; its verification
  window was closed. The empty artifacts-folder action returned a clear error;
  that check exposed feedback below the visible panel, so folder errors now sit
  beside their row. The final native build verified that inline placement.
  No model request or data deletion was needed. Partial-scan,
  unreadable-path, symlink and Windows/Linux folder behavior remain unverified.
  Snapshot pruning, cache cleanup and exact allocated-disk accounting remain open.

- Added the approved Copy message link action, a shared SDK formatter/parser,
  and an Open message link command using the existing modal, field and button
  primitives. Stable `fathom://message/` references contain project/session/entry
  IDs rather than Deno's launch-specific HTTP port. Navigation resolves only
  registered projects, uses normal project/session loading, validates branch
  membership, and focuses the containing message group. Transcript focus detaches
  from streaming follow behavior while retaining Jump to latest.
  Native use copied an older media entry, switched to a different conversation,
  reopened the link, and focused the correct older entry. A non-Fathom URL was
  rejected inline. After quitting and relaunching on a different port, the same
  clipboard link reopened the same entry. OS protocol registration, cross-project
  navigation, removed-entry errors and concurrent selection changes remain open
  verification/integration items. No model request was needed for these UI checks.

- Consolidated button and link appearance in one shared style function.
  Media downloads now use a semantic LinkButton with the same size, typography,
  color and interaction styling as adjacent actions. The media action group uses
  one wrapping layout instead of independent left margins. Compared against
  `design/primitives/button.css`: normal quiet buttons now use the approved
  padding and ink color, compact buttons retain full hover opacity, and secondary
  hover fills apply to the compact size. Tailwind's negated disabled variant
  preserves enabled button behavior while supporting anchor hover states.
  Rebuilt and used native Agent and Chat views, opened and closed the image
  preview, and exercised the copy-image control. Full button-variant coverage
  and the remaining cross-screen design audit are still open.

- Added OpenAI Images and Responses adapters under the existing native-image
  contribution. Direct GPT Image 2 uses JSON generation and multipart edits;
  the separate Responses selection uses Luna with GPT Image 2 pinned in its
  image tool. Both return PNG assets through the shared cache pipeline, reject
  incomplete responses and reuse Pi's OpenAI API-key auth. Shared HTTP handling
  now accepts FormData without overriding fetch's multipart boundary. Read the
  official image guide and Luna model capabilities before implementation.
  The native bundle built and launched, retained Luna and the xAI image selection,
  and displayed the previous cached edit. Provider settings correctly show
  OpenAI and Google as not connected. OpenAI live generation, editing and
  Responses calls remain unverified because no Platform credential is available;
  the existing ChatGPT subscription credential is not used for these endpoints.
  A native Luna run then generated a green circle through xAI using the changed
  shared transport. The preview appeared and the run returned to idle; its cached
  JPEG is 51,512 bytes with a JPEG signature and 0600 permissions. No workspace
  file was requested. This verifies the JSON path, not OpenAI's multipart or
  Responses behavior.

- Added `fathom:native-images`, a Cordis contribution requiring the existing
  images service. It registers xAI and Google Pi ImagesProvider instances and
  disposes only its own registrations. Provider auth comes from Pi's existing
  chat-provider definitions. Shared bounded JSON transport handles cancellation,
  timeouts and payload/response callbacks without automatic generation retries.
  xAI follows its JSON generation and single/multiple reference edit endpoints;
  Google maps text/image parts through generateContent and excludes thought parts.
  Read installed Pi contracts and official provider documentation before coding.
  Native desktop use with Luna selected xAI using the existing OAuth credential,
  generated a teal circle, then edited it to dark blue with a reference asset.
  Both cached files have JPEG signatures and 0600 permissions (58,462 and 61,532
  bytes); the edited image persisted after the final rebuild and restart. No
  workspace image files were created. Google has no credential on this machine,
  so its live requests remain unverified. Multi-reference edits, cancellation,
  malformed responses and native image-cost accounting remain open.

- The successful run exposed a stale retry banner after provider recovery.
  Retry notices now belong to the selected session separately from persistent
  notices and clear on streaming or refreshed non-retry state. The final desktop
  build launched cleanly, but a fresh live retry/recovery cycle still needs direct
  verification. Image settings no longer suggest OpenRouter is the only adapter.

- Used native Fathom with OpenAI GPT-6 Astra to implement shared destination
  preflight in `kernel/files.ts`, image generation, media export and artifact
  export. Reviewed the resulting four files, rebuilt the desktop app, then used
  Luna for functional checks. `assertNewFile` uses `lstat`, permits only NotFound,
  rejects existing entries without creating files, and leaves atomicCreate as
  the final no-overwrite guard. Image generation checks explicit blank paths,
  workspace boundaries and existing destinations before the provider request.
  Native Luna received the blank-destination error. Native export rejected an
  existing repository image and saved a new PNG whose 712,002 bytes matched its
  cached asset. The existing image's SHA-256 stayed unchanged and image-generation
  usage records stayed at one. The new export fixture was moved outside the repo.
  Automatic approval review stopped the existing-destination generate_image
  attempt before execution, citing overwrite risk; that attempt was declined and
  is not evidence that generation preflight ran. Artifact export, directory and
  dangling-symlink preflight, and concurrent destination creation remain unverified.

- Added image clipboard copying and paste-to-draft. Copy starts during the user
  gesture, prepares a PNG asynchronously, and reports permission/decode errors.
  Non-PNG images become still PNG snapshots; downloads retain original bytes.
  Native use copied the JPEG transcript fixture, pasted it as a 712,002-byte PNG
  draft, and queued it during a Luna shell run. Editing the queued prompt retained
  the image, and Luna honored the revised five-word request after the run settled.
  Clipboard failure and animated-frame behavior remain unverified.

- Follow-up admission now removes its queue item in the same transaction that
  appends the user entry. Steering shares a transactional flush helper. A native
  verification plugin rejected one explicit queued prompt: its text and image
  remained queued and survived restart. That exercise exposed stale running UI
  after rejected admission; submission now publishes after clearing admission
  state. Added Send now for idle queued messages through `runtime.sendQueued`
  and `queue.send`, reusing admission and queue mutation UI state. Native retry
  showed the rejection with idle controls, then editing away the rejection
  marker successfully sent the retained image and Luna described it. The temporary
  rejection plugin was moved out of discovery, and the native app was stopped.
  Concurrent queue edits during
  admission and crash interruption of the transaction remain unverified.

- Composer media is staged separately from conversation history, with bounded
  binary upload, durable per-session references, removal, and attachment metadata
  carried through Send, Steer and follow-up queues. Media storage remains a
  Cordis service; runtime and context use generic `EntryAttachment` contributions.
  UI draft state is separate from `ComposerMedia`; `ImageThumbnail` shares the
  approved thumbnail and full-size modal between draft and transcript views.
  Native use with Luna verified file selection, draft preview, restart recovery,
  removal without a model call, and image submission with a correct visual reply.
  The temporary entry-renderer fixture was moved out of plugin discovery.
  Edit-and-resend retained the image and Luna correctly named its colors.
  Text collapsing no longer clips attachment controls. Queue media, interrupted uploads, limits
  and admission failures still need direct-use coverage. Removed cache files are
  retained pending pruning; acceptance and draft cleanup are not crash-atomic.

- Added `fathom:media-context` as a separate Cordis plugin. It hydrates recent
  branch-visible image references in `step:model`, after normal context
  assembly/compaction and immediately before provider dispatch. Stored context
  remains metadata-only. Vision-capable models receive at most four images of
  up to 8 MiB each; text-only models keep references, and unavailable content
  gets an explicit omission message. In rebuilt native Fathom, Luna compared
  the two previously imported depth images (dark navy/teal versus pale blue-gray)
  and identified the generated teal circle on white without tools. The run
  completed idle. Read-only SQLite inspection found zero matches for the three
  image payload prefixes in entries, executions or usage; media entries were
  423–438 bytes. A new compaction run, missing-file/size-limit handling and
  text-only model behavior remain unverified. Composer image upload is still
  missing; media currently enters through import/generation tools.

- Added the `images` Cordis service using Pi 0.85.1's documented separate
  `ImagesModels` API and shipped OpenRouter image provider. Existing Pi
  credentials are shared through the same locked adapter. Providers settings
  now selects a dedicated image model; Disabled hides `generate_image` through
  the shared tool capability gate used by discovery and execution. Results use
  the media service, optional reference assets are branch-scoped, destination
  export refuses overwrites, and reported usage is attributed to image generation.
  This is an explicit image-role selection independent of the chat model.
  Native Luna discovered and called the tool after selecting Google Nano Banana
  (Gemini 2.5 Flash Image) through OpenRouter. A real provider request generated
  a teal circle on white: asset `eae4dc97-1584-4c3a-be28-ee3570f6fe25`, 496,057
  bytes, file mode 0600. The native transcript showed its thumbnail and the
  preview opened. The square image exposed a preview-height issue; the component
  now reserves space for modal padding and controls. Native OpenAI/Google/xAI
  adapters, reference-image requests, destination generation, cancellation,
  error recovery and accurate provider-billed image costs remain open.
  Rebuilt the final source: the generated image and image-model choice survived
  restart, and the full square preview plus Close preview control fit inside
  the native dialog without scrolling.
  Switched image generation to Disabled, then used native Luna's `search_tools`
  with `generate_image`; inspected the execution card's empty `[]` result.
  Restored the verified Nano Banana image selection. The chat model remains Luna.

- Native audio use exposed a workspace-resolution bug: macOS `/tmp` resolves to
  `/private/tmp`, so importing Fathom's own project scratch file failed with
  `Symlink points outside the authorized workspace`. The workspace service now
  compares resolved targets with canonical authorized roots, while accepting
  either spelling of a root. Rebuilt native Fathom and used Luna to import the
  same scratch WAV successfully: asset `bbdc5641-5e8c-4041-b81f-7f86d5d32fef`,
  384,044 bytes. The player loaded its 12-second duration; clicked Play, sought
  to 0:08, and paused at 0:07 on a subsequent seek. Audible output quality and
  large-file range behavior were not independently verified.
  A separate outside-root symlink import was rejected by automatic approval
  review and declined before execution, so this does not establish direct-use
  coverage of the resolver's negative case. Removed that disposable symlink
  and its target; the scratch sample and cached audio remain for follow-up use.

- Added media workspace export through the Cordis service, frontend RPC, deferred
  `export_media` tool and shared export dialog. Both media and artifact export
  now use `atomicCreate`, which publishes a fully written temporary file using
  a no-replacement hard link; the old artifact existence-check/write race is
  removed. Consulted [Deno's filesystem API](https://docs.deno.com/api/deno/file-system/).
  In rebuilt native Fathom, saved an imported JPEG to a new workspace path;
  the 85,602-byte result matched its source and had mode 0644. Attempted to
  export over the different `home-depth-light.jpg`: the dialog reported
  `Destination already exists; choose a new path`, and that file still matched
  its earlier cached copy. An outside `/tmp` destination was rejected with
  `Path is outside the authorized workspace`. Artifact export's updated caller,
  concurrent exports and filesystems without hard links need further direct use.
  Native Luna also discovered and called `export_media`, returned the requested
  new path, and reached idle. Its exported JPEG matched the source. Moved both
  verification exports out of the repository into `/tmp/fathom-export-evidence/`.

- Used native Fathom with OpenAI GPT-6 Astra to author and read back
  `MediaPreview`, then reviewed and integrated it. Image thumbnails use the
  approved message-attachment dimensions, border, background and image-fit
  classes; the shared Modal opens the full image. Audio/video use native controls
  without autoplay. Media entries retain frontend renderer override support.
  Authenticated HTTP delivery resolves branch-visible assets through the Cordis
  media service, with download headers and single-range responses based on
  [MDN's range-request guidance](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests).
  Rebuilt native Fathom, viewed the imported JPEG thumbnail, opened the full-size
  preview, closed it with Escape, and clicked Download. Native download history
  reported `home-depth.jpg`, 83.6 KB, Done; the downloaded file in Downloads
  matched the source byte-for-byte. Restored Luna after Astra's implementation.
  Audio/video playback and seeking, missing-asset errors, authorization rejection
  and cross-branch delivery still need direct-use verification. Copy-image,
  workspace export and provider generation remain open.

- Added the project-scoped `media` Cordis service and SDK contracts. Binary
  assets use private atomic files under the project data directory; timeline
  entries hold metadata only. Save/list/read are shared by extensions, and
  reads resolve only media referenced by the current session branch. The
  deferred `import_media` tool imports workspace files without modifying them.
  Native Luna imported `design/site/assets/home-depth.jpg`, reported asset
  `5853c1db-4eb3-4dd8-8bef-588253a9d2f9` and 85,602 bytes, and returned to idle.
  The cached JPEG matched the source byte-for-byte and had mode 0600. The
  record survived a native restart. The final build's bounded reader also
  imported `home-depth-light.jpg` through Luna: asset
  `5be4b396-7a32-4850-914f-8d6fc9034508`, 107,426 bytes, source-identical, idle.
  The
  transcript currently shows metadata through the custom-entry fallback;
  design-matched preview/player controls and provider generation remain open.
  Missing-file/branch rejection, oversized files, audio/video and interrupted
  writes still need native verification. Import filename extensions determine
  MIME; backend callers must supply a MIME type matching their bytes.

- Shutdown requests share one cleanup promise, so repeated callers wait for the
  same disposal. HTTP shutdown runs even if application disposal rejects; signal
  callbacks request the desktop close path when available. Rebuilt and used the
  native app, then sent SIGTERM to its observed process: it exited, but generated
  cache remained. The desktop runtime appears to terminate before asynchronous
  signal cleanup finishes; graceful native signal cleanup is not established.
  Relaunched the same bundle and used Cmd+Q: its new cache directory
  `c3271296-dbbe-42f8-bdc4-d9ad1819e8cd` was removed and the native process exited.
  Older orphan directories remain untouched. Force-termination cache recovery
  and a hung-plugin shutdown policy remain unfinished.

- Transcript tool groups now use the approved file-operation summaries, retain
  failed/cancelled counts, and share human-readable labels with execution cards.
  Thinking and tool groups reuse one disclosure component with the approved
  spacing and independent rotating carets. Rebuilt native Fathom and opened the
  earlier Astra turn: thinking text expanded, two successful file reads and one
  failed read appeared with the correct labels and failed state. Used GPT-5.6
  Luna for a simple read of the first eight lines of `AGENTS.md`; the native
  transcript completed with `1 file read`, opened its `Read file · AGENTS.md`
  card, and returned to idle. Active-tool labels, queued/cancelled summaries and
  keyboard disclosure behavior still need direct-use verification. Simple
  harness checks use Luna; substantive self-authoring continues to use Astra.

Do not write tests. Use the actual application and its real tools throughout
development, including a temporary workspace for edits and restoration. Use
existing Pi authentication on the server without logging credential values.
Completion hooks perform formatting, type checking and builds. Shut down
verification servers after use.

Standing development requirement: use Fathom itself to implement real parts of
Fathom through its visible interface, with OpenAI GPT-6 Astra selected. Review
those edits and exercise the resulting feature in the application. Record the
task, model and observed result here; a demo in a temporary workspace alone does
not satisfy this requirement.

Use ChatGPT/OpenAI GPT-5.6 Luna for simple chat and agent functionality checks.
Reserve Astra for substantive implementation work through the harness.

### Direct-use evidence, September 15

- Each prepared environment now owns a unique generated cache directory for
  frontend and backend bundles. Failed preparation removes its directory;
  rollback retains the previous generation; successful replacement removes it
  only after the new environment activates. Environment disposal releases its
  remaining owned directories. No broad deletion of other generations occurs.
- Native verification induced a plugin activation failure and confirmed the
  original generation remained while the failed generation disappeared. Removing
  the fixture and reloading left exactly one new generation. Initial Quit testing
  exposed native exit racing asynchronous disposal; native Quit and close now
  prevent immediate exit and await the application shutdown promise before closing.
  Rebuilt and separately exercised Cmd+Q and the red window-close button. Both
  removed their current generation and exited the process. The earlier orphan
  remained untouched. Forced termination, hung plugin disposal, and cleanup of
  legacy cache layouts still need dedicated handling.
- Backend discovery now compiles each user plugin into a generation-specific
  module graph using the existing Vite/Oxc dependency. Package imports remain
  external; local TypeScript/JavaScript helpers are bundled. Per-module source
  locations preserve `import.meta.url`, `dirname`, and `filename`. The backend
  and frontend compilers share a bounded error formatter that removes terminal
  control codes and runtime stack frames. The plugin guide records computed
  import limitations and unfinished generated-cache pruning.
- Built and used the native app with a temporary global plugin whose RPC called
  a helper that imported another TypeScript helper and read an adjacent asset
  through `import.meta.url`. Changing only the transitive helper and reloading
  changed its visible command result from version one to version two without
  restarting. A malformed helper failed preparation while the previous RPC
  still returned version two and read an updated asset. Rebuilt with formatted
  errors and verified a compact, escape-free syntax error. Repaired the helper
  to use a literal dynamic import and verified version four through the same
  command. Removed the fixture, reloaded, and confirmed the command disappeared.
  Remote package changes, computed imports, import-map aliases to local helpers,
  and repository-scope helper reload were not exercised in this pass.
- Used Fathom's native interface with OpenAI `gpt-6-astra` to implement
  `app/ui/audio-cues.ts`. Astra read the repository rules, authored only that
  helper, and read it back. Reviewed the result: distinct short completion,
  approval, and failure sequences; bounded volume; gain envelopes; one active
  cue; cleanup on completion/error; and a 1.5-second suspension/playback limit.
  Consulted the Web Audio [context cleanup documentation](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/close)
  and [source completion event](https://developer.mozilla.org/en-US/docs/Web/API/AudioScheduledSourceNode/ended_event).
- Wired attention kinds from runtime and approvals, including interrupted runs
  outside shutdown. Sound playback starts independently of notification delivery.
  Added reusable AudioSettings controls with per-cue enablement, previews, and
  volume. Agent settings now keeps save failures inline, scopes requests to the
  opening project, and disables edits while saving.
- Built the native app and exercised all three preview buttons; each returned
  to its ready state. Enabled sounds, disabled the approval cue, saved, reopened
  Settings, and confirmed persistence. Zero volume disabled previews. Restored
  audio off, all cue types enabled, volume 0.25, and the Luna model. Auditory
  quality and event-triggered sound output were not independently captured;
  this verifies native controls and persistence, not the complete sound path.
- Connected desktop notifications to Deno's app-side Notification API through
  typed, per-window bindings. Native notifications retain bounded handles,
  replace alerts per session, log lifecycle events without message content,
  and close on app shutdown. Clicks focus the window and dispatch a project/
  session target to workspace navigation. Browser use retains its web fallback.
  Consulted the official [notification API](https://docs.deno.com/runtime/desktop/notifications/)
  and [bindings API](https://docs.deno.com/runtime/desktop/bindings/).
- Added explicit notification permission and preview controls to Agent settings;
  saving unrelated preferences no longer requests notification permission.
  Attention events use their originating project's preferences even when a
  different project is selected. Runtime settings also guards failed resource
  reads so its loading-error view can render.
- Native permission query reported granted. Preview invoked the app-side
  notification constructor. A simple `gpt-5.6-luna` run completed while the app
  was minimized; native logs recorded notification requested and shown, and
  restoring the window displayed `BACKGROUND_NOTIFICATION_CHECK` with idle
  status. System captures did not show the transient banner; notification-center
  automation timed out. Banner-click navigation, cross-project notification
  behavior, permission denial, and differentiated audio cues remain unverified
  or unfinished. Desktop capture:
  `/var/folders/xh/_hj4nxh965q23z0sghtrlrf00000gn/T/codex-shot-2026-09-15_02-38-38.png`.
- Settings now uses a bounded panel scroll area inside the shared modal, keeping
  section navigation visible for long plugin lists. Section selection uses
  Tailwind state styles and `aria-current`; switching sections resets the panel
  to its top. Native verification scrolled Plugins to the final row, confirmed
  navigation and its selected state remained visible, then selected Providers
  and confirmed its heading and first connection were visible. Narrow-window
  responsive behavior was not exercised in this pass.
- Extracted plugin settings from provider authentication state. The panel owns
  loading, retry and reload failures, prevents duplicate reloads, and refreshes
  on environment events and reconnection. Provider lists and sign-in flows
  also refresh on these events with requests scoped to the opening project.
- Built the native app and kept Settings open while installing a temporary
  global plugin. Reload displayed the new plugin immediately. Replacing its
  entry with an invalid export produced an inline error and retained the
  active list. Removing the fixture and reloading cleared the error and its
  row without closing Settings. Removed the fixture and shut down the app.
  Transport-disconnection recovery was not exercised in this pass.
- Added queued-message Edit and Remove controls through a reusable queue
  component and the existing message editor dialog. Runtime mutations validate
  message length and reject IDs that have already left the queue.
- Built and opened the native desktop app. With `gpt-5.6-luna`, requested a
  waiting shell command, queued a follow-up, and stopped the run. The waiting
  message remained visible; editing changed its displayed text, and Remove
  cleared the queue without another model call. The consumed-message race and
  persistence across restart were not exercised in this pass.

### Direct-use evidence, September 14

- Opened the web app in a visible Chrome session, opened a temporary project,
  and granted trust through its dialog.
- Selected the existing Pi Codex connection. A real `gpt-5.6-luna` run created
  `hello.txt`, read it back, and returned the correct contents. Tool cards,
  token counts, and provider cost appeared in the UI.
- Restarted the server and recovered the complete conversation and tool history.
- Opened `hello.txt` in Monaco, entered text, and saved it to disk with the UI.
- Opened an xterm shell, entered a command, and observed its real terminal output.
- Installed a temporary project plugin with a backend tool, inspector view,
  and command. Changed its frontend file, received the idle reload notice,
  reloaded, and saw its updated inspector heading without losing the session.
- Opened Fathom's own repository in Fathom and selected OpenAI Codex
  `gpt-6-astra`. That live session implemented terminal refresh and selection
  changes in `app/ui/components/terminal.tsx` using Fathom's file tools.
- Reviewed that implementation and fixed project scoping and a service-reload
  race found during use. Started two terminals, printed distinct markers, and
  switched between them to verify preserved output. Reloaded the environment
  through Settings and successfully entered a command in the new shell.
- Started the generated counter server from the integrated terminal, opened
  port 4190 in Fathom's browser panel, and clicked Increase. The rendered count
  changed from 0 to 1.

### Native desktop evidence, September 14

- Built and launched `app/dist/Fathom.app` with the repository's desktop script.
  Fixed origin handling for the port assigned by Deno Desktop.
- Used the native window to select OpenAI `gpt-6-astra` and submit a component
  implementation task. Astra created and read back `app/ui/components/icon.tsx`
  through Fathom's file tools. Reviewed the exported icon names and size classes
  against `design/primitives/icon.ts` before using that component in the app.
- Rebuilt the desktop bundle with the canonical Tailwind tokens, local Space
  Grotesk and Fragment Mono fonts, and Phosphor icons. Opened the same persisted
  Astra conversation in the native window.
- Clicked the new tool disclosure and its nested call card. The stored file path
  and arguments appeared. The session inspector showed Astra, idle status, and
  the persisted usage totals after restart.
- The header, sidebar, transcript spacing, tool cards, and inspector now use
  approved design markup and tokens. Full component parity remains unfinished;
  the composer, settings, editor, and other panels still require porting.

- Rebuilt with the approved composer overlay and spacing. Clicked Attach context
  in the native app, selected `app/ui/components/icon.tsx` through the macOS file
  picker, and observed its filename and source text in the draft. This verifies
  text attachment selection; image/media attachments remain unfinished.

- Rebuilt the native app with grouped assistant responses. The persisted Astra
  run showed one heading and one batch labeled “8 tool calls · 1 failed”. Clicking
  the batch revealed the stored individual calls. Branching uses the last entry
  in the response; copying includes its text across model steps.

- Connected the entry-renderer registry to the transcript. Built the native app,
  loaded a global plugin under the isolated Fathom home, and saw its
  “Plugin-rendered context” label and the selected user entry in the conversation.
  The extension contract is documented in `docs/guides/plugins.md`.

- Made frontend registration disposal idempotent and serialized frontend load and
  unload. Rebuilt the native app, changed the global renderer's label, clicked
  Reload environment, and observed the replacement label with the conversation
  intact. This verifies the normal reload path; overlapping requests and failure
  recovery still need direct-use evidence.

- Serialized workspace initialization, cleaned up failed opens, and made shutdown
  wait for pending opens. The native build passed its backend type check and the
  rebuilt app recovered the existing Astra conversation and global renderer.
  Concurrent-open and failed-initialization scenarios remain unverified by use.
- Model selection now rejects changes while a run is active. Session updates
  reject missing or non-object changes before accessing their fields.

- Updated login cancellation to settle immediately and reject late completion.
  Finished-flow cleanup timers are tracked and cleared on disposal. In the native
  app, opened OpenAI's API-key prompt and cancelled without entering a key. The
  prompt disappeared, OpenAI remained disconnected, and Codex stayed connected.

- Added explicit editor discard and preserved drafts typed during a save request.
  In the native editor, inserted a temporary unsaved comment into `mise.toml`,
  clicked Reload, confirmed Discard, and observed the original text and cleared
  dirty marker. `git diff -- mise.toml` remained empty. File events now refresh
  already-open clean documents without changing the selected tab.

- Retained editor documents and drafts per workspace across mode changes and
  bound editor RPC to its original project. In the native app, typed a temporary
  unsaved draft, switched Editor → Agent → Editor, and observed the draft and
  dirty marker intact. Discard restored the original contents. This retention
  currently lasts for the renderer process; restart recovery remains unfinished.

- Persisted editor drafts with their original disk version in workspace storage.
  Entered an unsaved marker in the native editor, stopped and relaunched the app,
  opened Editor, and saw the recovered marker and dirty tab. Discard restored
  the original file. Deleted-file recovery and conflict recovery still need
  direct-use verification and UI completion.

- Added a recovery dialog for drafts whose original files cannot be opened.
  Created a temporary note, edited it without saving in the native app, moved
  its source to `/tmp/fathom-recovery-note-original.txt`, and restarted. The
  recovery dialog displayed the original text and unsaved addition. The isolated
  development profile retains this sample draft for further recovery work.

- Ported the approved workspace status bar and context meter to a shared Solid
  component. In the native app, opened the context breakdown and observed the
  latest reported input/cache, output, and available capacity. The UI explicitly
  identifies this as the last reported call, excluding pending messages.

- Added a searchable archived-session dialog with restoration from conversation
  options and the command palette. In the native app, archived the Astra
  development session, found it in the dialog, restored it, and observed its
  messages, tool history, and usage intact.

- Added a reusable action menu using the approved context-menu styles and icons.
  Native inspection caught and resolved trigger-width and button-alignment
  conflicts. Arrow Down focused the first action; Escape closed the menu and
  visibly restored focus to its trigger.

- Reused the shared action menu for providers and replaced browser confirmation
  with an app disconnect dialog. In the native app, opened Codex's disconnect
  dialog and chose Keep connection; the connection remained intact. Login inputs
  are now isolated by prompt ID, and settings failures display inside the dialog.

- Hardened transport connection setup with shared in-flight initialization,
  bootstrap retries, bounded setup, stale-socket guards, and pending-request
  cleanup. Heartbeat timeouts close the socket to trigger reconnect. The native
  build and normal startup succeeded; dropped-network and stalled-bootstrap
  scenarios still require direct-use verification.

- Completion hooks now record command exit codes and timestamps in the ignored
  `.codex/verification/app.json` file, including failures. Added the native build
  scripts directory to formatting coverage. A configured hook or successful
  native build alone is not evidence that frontend type checking ran; inspect
  this result after the lifecycle hook executes.

- Added a conversation-branch picker and opened it in the native app; it showed
  the persisted final answer as the current branch. Switching now rejects pending
  or incomplete tool boundaries. Branch creation rejects a changed active leaf
  after summary generation. Native direct use verified a no-summary rewind to
  the user message, followed by switching back to the saved Astra answer. The
  original answer and tool history returned. The custom-summary focus input was
  also exercised; snapshot restoration and generated summaries remain unverified.
- No `.codex/verification/app.json` was present after the preceding turn; the
  completion hook's execution remains unverified.

### Delivery notes

- Workspace/plugin startup failures now leave the native shell available and
  open project selection for recovery. Successful opening clears the prior
  workspace error. Plugin import generations are process-wide, so a fresh
  Environment retry does not reuse the failed manifest module URL. Native
  verification launched with a broken global manifest: the desktop stayed open,
  retry showed its inline error, and repairing that same file allowed the project
  to open without restarting. Removed the verification manifest afterward.
  Dependency-module cache invalidation and registry/trust-file startup failures
  remain separate unfinished recovery cases.

- Added custom-gateway.js as a portable provider-plugin example, with Pi's
  Completions adapter, backend API-key auth, required endpoint/model configuration,
  duplicate-provider rejection and effect-owned cleanup. Documented both install
  scopes, metadata limits/prices, credentials and native launch configuration.
  The launch script now accepts explicit --env NAME=value arguments. Native
  verification loaded Example gateway through the documented command, then
  removed the manifest and reloaded: the provider disappeared. No gateway
  request or credentials were used, so protocol compatibility is not verified.
  The first launch failed on an incorrect adapter import; corrected it to Pi's
  public API subpath. Desktop control briefly launched a default-home fallback
  workspace at /; stopped it without granting trust. Removed the isolated
  verification installation; the source example remains in app/examples.

- Moved LoginFlow/LoginPrompt into the public SDK and shared it with LoginManager
  and provider UI. Prompt variants derive from Pi's installed AuthPrompt type;
  the transport shape omits abort signals. ProviderAuthEvent handles Pi's typed
  progress, authorization URL, device code and informational-link events with
  HTTP(S)-only links. Native OpenAI Codex OAuth verification advanced from the
  method selector to browser login, displayed the link/instructions, and reset
  the answer for the new manual-code prompt. Cancelled the flow and observed
  the existing OAuth connection remained. Did not complete login or change
  credentials. Device-code and informational-link rendering remain unverified.

- Used native Fathom with OpenAI GPT-6 Astra to author and read back
  provider-login.tsx. Reviewed the component and integrated it into Settings.
  Each prompt owns its answer, resets on prompt identity changes, blocks duplicate
  submissions and ignores stale results. Stable flow IDs preserve component state
  across refreshes. Accepted actions are distinguished from later status-refresh
  failures; provider, flow and plugin resource failures no longer read throwing
  resource values in lists. Consulted Pi's installed AuthPrompt/AuthEvent types.
  Rebuilt native Fathom and exercised the OpenAI API-key prompt, empty-answer
  disabled state and cancellation. An oversized dummy-input attempt timed out in
  the desktop tool; cleared it without submission, so rejection/answer-retention
  is not verified. No credentials were changed. Restored Luna for simple checks.
  OAuth completion, successive prompts, info-event links and full provider settings
  design fidelity remain unfinished.

- BranchPicker captures its opening project/session, guards duplicate switches
  and pending dismissal, and avoids reading a failed resource while rendering
  its error state. Added Retry loading. Native verification temporarily disabled
  fathom:branches in the isolated home, reloaded, and observed the inline error;
  retrying retained a usable dialog. Removed the temporary configuration and
  reloaded: reopening showed the normal empty branch list. Recovery through a
  successful retry without reopening and delayed branch switches remain unverified.

- Archived sessions now reuse SearchList for filtering, keyboard selection,
  busy handling and inline errors. Restoration captures its project and prevents
  closing while pending. Archiving selects an existing unarchived conversation
  before creating an empty replacement, with project/session guards after the
  request. Native verification archived the empty session, selected the existing
  development conversation, searched an unmatched title, then restored/opened
  the archived session with Enter. The original three sessions remained; no
  replacement was created. Failure and cross-project request races still need
  direct verification.

- Extracted RenameSession with local input, busy and inline error state. The
  header captures the project and session when opening the dialog, so Save does
  not resolve its target from later navigation. Duplicate submission and closing
  during a save are guarded. Native verification rejected an empty name, renamed
  the empty session with matching header/sidebar updates, and restored its name.
  Delayed requests, navigation during a request and failure recovery remain
  unverified in the native UI.

- Extracted transcript scrolling into a visibility-aware state helper. Hidden
  layout events no longer mark the conversation detached; returning to Agent
  restores the last visible scroll position or follows the latest response.
  Both viewport and content resizing trigger restoration, and session changes
  reset following. Native verification reproduced Editor-to-Agent navigation
  at the latest response and while reading older content: both positions stayed
  stable. Jump to latest returned to the final response and disappeared. Live
  streaming during view changes and width changes still need direct verification.

- Editor and inspector now share event-driven language-server state and the
  SDK LanguageServerStatus contract. Removed editor polling; project changes
  clear old state, stale responses are discarded, and disconnects show unavailable.
  Native verification opened a temporary TypeScript mismatch: both editor and
  inspector showed one error. Corrected and saved it in the native editor;
  the inspector returned to zero errors. Closed and removed the temporary file
  and stopped the app. Transport disconnection and delayed cross-project responses
  still need direct verification.

- Added the approved language-server row to the shared inspector section.
  It reads project-scoped server status and aggregates reported diagnostics;
  diagnostics, reload, reconnect and server lifecycle events refresh the view.
  Rebuilt native Fathom: Deno displayed Connected with zero reported problems.
  Stopped only that verification app's owned Deno language-server process;
  the row changed to Unavailable and hid diagnostic counts without a reload.
  Counts cover documents reported by the server, not a full-repository scan.
  Nonzero counts in this new inspector section still need direct verification.

- Extracted InspectorSection and MetricList from the approved inspector and
  metric-list layouts. SessionUsage now renders separate Usage and Tokens
  sections from recorded provider usage, including input, output, cache reads
  and cache writes. Model time sums recorded request durations; output rate is
  output tokens divided by that duration, including request latency. Cache hit
  is cache-read tokens divided by input plus cache-read/write tokens. This is
  labeled Model time rather than implying full agent wall-clock runtime.
  Native verification showed recorded totals, zero-count empty-session behavior,
  and reachable workspace/tool controls after scrolling. Chat mode still hides
  the inspector by design. Language-server inspector content and full run-time
  telemetry remain unfinished. No model calls or tests were needed for this pass.

- Project loading now prepares explicitly scoped session, model, usage and
  approval data before changing the visible workspace. Shared project-data
  loading also serves refresh; selection versions discard stale session and
  refresh responses. Rebuilt native Fathom and switched to the restricted
  initial-repository workspace, then back: each restored its session, model,
  usage and trust state together. Rapidly selecting the empty session and back
  retained the final selection. No generation was needed. Mid-load request
  failures and reconnect races still need direct verification; frontend plugin
  load failures report an error after the core project selection succeeds.

- Extracted ProjectDialog with local path, busy, and error state; removed its
  dialog-only state from the workspace and its legacy list CSS. Saved projects
  use SearchList behavior with the approved project-picker row layout. A shared
  busy state prevents overlapping list/path submissions. Native verification
  rejected a regular-file path inline while retaining input focus, then opened
  the verification repository after correcting the path. Searching saved projects
  by path and pressing Enter returned to Fathom and its previous session. The
  sidebar dropdown/all-projects experience and partial project-load failure
  recovery remain separate unfinished work.

- Extracted SearchList for model selection and the command palette. It owns
  filtering, arrow/Enter navigation, active-row scrolling, busy handling, and
  local errors. Replaced the model picker's separate row CSS with shared token
  classes, added a Current label, and reset search on each opening. Model changes
  now await the backend so failure stays in the dialog. Native verification moved
  beyond the visible model rows with the keyboard, rejected a cross-provider
  switch inline, then selected Luna with Up/Enter without losing focus. Reopening
  cleared the search. The shared palette also opened the project dialog with
  Enter. Screen-reader behavior and long-running command failures remain unverified.

- Split environment preparation from activation and extracted pure plugin
  dependency ordering for preflight validation. Reload imports and compiles
  before disposing the working environment; activation failure attempts to
  remount its previous prepared plugin set and assets. Native verification used
  an intentionally invalid temporary manifest: the parser error appeared while
  the old command still returned workspace metadata. A deliberate activation
  throw then produced the restored-environment notice, with the command and RPC
  usable afterward. Restoring the source allowed a successful subsequent reload.
  Plugin cleanup failures, external side effects, and subprocess/session resource
  restoration still need broader verification; recovery is not transactional
  rollback of arbitrary plugin activity.

- Extracted plugin watching from Environment and extended it to configuration
  files and configured plugin directories, including directories created after
  startup. Watch paths are canonicalized to handle macOS /tmp aliases. Native
  verification changed the isolated home configuration, observed the reload
  notice, created the configured extensions directory, reloaded, and found the
  example command. A disable-list edit triggered another reload and removed the
  command. Disabled plugin frontend assets are now excluded alongside the backend.
  Consulted the [Deno file-watching API](https://docs.deno.com/api/deno/file-system/#watchFs).
  Backend helper cache invalidation and preserving the old environment after a
  failed reload remain incomplete. Cross-platform watcher behavior and active-run
  notification deferral still need direct-use verification.

- Added the portable workspace-information plugin example. Astra authored its
  backend manifest through native Fathom; reviewed the file and supplied the
  frontend command with RPC error handling and unload guards. The guide now
  includes machine/repository installation and an agent workflow for the example.
  Native verification loaded it from the isolated Fathom home, ran its command,
  and used Luna to call workspace_info successfully (fathom, trusted, 3 sessions).
  Removing the manifest and reloading removed the palette command. Installing
  the same pair under the trusted repository restored one command and the same
  RPC result. Temporary installed copies were removed after verification.
  Completion-hook formatting now includes app/examples. Restricted-workspace
  rejection, duplicate IDs, and in-flight unload errors need separate evidence.

- Native Continue verification switched the interrupted session to GPT-5.6 Luna,
  resumed generation, then stopped it successfully. Recorded the user's model
  policy in AGENTS.md: Luna for simple checks, Astra for real implementation.
  This exposed incorrect attribution when adjacent assistant entries used
  different models. Transcript grouping now separates model/provider changes
  and interrupted, failed, or output-limited responses. Rebuilt native Fathom
  and verified separate Astra and Luna headers on the saved responses.
  Provider-aborted results now cancel the run before tool execution and settle
  as interrupted; that provider-only path still needs direct-use verification.
  Recovery messages no longer incorrectly attribute every interruption to
  system shutdown.

- Added ResponseStatus beside assistant content for interrupted, failed, and
  output-limited responses. Existing Retry response and Continue controls provide
  recovery. Runtime now assigns the same terminal entry status whether or not
  streaming produced a checkpoint, including provider-aborted responses. Native
  Astra verification stopped a number-list response: partial text remained,
  interruption appeared inline, session state became interrupted, and Continue
  appeared. Switching away and back retained the status and partial response.
  Provider-error and output-limit notices still need direct-use verification;
  provider aborts without a local cancellation need run-state review.

- Extracted MessageBody from transcript layout. It renders text and thinking in
  content-array order, uses stable indexed blocks during streaming, and keeps
  explicit thinking disclosure choices. Provider-redacted thinking is omitted
  from presentation while the stored message remains intact. Consulted the
  installed Pi content type definitions. Native use expanded a saved Astra
  thinking block and verified it stayed expanded when switching to Chat.
  Mixed-block streaming and redaction paths still need direct-use verification.
  MessagePreview now expands when keyboard focus enters its content; interactive
  plugin content still needs a dedicated keyboard verification pass. Image
  attachments remain unfinished.

- Added reusable MessagePreview around transcript content. Long user prompts use
  the approved five-line fade and Expand message / Show less controls; measured
  content height determines whether the control is needed. The observer is
  disposed with the component and responds to layout/content changes. Native
  verification expanded the original Astra implementation prompt, collapsed it
  with Return, checked the same preview in Chat mode, then jumped to the latest
  short prompt and confirmed it remained fully visible without an expand control.
  Embedded interactive plugin content inside collapsed prompts remains an
  accessibility case to review.

- Tool activity now follows its originating assistant entry instead of being
  collected before all response text. Extracted ToolGroup with shared disclosure
  styling, user-owned expansion, running/failure feedback, and singular/plural
  labels. Native Astra ran `printf ORDER_TOOL_OUTPUT`: both Agent and Chat showed
  BEFORE_TOOL, the tool group, and AFTER_TOOL in order. Expanded the group and
  tool card and verified the successful output. This preserves entry order;
  richer tool summaries and ordering within individual mixed-content entries
  still need review against the complete designs.

- Extracted MessageActions for both Agent and Chat transcripts using the approved
  below-message layout and action ordering. Busy handling and action errors now
  belong to the message; clipboard failures no longer escape as rejected promises.
  Rebuilt and used native Fathom: Copy changed to Copied, and pasting into the
  composer reproduced `EDIT_RESEND_VERIFIED` exactly. Cleared the unsent draft
  and checked the same action ordering in Chat mode. Error paths and running-state
  disabling still need direct-use verification.

- Added Edit and resend with a reusable prompt dialog and backend validation.
  It branches before the selected user message and submits through normal
  run admission. Failed admission restores the original leaf if no new entry
  was appended. Runtime state reports admission as busy, and reconciliation
  skips admitted sessions. Native Astra verification edited the last prompt
  to request `EDIT_RESEND_VERIFIED`; the answer matched, and the branch picker
  retained both earlier responses alongside the edited conversation. Media
  messages are explicitly rejected for now. The subsequent MessageActions
  desktop pass verified Copy before Edit and resend in both conversation modes.

- Added the approved Retry response action beneath assistant messages. The
  branch plugin validates an idle conversation and restarts the runtime from
  the preceding user prompt, retaining the original response branch. Native
  Astra verification retried the prior eight-second shell task successfully;
  the branch picker displayed both answers and marked the new answer current.
  Edit/resend and message links remain missing. Retry preserves current
  workspace files; it does not restore snapshots.

- Transcript scrolling now cancels stale animation frames, resets follow mode
  on session changes and observes delayed content resizing while attached to
  the bottom. Cleanup releases both the observer and scheduled frame. Native
  verification scrolled to old messages, switched to an empty session and
  returned to the latest response. It also exposed the old jump button behind
  the composer; the control now occupies the first conversation grid row,
  above the composer. Rebuilt again and physically verified the visible
  button returns to the latest response. Streaming while detached still needs
  a longer direct-use exercise. The preceding app hook passed at 04:48 UTC.

- Conversation headers now use a shared component matching the approved
  author, working-animation, model and timestamp layout. The existing design
  CSS supplies the page animation and reduced-motion handling. Copy and
  branch actions moved below message content to match the reference placement.
  Rebuilt the native app and ran Astra with an eight-second shell operation:
  Agent and Chat both showed the working indicator and model without a
  timestamp; completion removed the indicator and restored the timestamp.
  A follow-up guard makes branching use the same pending/running calculation;
  that final guard still needs direct-use verification. Retry/edit-resend and
  message-link actions remain missing, so this is not full transcript parity.

- The newly trusted app completion hook recorded a successful run at
  2026-09-15 04:43 UTC: formatting, `deno task check` (backend and frontend)
  and the web build all exited successfully. This is the first recorded
  complete automated app verification in this development sequence.
- Editor Changes and Git Studio now share `ChangedFileList`, using the
  approved file-row/status badge spacing and tokens. `FileRow` accepts a
  trailing contribution instead of owning Git-specific state. Git status
  response types live in the SDK. Native verification showed the same 252
  files and aligned modified badges in both surfaces, with path truncation
  in the sidebar. Aggregate diff totals and the broader Git layout remain open.

- Investigated the missing completion-hook evidence using official Codex
  documentation and local configuration. The project is trusted, but only
  the Markdown handler has a recorded trusted hash; the design and app
  handlers initially had none. The user approved them, and local configuration
  now records trusted hashes for all three handlers. Automatic frontend
  checking remains unverified until `.codex/verification/app.json` records a
  current successful run. The plugin guide now explains this setup, extension
  boundaries, resource ownership and moving plugins between scopes.

- Git commands now use a bounded process runner with a 30-second deadline,
  64 MB combined output limit, plugin-lifetime cancellation and Unix process
  group termination. The shell tool shares the group-signalling helper.
  Consulted Node's child-process and process documentation. Native verification
  used a temporary signer that ignored SIGTERM and launched `sleep 120`:
  Git Studio showed a timeout, restored its controls and retained the plan.
  Process inspection confirmed Git, signer and sleep all exited. Restored
  the isolated repository's signing settings and retried through the UI;
  the commit succeeded and the working tree was clean. Windows descendant
  termination and output-limit behavior still need direct verification.

- Extracted controlled `CommitPlanEditor` from Git Studio. It owns message
  editing, ordering and file allocation without transport or workspace
  dependencies. Index-based rows retain input elements while draft values
  change, following Solid's documented Index semantics. Edits are disabled
  during requests; commit drag data has its own type, and same-destination
  file moves are ignored. Rebuilt and used the native app with Astra's plan:
  replaced the title, appended more text without refocusing, split the plan,
  and merged it again. The full edited title and file allocation survived.
  No dedicated commit-card reference exists in the current design directory;
  broader Git Studio visual fidelity and hunk allocation remain unfinished.

- Commit planning now includes bounded content from untracked files through
  a separate Git context reader: up to 16 KB per file and 60 KB total, with
  explicit binary, non-file and truncation notes. Previously the model saw
  only their names. Rebuilt and used the native app with OpenAI Codex Astra.
  An untracked `operations.md` contained offline recovery requirements;
  the generated plan was `docs: document offline request recovery` and its
  body accurately described persistence, ordered replay and duplicate
  suppression. Those details appeared only in file content. The temporary
  file remains uncommitted; this exercise verified planning, not execution.

- Git Studio owns operation errors inside its modal instead of sending them
  to the obscured workspace banner. Shared refresh and execution functions
  replace duplicated commit handlers and refresh status, branches and
  worktrees together. The branch selector includes the current branch even
  before the first commit. Rebuilt and used the native app: creating
  `bad branch` showed Git's error inside the dialog; retrying with
  `codex/native-branch-refresh` cleared the error and immediately selected
  the new branch. Git confirmed that branch and a clean temporary workspace.

- Commit groups and plans now have shared SDK contracts, used by Git Studio
  and a single backend validator for generated plans and edited execution
  requests. Validation rejects empty plans, malformed fields, multiline titles,
  duplicate or unknown files, and omitted files in generated plans.
  Rebuilt the native app, selected OpenAI Codex GPT-6 Astra in the isolated
  initial repository, generated `docs: add README`, and executed it through
  Git Studio. Git confirmed first commit `a515b0f` and a clean working tree.
  The first attempt inherited global 1Password signing and stalled; signing
  was disabled only in the disposable repository before retrying. This also
  exposed follow-up work: errors appear behind the modal, signing subprocess
  cleanup needs strengthening, and the branch selector stays empty after the
  first commit until its resource refreshes.

- Git commit planning and execution share a baseline helper: existing HEAD or
  Git's empty tree before the first commit. Git computes that tree using the
  repository's object format. Staging and index synchronization use literal
  paths, and an absent model-generated plan produces a retryable error.
  Built the native desktop app and opened `/tmp/fathom-initial-repo`, an
  isolated repository with no commits, in Restricted Mode. Changes listed
  README.md and its preview displayed the exact added text with +1/−0.
  Subsequent native planning and execution verification is recorded above.

- Git diff now compares untracked files against an empty file, and supports
  workspaces without an initial commit. Paths are normalized and tracked diffs
  use literal pathspecs; regular-file previews are bounded to 4 MB. Native use
  verified untracked `app/kernel/runtime.ts` shows all four lines as additions.
  Initial-repository and binary cases still need direct verification. Quit app.

- Editor and Git Studio now reuse DiffPreview with approved line colors, spacing
  and per-patch addition/removal counts. Native `.gitignore` preview showed +5/−0
  with highlighted additions; Git numstat confirmed the counts. Quit afterward.
  Full diff-pane layout, binary/untracked previews and aggregate totals remain open.

- Connected editor Files/Changes using shared TabStrip and FileRow components.
  ChangedFiles loads Git state with retry/empty handling; selecting a change
  opens its text diff. Native use verified the 110-file list and `.gitignore`
  diff, then quit. Approved full diff-pane rendering, status badges and aggregate
  line counts remain unfinished.

- Extracted CommandPalette with independent query state, keyboard selection,
  Enter activation and an empty-results message. Built-in and plugin commands
  share the component. Native use verified filtering for terminal left the
  session sidebar unchanged, and Enter opened the terminal. Quit afterward.

- Terminal now reads shared design colors and Fragment Mono through a reusable
  canvas-widget token adapter. Native light-theme switching exposed an effect
  ordering issue; deferred token reads to the next animation frame, rebuilt, and
  verified the terminal background changed with the application. Restored dark
  mode and quit. Build also includes stopped-terminal input/Stop guards.

- Verified integrated PTY in native Fathom: opened via Commands, typed a printf
  command, observed `FATHOM_NATIVE_PTY_OK`, then clicked Stop and observed the
  stopped shell label. Quit the app. Follow-up code disables Stop and ignores
  input for stopped terminals, and reuses IconButton for hiding the panel; those
  final changes still need a native rebuild. Terminal design parity remains open.

- Extracted reusable ToolCard presentation. Explicit disclosure choices override
  automatic running-state expansion; terminal empty results distinguish success,
  failure and cancellation. Native use verified opening the extracted card and
  reading its arguments and timeout output. Empty-result and live-completion
  transitions remain unverified.

- Transcript groups, entries and tool cards now render by stable IDs rather than
  freshly allocated arrays/objects, retaining component state during refresh.
  Native use verified an expanded tool group stayed open after changing thinking
  effort and refreshing session state. Restored the original effort and quit.
  Continuous streaming and branch-removal behavior still need direct verification.

- Moved draft loading, write ordering and per-session errors into a shared
  transport-scoped state store. Composer presentation no longer owns database
  request queues. Completed writes are released. Rebuilt native Fathom and
  verified a draft stays with its session across a switch and return; cleared
  the draft and quit. This build includes the earlier queue-lifetime adjustment.

- Session drafts now persist in project SQLite settings through validated draft
  RPCs. Native use verified typing a draft, quitting, reopening, and seeing the
  same text. Cleared the verification draft and quit. Persistence failures are
  shown in the composer. A follow-up queue-lifetime adjustment retains ordering
  across session switches; that final adjustment still needs a fresh build.

- Composer drafts are keyed by session. Async text attachments target their
  original session, and send completion only clears an unchanged submitted draft.
  Native use verified typing a draft, switching to an empty session, then returning
  to the retained original draft. Cleared the verification draft and quit.
  Draft persistence across application restarts remains unfinished.

- Process execution now catches cancellation during startup, avoids duplicate
  termination timers, kills children on stream failures, and closes logs even
  after a failed write. Native Astra ran a 20-second sleep with a 500ms timeout;
  the tool returned `exit=137 (timeout)` and the initial output, and the session
  returned to idle. Stream/log failure paths still need direct verification.
  Documented native runtime selection and isolated plugin development homes.

- Added one shared Deno executable resolver for the language server and script
  tool. In rebuilt native Fathom, OpenAI GPT-6 Astra invoked the Deno script tool
  and returned `NATIVE_SCRIPT_OK 2.9.6`; the tool completed successfully in 3.5s.
  Quit the verification app afterward. Runtime distribution and interpreter
  discovery beyond this development-launcher path remain unfinished.

- Monaco now retains a model and view state per open file, preserving undo history
  and cursor position across tab switches. Closing a tab releases its model;
  editor teardown releases all retained models. Native use verified editing a
  file, switching to another tab, returning to the cursor position, and undoing
  part of the prior typing. Discarded remaining verification edits and quit.
  Undo across entire workspace-mode remounts remains unsupported.

- Corrected Monaco diagnostic severity mapping for information and hints.
  Language-server disposal is idempotent and bounded; exit clears stale
  diagnostics and disposes the RPC connection. Rebuilt and opened native Fathom,
  then quit through Cmd+Q and confirmed the app process exited. Forced timeout
  behavior remains unverified.

- Native development launcher now passes the resolved Deno executable through
  FATHOM_DENO; language-server startup no longer relies on GUI PATH lookup.
  EditorStatus distinguishes an unavailable server from no reported diagnostics.
  Native verification opened a temporary TypeScript type mismatch and received
  red error markers plus one error and one warning in the status bar. Removed
  the verification file and stopped the app. Standalone packaged runtime
  distribution remains separate unfinished work.

- Extracted EditorStatus using the approved status-bar layout. Monaco reports
  live line, column and language through a disposed cursor listener; reported
  diagnostics supply error/warning counts. Native use verified opening Markdown
  and moving the cursor from line 1, column 1 to line 8, column 26. Diagnostic
  reporting and language-server availability still need native verification.

- Editor mode now owns the file sidebar instead of showing the session sidebar
  beside it. Uses the approved files-sidebar width and right-side conversation
  overlay width. Workspace banners moved outside the conversation so editor
  errors stay visible. Native use verified the file sidebar, hide/show toggle,
  and agent overlay. Files/Changes navigation, resizing and editor status remain
  incomplete design-system work.

- Replaced the flat folder browser with a lazy expandable FileTree. FileRow and
  FolderRow reuse the approved row layouts, icons and selection tokens; loading
  and expansion are separate from row presentation. Native use verified expanding
  `app` and opening `app/deno.json`, with selected-row styling and path breadcrumbs.
  Files/Changes sidebar switching and full editor-screen layout parity remain open.

- Extracted per-file editor write scheduling. Each file retains its own debounce,
  save/discard wait for earlier writes to that file, and leaving the editor flushes
  pending writes. This fixes one file cancelling another file's pending draft.
  Rebuilt native Fathom and exercised dirty-tab close and discard; the final tab
  cleared, the shared close icons rendered, and the source file had no disk diff.
  Rapid multi-file persistence and interrupted-save cases still need direct use.

- Componentization and reuse are part of every fidelity pass: review shared
  controls, state ownership, and plugin boundaries while porting approved views.
  Extracted editor tabs and breadcrumbs using the approved layouts. Reused the
  existing IconButton for tab and modal close actions instead of duplicating its
  styles. Native use verified opening a file and closing the final tab clears the
  editor. Dirty-tab discard handling is implemented but not yet exercised; the
  final IconButton substitution still needs a fresh native build.

- Missing-file drafts can now be saved to a new workspace file through a shared
  recovery dialog. Exclusive creation prevents overwriting an existing file;
  the retained draft is removed only after saving and opening succeeds. In the
  rebuilt native app, saved the retained missing-file draft, saw both original
  and unsaved text in the editor, and confirmed the recovered-draft badge cleared.
  Read back the saved file, then moved the verification artifact to `/tmp` and
  stopped the native verification process. Failure-path UI remains unverified.

The goal remains active. These checks establish the first working path, not
completion of the feature list. Continue implementing and reviewing the remaining
requirements, including the newly connected Git, artifacts, context, skills,
browser and annotation workflows. Native packaging, CLI, media, reporting,
storage settings, complete SDK documentation, hunk-level commit allocation,
and final quality review still need completion evidence.

Agent preferences, thinking selection, notification behavior and MCP connection
settings are implemented but still need direct-use verification. Completion
hooks now include frontend type checking. Continue from the remaining delivery
checklist; the application is not yet ready to call production-complete.

The browser plugin uses an owned Chromium rendering process and displays its
interactive output in the workspace. This avoids iframe restrictions. Deno's
current native window API has no child-webview embedding primitive. Browser
setup and packaged runtime availability need final validation.
