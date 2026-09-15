# Agent chat design inventory

A catalog for ideating on everything visible in and immediately around the
conversation: messages, work in progress, results, decisions, and the composer.
Each row is a design surface to think through. Some can share a component;
others may only need a small variation of an existing piece.

This is a working idea list. Inclusion does not make an item an accepted product
requirement or authorize implementation.

## Existing starting points

The current visual reference has these pieces. Their presence does not mean all
of their states are designed.

| Piece | Current coverage |
| --- | --- |
| `conversation-pane`, `conversation-header` | Conversation frame, title, main and drawer presentations |
| `message-transcript`, `chat-message`, `message-header` | Message sequence, author, timestamp, plain paragraphs |
| `tool-activity` | Completed activity label, duration, file names or research detail |
| `run-status` | Short status label and tone |
| `change-summary` | Changed-file summary and review entry point |
| `message-composer` | Prompt placeholder, attach context, model/reasoning selector, Stop |

The [frontend requirements](../docs/requirements/frontend-and-ux.md) already
describe streaming, thinking disclosure, grouped tools, density controls, media,
steering, queued follow-ups, retries, rewind, and artifact cards. The
[execution requirements](../docs/requirements/tools-and-execution.md) add tool
lifecycle, permission gates, interrupted execution, and full-log access.
The catalog below mixes those needs with additional candidates for discussion.

## 1. Message structure and identity

Initial static studies are available in the design viewer under **Components → Messages**, with one page per surface below. These are
starting points for discussion; the controls do not perform application actions.

Current direction: a working agent shimmers in the message identity. Long user
messages have a faded five-line preview and an expand control. Agent messages
flow directly around collapsed tool rows with counts derived from file operations.
Chat content uses no status dots or separate completion badge.

The working shimmer varies transparency. Streaming previews use uneven text
chunks, including partial words. Change cards show three file paths before
expansion, derive totals from all file rows, and include review/undo controls.
Tool execution has its own catalog page: live tool and thinking states settle
into a batch summary, with nested call/result blocks and resizable output.
Agent commentary stays between execution batches.

| Surface | Things to design |
| --- | --- |
| User message | Short prompt, long prompt, multiple paragraphs, attachments with or without text |
| Agent message | Brief update, partial response, final answer, answer containing several kinds of content |
| Message identity | User/agent name, avatar or icon, model/persona identity, timestamp, edited marker |
| Turn grouping | One user request followed by thinking, updates, tools, and a final answer; clear start and end |
| Message actions | Copy, select text, edit and resend, retry/regenerate, branch or rewind, link to message; feedback as a candidate |
| Message revisions | Original versus edited prompt, alternate answer navigation, active branch, superseded content |
| Referenced message | Quoted excerpt, reply target, jump to source, unavailable source |
| Delivery state | Sending, queued, accepted, failed to send, retrying, duplicate submission prevention |
| Message boundaries | Consecutive messages from the same author, time gaps, unread divider, restored history |

## 2. Text and rich content

| Surface | Things to design |
| --- | --- |
| Markdown body | Headings, paragraphs, emphasis, links, lists, nested lists, task lists, quotes, separators |
| Streaming body | Incomplete words, unfinished markdown/code fences, changing table widths, stopped partial output |
| Code block | Language label, highlighting, copy, long lines, collapse, open/save action where supported |
| Inline references | File paths, line numbers, symbols, commits, issues, other conversations; hover and open behavior |
| Tables | Wide tables, long cells, alignment, horizontal scrolling, copy/export candidate |
| Math | Inline expressions, display equations, long formulas, rendering failure |
| Citations and sources | Inline markers, source list, title/domain, excerpt, repeated citations, missing source |
| Link preview | Title, description, thumbnail, loading, unavailable destination |
| Callout | Note, warning, limitation, success, refusal or unsupported request with useful next step |
| Structured data | JSON/tree view, key/value rows, raw versus formatted output, empty and malformed data |
| Unknown content | Unsupported block type, readable fallback, inspect/download action |

## 3. Thinking and live progress

| Surface | Things to design |
| --- | --- |
| Waiting for response | Request accepted, connecting, waiting for first output, elapsed time |
| Thinking block | Active indicator, label, duration, disclosure, completed summary, interrupted state |
| Reasoning availability | Provider-supplied displayable reasoning or summary; unavailable or redacted content; no invented reasoning |
| Agent progress update | Short commentary between actions, repeated updates, relation to current tool group |
| Plan/checklist | Proposed steps, current step, completed/skipped/blocked steps, revised plan |
| Run activity summary | Tool count, elapsed time, changed files, expand full run, detailed versus summarized view |
| Background work | Agent waiting on a process, progress without output, completion arriving after another message |
| Run ending | Completed, stopped, failed, blocked, awaiting user, continue/resume action |
| Run metrics | Optional time, model, tokens, cost; unknown estimates and link to full inspector |

Thinking presentation needs a provider-aware decision: the existing requirement
describes automatic expansion and collapse, but available displayable content
will vary. Decide how much movement and automatic collapsing feels comfortable.

## 4. Tools and execution

Use one execution card that develops from invocation through result. Decide what
stays visible when collapsed and what appears only when expanded.

| Surface | Things to design |
| --- | --- |
| Shared tool card | Tool name, human-readable action, source/plugin, target, arguments, status, duration, result |
| Tool lifecycle | Pending, running, completed, error, aborted; waiting for approval/input, timeout, retry |
| Tool group | Parallel calls, sequential steps, child counts, mixed success/failure, individual expansion |
| File read/search | Path and line range, query, match snippets, multiple files, no results |
| File write/edit | Added/modified/deleted/renamed files, line deltas, diff preview, open in editor |
| Command execution | Command, working directory, streaming stdout/stderr, exit code, copy, expandable details |
| Persistent terminal | Live process, waiting for input, open terminal, stop process, background completion |
| Large output | Bounded preview, resize handle, head/tail split, truncation count, Open Full Log |
| Web search/read | Query or URL, result list, source previews, research status, failed fetch |
| Browser/computer action | Action description, screenshot thumbnail, target/page, before/after result, open surface |
| Test/build/lint result | Running counts, pass/fail/skip, failure details, file links, full output |
| External app action | App identity, operation, affected record, result link, partial result, connection required |
| Tool discovery | Searching tools, selected capability, loaded skill/plugin, unavailable capability |
| Scripted orchestration | Parent script, nested calls, intermediate output, final result, partial failure |
| Tool error | Plain-language failure, expandable technical detail, retry/inspect options, retained partial output |

## 5. Questions, approvals, and other user decisions

| Surface | Things to design |
| --- | --- |
| Clarifying question | Free text, single choice, multiple choice, recommended option, custom answer |
| Multi-question form | Question count, progress, optional fields, validation, submit all answers |
| Pending question | Agent still working versus blocked, answered receipt, skipped/expired question |
| Tool approval | Exact action and target, reason approval is needed, command/change preview, approve/reject |
| Approval scope | Once versus broader permission if supported; clear selected scope |
| Approval result | Approved, denied, canceled, expired, action changed and needs a fresh decision |
| Plan review | Plan card, open full plan, request changes, approve and proceed, superseded version |
| Access/setup request | Connect app, authenticate, choose file/folder, missing dependency; return to waiting work |
| Action receipt | What the user chose, when it took effect, submitting/error state, historical disabled controls |

## 6. Subagents and delegated work

| Surface | Things to design |
| --- | --- |
| Delegation card | Agent name/role, assignment, parent relationship, model if useful |
| Agent progress | Queued, starting, running, waiting, blocked, completed, failed, stopped |
| Agent group | Several workers, aggregate progress, active count, mixed outcomes |
| Child transcript entry | Compact update or result, open child conversation, return to parent |
| Handoff | Who owns the next action, handoff underway/completed/failed, destination link |
| Delegated result | Summary, findings, files/artifacts, source agent, unresolved question |

## 7. Attachments, media, and artifacts

| Surface | Things to design |
| --- | --- |
| File attachment | Whole files only; name, type, size, upload/processing progress, remove, retry, unavailable file. Specific line selections are out of scope for now. |
| Image/gallery | Thumbnail, caption, multiple images, zoom, download, generation/loading failure |
| Screenshot annotation | Cropped region, numbered pins, attached feedback, source page/file |
| Audio | Player, waveform candidate, transcript, recording/transcription progress, unavailable playback |
| Video | Poster, playback/scrubbing, captions, download, loading/error |
| Document attachment | PDF/document/slides/sheet card, page/sheet count where known, open preview |
| Artifact card | Title, type, size, preview, open in viewer, save/download, review status |
| Artifact revision | Generating, ready, updated, approved, superseded, missing/pruned file |
| Visualization/widget | Compact preview and open-viewer action for diagrams, charts, interactive HTML, simulations |
| Change summary | File count, additions/deletions, file list, review action, no changes, stale diff |
| Review finding | Severity, explanation, file/line excerpt, open diff, resolved/outdated state |
| Suggested next action | Follow-up prompt chip, open artifact, continue work; used/disabled state |

Keep full documents, large diagrams, and interactive artifacts in the dedicated
viewer, following the existing artifact requirement. Their chat cards and
previews belong in this inventory.

## 8. System events and recovery

| Surface | Things to design |
| --- | --- |
| Retry/backoff | Reason, attempt count, countdown, cancel, exhausted retries |
| Connection event | Offline, reconnecting, disconnected stream, recovered history, unsent draft retained |
| Provider failure | Rate limit, unavailable model, authentication failure, quota/budget reached |
| Context event | Near context limit, compacting, summary inserted, context removed, compaction failed |
| Session event | Model/mode/persona changed, branch created, rewind marker, resumed/imported session |
| Recovery notice | Interrupted by shutdown, preserved results, unfinished action, Continue |
| Permission constraint | Tool blocked by active mode or workspace restriction, explanation, relevant settings link |
| Missing history/content | Deleted attachment, pruned snapshot/log, unknown entry, renderer failure |
| Custom plugin entry | Plugin identity, rich result, unavailable renderer, text/JSON fallback |

## 9. Composer and nearby controls

| Surface | Things to design |
| --- | --- |
| Prompt input | Empty, focused, multiline, long draft, pasted code, disabled, read-only history |
| Context tray | Files, selections, folders, images, URLs, annotations; remove, inspect, unresolved reference |
| Mention/command picker | Files, agents, skills, tools, slash commands; search, no matches, keyboard selection |
| Run controls | Send, Stop, Continue, Steer, Follow up; active action and keyboard hint |
| Mid-run input | Steering pending/applied, queued follow-ups, edit/remove/reorder candidates |
| Model/mode controls | Model, reasoning level, persona/mode, tool restrictions; unavailable choice |
| Voice input candidate | Start/stop recording, listening, transcribing, review before send, microphone error |
| Draft recovery | Restored draft, failed send, attachments still uploading, conflict after switching conversations |
| Context/usage indicator | Compact usage meter, near-limit state, open inspector |

## 10. Transcript navigation and shared states

| Surface | Things to design |
| --- | --- |
| Empty conversation | Starting prompt, suggested tasks, attached context before first send |
| History loading | Initial skeleton, older-message loader, load failure, end of history |
| Scroll behavior | Follow live output, detached reading, Jump to bottom, new activity count |
| Find in conversation | Search field, highlighted matches, next/previous, match inside collapsed content |
| Density/disclosure | Detailed versus summarized run, expand/collapse all, remembered expansion |
| Branch/rewind entry | Active path, branch origin, carryover summary choice, file-revert option unavailable |
| Selection and focus | Text selection during streaming, keyboard traversal, visible focus, hover action discovery |
| Pane constraints | Main view and drawer, narrow widths, long unbroken text, wide output, overlapping composer |
| Accessibility | Announce useful status changes without reading every token; labels, contrast, reduced motion |
| Visual consistency | Light/dark themes, error without color alone, loading/empty/error/disabled states |

## Suggested first design pass

Start with one representative conversation containing a user prompt with context,
thinking, a progress update, grouped file/search tools, a running command, a
question or approval, a change summary, and a final answer. Then branch that
example into stopped, failed, queued-follow-up, and narrow-pane states.

For each family, decide:

- What must be visible at a glance, and what belongs behind expansion?
- Which actions are available while running, after completion, and in history?
- Does it appear as a message, a block within a message, or a run-level event?
- How does it remain understandable when collapsed or when content is missing?
- Can an existing component own it, or does it need a distinct component?

Additional stress scenarios: a long research answer with citations, ten parallel
tools with one failure, multiple subagents, a large truncated log, an artifact
revision, reconnecting mid-run, and opening an old branch with unavailable files.
