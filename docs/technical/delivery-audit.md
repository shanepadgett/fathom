# Delivery audit

This is an implementation audit, not a replacement for the requirements or
approved designs. An implemented API or successful narrow check does not prove
the complete workflow. Keep the delivery boxes in implementation.md open until
their full requirements are exercised.

## Browser and editor integration — September 15

Requirement: `docs/requirements/frontend-and-ux.md`, sections 2 and 3.

| Requirement                | Current evidence                                                                                                                                                                                                                                                                                                                                                                                    | Remaining work                                                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Native embedded browser    | BrowserConnection uses a separate Chromium connection and sends screencast frames to BrowserPanel.                                                                                                                                                                                                                                                                                                  | Resolve the native child-webview requirement against the desktop runtime; current frames are not proof of native embedding.            |
| Development server pairing | Native use verified session switching, automatic selection, shared server search, two candidates from one PTY, split ANSI-colored output, rejection of credential/non-loopback fixture URLs, explicit navigation, candidate removal on terminal stop, environment reload clearing stale frames, and automatic rediscovery after restart. Detailed ports and runs are recorded in implementation.md. | Exercise reload rollback and annotation ownership across restart. Native child-webview embedding remains a separate unmet requirement. |
| Browser alongside Monaco   | Astra implemented WorkspaceSurfaces using the shared SplitPane. Native use verified Monaco beside a rendered page, drag resizing, active/split switching, width restoration after window resize, and overlay drawers. Project-backed docking/width settings survived native relaunch on a changed port and native switching between projects with different widths/docking preferences.             | Verify no-session flow. Complete remaining design fidelity review, including remembering explicit Restricted Mode decisions.           |
| Browser tabs               | Browser plugin retains one connection and current URL per project.                                                                                                                                                                                                                                                                                                                                  | Implement tab identity, selection, lifecycle and annotation ownership rather than treating routes as tabs.                             |
| Annotation staging         | BrowserPanel uses browserFeedback and AnnotationArea; earlier native checks staged comments without submitting them.                                                                                                                                                                                                                                                                                | Verify navigation, session changes and future tab switches preserve the correct source and crop.                                       |

Process output is untrusted data. URL discovery should accept only explicitly
supported loopback HTTP(S) addresses, avoid credentials, and retain the source
terminal/session. Do not interpret printed commands as instructions. Reuse the
existing terminal events and browser navigation service rather than adding a
second process runner or browser connection owner.

### Desktop runtime boundary

Deno 2.9 documents `BrowserWindow` as a native window: the first construction
adopts the startup window and later constructions create additional windows.
Its documented options do not expose an embedded child browser surface. The
`getNativeWindow()` API returns a WebGPU surface, not a documented child-webview
attachment API. See the official [window API guide](https://docs.deno.com/runtime/desktop/windows/).

Source inspection now confirms the boundary in Laufey v0.7.0 (commit
`1fe87874288e8359fa3de04d18cc14f56957b000`), the version present in the local
Deno backend cache:

- `Backend_CreateWindowImpl` creates a `CefBrowserView`, then always calls
  `CefWindow::CreateTopLevelWindow`. It accepts flags, not a parent or child bounds.
- The CEF backend assigns `get_window_handle` a function returning `nullptr`.
  The generic native-handle API therefore cannot provide a parent for this backend.
- The window delegate uses CEF's `AddChildView` internally. Native composition is
  possible at that layer, but the current runtime does not expose it to app code.
- C API version 34 exposes window lifecycle and navigation, but no child-browser
  creation, layout, visibility or disposal contract.

Authoritative sources: [window creation and handle implementation](https://github.com/littledivy/laufey/blob/1fe87874288e8359fa3de04d18cc14f56957b000/cef/src/runtime_loader.cc),
[window delegate](https://github.com/littledivy/laufey/blob/1fe87874288e8359fa3de04d18cc14f56957b000/cef/src/app.cc),
and [backend API](https://github.com/littledivy/laufey/blob/1fe87874288e8359fa3de04d18cc14f56957b000/capi/include/laufey.h).

### Native embedding implementation boundary

The next native work must add a supported child-browser contract at the backend
boundary. Keep project/session pairing, discovery and feedback in Cordis; the
native layer owns only browser creation, bounds, visibility, navigation,
inspection, capture and destruction. Do not infer a native parent by scanning
other application windows or replace the requirement with a floating window.

Before replacing the current browser, prove these cases in the signed desktop:

1. A child browser inside the existing window resizes with the shared SplitPane.
2. Modal, drawer and annotation layers remain visible and receive input correctly;
   normal browser interaction retains keyboard focus, scrolling and text selection.
3. Untrusted pages have no shell bindings or access to the authenticated app RPC.
   Include direct navigation and redirects to the app's own origin: an isolated
   cookie context alone is insufficient because `/bootstrap` establishes a new
   authenticated cookie for a same-origin page. The child must not load that
   origin or its bootstrap/RPC endpoints, including through worker requests.
4. Navigation, element inspection and capture refer to the same session/view;
   stale asynchronous results cannot cross a switch or reload.
5. Panel close, environment reload and app quit dispose native resources without
   replacing the app's signing identity or leaving child processes behind.

This is an implementation boundary and verification plan, not completed native
embedding. A backend extension and its build integration remain to be implemented.

## Recently verified slices

- Native transcript activity grouping, expansion during successive Luna tool
  steps, and visible final prose after collapse.
- Global custom entry renderer load/unload, original entry identity and full
  thinking/text content, restoration of built-in grouping.
- Language-server restart with dirty editor content, diagnostics and completion.
- Missing executable startup isolation, repeated failure, successful retry after
  executable availability, and scoped plugin unload.

Detailed evidence and limitations remain in `implementation.md`. These slices
do not close the full frontend, plugin, provider or durable-workflow milestones.
