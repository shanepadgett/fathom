# AI package standards

- Own Fathom provider registration, credential lifecycle, model discovery, selection, and capability
  policy.
- Build on Pi AI directly. Do not recreate its provider or streaming abstractions.
- Keep credentials out of logs, errors, events, and renderer-facing data. Credential persistence
  must use explicit validation and atomic writes.
- Expose product-level operations and state. Do not leak storage or desktop UI concerns into this
  package.
- Put reusable AI policy with its owning concept instead of creating local parsing, error, or
  credential helpers inside callers.
