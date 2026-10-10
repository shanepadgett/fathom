# llm-router

Implements `FathomLlm` from `packages/fathom_llm`: routes each request to the
provider plugin registered in `FathomLlm.Providers`, with the credential from
`FathomCredentials`. Also adds Settings › Model diagnostics.

Context: `lib/fathom_llm_router.ex`. Manifest: `lib/fathom_llm_router/plugin.ex`.
