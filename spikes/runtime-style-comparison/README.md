# Runtime style comparison

Two implementations of the same small agent runtime using Pi AI only:

- `plain/`: promises, `AbortSignal`, async generators, explicit dependencies and cleanup
- `effect/`: `ManagedRuntime`, scoped resources, bounded `Queue`, `Stream`, typed failures,
  structured concurrency, and interruption

Both make a real OpenAI Codex call using the existing private `~/.pi/agent/auth.json`, require an
`inspect_workspace` tool call, stream text as it arrives, pause for approval, run tool batches in
parallel, append durable records in call order, make another model call, propagate host
cancellation, retry transient model failures without replaying published partial text, enforce
model/tool timeouts, and dispose an extension scope. Neither modifies Pi credentials.

```sh
mise exec -- deno task --cwd spikes/runtime-style-comparison check
mise exec -- deno task --cwd spikes/runtime-style-comparison verify
mise exec -- deno task --cwd spikes/runtime-style-comparison plain ../.. \
  "Inspect README.md and summarize it in one sentence."
mise exec -- deno task --cwd spikes/runtime-style-comparison effect ../.. \
  "Inspect README.md and summarize it in one sentence."
```

Set `FATHOM_MODEL` to select another OpenAI Codex model. Runs append
`.runtime-style-comparison.jsonl` in the selected workspace.

The Effect host has one boundary: `ManagedRuntime.runPromise`. Model `AsyncIterable` conversion,
event delivery, concurrency, resource ownership, and cancellation stay inside Effect. Each run is a
`Stream<RuntimeEvent>` backed by a bounded queue, without nested Effect runners or a global event
bus.
