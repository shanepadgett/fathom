# Lit and Solid Prototype Comparison

Two UI-only experiments, requested on 7 September 2026. Neither selects the
production framework or ends technical planning.

## Try Them

Run these in separate terminals, from the repository root:

```sh
cd prototype-lit
FATHOM_PROFILE=echo FATHOM_PORT=4321 deno task start
```

```sh
cd prototype-solid
FATHOM_PROFILE=echo FATHOM_PORT=4322 deno task start
```

Open <http://127.0.0.1:4321> and <http://127.0.0.1:4322>. Echo makes no model
requests. Select the default runtime to use the original model integration.

Both folders also support `deno task desktop`. Their native build output is
`dist/Fathom.app`. The cloned READMEs describe launching it.

## Scope

- Original `prototype/` left untouched. Build output and local session data were
  excluded from the copies.
- Rewrote the shell, conversation, composition panel, and context meter.
- Kept the backend, transport, plugin registration contracts, zoom controls,
  plain-DOM example plugins, and stylesheet. This compares rendering libraries,
  not different product designs.
- Source is in `ui-src/`; static HTML/CSS is in `ui-public/`; Vite generates
  `ui/`. Public plugin URLs stay the same. Browser dependencies are bundled
  locally, not fetched from a CDN at runtime.
- Lit **3.3.3**; Solid **1.9.15**; Vite **8.2.2** in both; Solid Vite plugin
  **2.11.14**. Backend package versions match the original prototype, including
  `pi-ai` **0.85.0**, to avoid mixing a UI experiment with dependency upgrades.

## Observations

**Lit:** HTML templates replace much of the manual element creation. Custom
elements fit the existing mount/unmount plugin contract. Connection callbacks,
subscription cleanup, and post-render work remain explicit. Light DOM preserves
our shared stylesheet, but deliberately does not exercise shadow-DOM style
isolation. Custom element definitions also remain registered after unmounting;
component hot replacement would need its own policy.

**Solid:** JSX components fit the interactive workspace well. A small adapter
feeds the existing state source into Solid stores. Reconciliation preserves
unchanged state rather than treating every server snapshot as a new screen.
Cleanup belongs to the component scope. The main cost is learning Solid's
tracking rules and using its JSX compiler. Existing DOM-returning plugin
renderers and plain-DOM views still work.

Both still need direct DOM work for textarea sizing and scroll position. Neither
library removes the need to define state ownership and plugin cleanup.

My preference after this experiment is **Solid for the main workspace**. Lit
remains appealing for independently packaged custom elements. There is no
demonstrated reason to mix both in the app yet.

## Checks and Limits

- Both frontend builds passed, and both native macOS CEF bundles built.
- All **12 existing tests passed in each clone**. UI source lint passed.
- Chromium browser checks passed: Echo submission/reset, runtime switching,
  panel collapse retention, and no page errors.
- Browser fixtures passed: partial streamed text, tool expansion retention,
  cancel command, renderer registration/removal, view disposal, failed-submit
  draft retention, and zero remaining state subscriptions after host disposal.
- Initial visual inspection caught a literal newline in the Lit empty-state
  heading; it was corrected. Native window interaction was not exercised.
- No paid model calls, performance benchmarks, or large-transcript trials were
  run. These are functional prototypes, not production readiness proofs.
- All generated JavaScript totals roughly **45 KB for Lit** and **50 KB for
  Solid**, before compression, including shared prototype code and optional
  entries. This build shape is not an intrinsic framework-size comparison.
- The inherited HTTP server emits Deno's legacy request-abort warning. Backend
  behavior was intentionally not changed as part of this UI comparison.

## Official References

- [Lit component lifecycle](https://lit.dev/docs/components/lifecycle/)
- [Solid reactivity](https://docs.solidjs.com/concepts/intro-to-reactivity)
- [Solid cleanup](https://docs.solidjs.com/reference/lifecycle/on-cleanup)
- [Vite build configuration](https://vite.dev/config/build-options.html)
