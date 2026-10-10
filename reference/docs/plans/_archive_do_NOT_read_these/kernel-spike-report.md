# Kernel spike report

Spike root: `/private/var/folders/xh/_hj4nxh965q23z0sghtrlrf00000gn/T/opencode/kernel-spike/`
Env: `deno 2.9.7 (stable, release, aarch64-apple-darwin)`, `--allow-all`

Target: `docs/plans/baseline-kernel.md:423-440` First spike + `10-23` `?gen` hook claim.

## Method

Minimal kernel `spike-kernel.ts` (~277 lines): copy-gen artifacts, change queue, providers-first start / consumers-first stop, `blocked` on missing service, candidate-validated-before-stop rollback, `Scope` defer/task/signal.

Plugins: `src_plugins/greeter/{mod.ts,helper.ts}`, `src_plugins/caller/mod.ts`, `src_plugins/streamer/mod.ts`. Shared lib: `shared/counter.ts` via absolute `file:` URL (relative `../../shared` breaks after copy — artifact lives at `artifacts-kernel/<id>/<gen>/`).

## Results

| Check | File | Result |
|---|---|---|
| nested `resolve` fires, `?gen` fresh graph + old serves | `hook-test.ts`, `reload-test2.ts`, `cache2-test.ts` | PASS for good code: `hi v1` / `hi v2` distinct, `m1` still `v1` |
| `?gen` + `nextLoad(clean)` for broken nested TS | `nested-break-test.ts`, `poison-log.ts` | FAIL: disk=broken, `nextLoad` returns `{source:null}`, import returns stale `hi v2` instead of throwing |
| direct good -> direct broken `?gen` | `poison-test2.ts` | PASS (throws), so nested-good poisons later loads |
| hook returns raw TS source | `format-test.ts`, `fmt-single.ts` | FAIL for all formats (`module`, `module-typescript`, `typescript`, `ts`): `Unexpected token ':'` — Deno does not transpile hook source |
| copy-gen: fresh, old serves, broken throws | `copy-gen-test.ts` | PASS: `m1=v1`, `m2=v2`, `m1` still `v1`, `m3` throws, `m2/m1` intact |
| full lifecycle | `run-spike.ts` | PASS: caller `v1`->`v2` + shared token unchanged (cached), broken candidate keeps old, disable->caller `blocked`, enable->ready, streamer abort + swap, sqlite OK |
| `node:sqlite` open/close | `sqlite-test.ts` | PASS |
| 200 / 400 reloads | `mem-test.ts`, `mem-test2.ts` | PASS functional; RSS 26.5->51.5MB per 200 (~37-125KB/reload), heap 3.7->4.7MB flat |

Key log (`poison-log.ts`):

```text
load helper.ts?gen=102
  disk=export function greeting(: broken (((
  nextLoad src type=object null=true
h success STALE BUG: hi v2
```

Broken `nextLoad` contract (`inspect-broken.ts`): good file returns `{source:string(transpiled JS), shortCircuit:true}`, broken returns `{source:null, shortCircuit:true}` then throws on direct import — but returns stale when a prior nested good load exists.

## Recommendation for plan author

Replace `?gen` resolve/load hooks with immutable copied artifacts (`artifacts/<id>/<gen>/`, distinct paths, no hooks). Same guarantees (fresh graph, old serves, shared `file:/jsr:/npm:` stays cached), none of the TS-transpile / stale-broken failure. Keep change-queue / transitive-restart / rollback / `blocked` design. Note RSS leak tens of KB/reload; cap retained artifact dirs.

## Follow-up: resolve-only re-test

Every hook test above registered a `load` hook that stripped `?gen` and called `nextLoad(clean)`. The plan called for a `resolve` hook only. Re-run with no `load` hook (`/private/tmp/fathom-hook/test.ts`, `mem.ts`, Deno 2.9.7):

| Check | Result |
|---|---|
| nested `?gen` fresh graph, old serves | PASS: `gen1: hi v1`, `gen2: hi v2 | gen1 still: hi v1` |
| broken nested TS | PASS: `gen3 threw OK: SyntaxError`, gen4 loads fresh, gen2 intact |
| 400 reloads | RSS 31.3 → 44.9MB (~34KB/reload), heap 5.7 → 7.9MB |

Both failures came from the `load` hook, not the approach. Plan keeps the resolve-only hook; copy-gen is the documented fallback.
