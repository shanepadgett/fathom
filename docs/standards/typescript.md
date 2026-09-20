# TypeScript

- Use blank lines to separate logical steps, even when lint does not require one.
  Keep related short statements together.
- Prefer early returns to deep nesting. Split dense expressions into named steps
  when that makes their purpose clearer.
- Name values and functions for what they mean or do, not their implementation.
- Keep related declarations close. Order code for reading, not alphabetically.
- Keep published types precise. Do not widen schemas or API contracts to satisfy
  JSR checks; retain their fields, literals, and optional values.

## Code quality

- Name policy values such as timeouts, retry counts, and size limits. Include
  units in names. Keep constants near their owner; equal values do not imply
  shared policy. Leave obvious values and standard protocol codes inline.
- Model distinct states with unions. Keep values that must exist together in
  one object instead of independent flags or optional fields.
- Validate external data at its boundary. Use the validated types inside the
  app instead of repeating checks or trusting type assertions.
- Catch errors to recover, add context, or report them. Do not turn failures
  into empty results unless that is the contract. Preserve the original cause
  when adding context, but never expose credentials in errors or logs.
- Make resource and async-work ownership clear. Arrange cleanup when acquiring
  resources. Propagate cancellation and release resources on failure too.
- Keep interfaces small and specific. Pass what the operation needs. Reuse
  existing code before adding helpers, options, or abstractions for future use.
- Prefer narrowing to `as`, `!`, and `any`. If an assertion is necessary, keep
  it at the boundary and explain the guarantee that the compiler cannot prove.

## Comments

- Use `/** ... */` for API docs. Document public SDK and plugin contracts where
  types do not explain usage, errors, side effects, cancellation, or cleanup.
- Use `//` for implementation reasons, constraints, and workarounds. Explain
  complex logic when needed; prefer clearer code over explaining confusing code.
- Keep comments short and beside the code. Do not repeat names, types, or obvious
  steps. Do not require a comment on every function.
- Add `@param`, `@returns`, or `@example` only when they add useful information.
- Update comments with behavior changes. Delete stale comments and commented-out
  code. Give TODOs a specific task and workarounds a removal condition or issue.
