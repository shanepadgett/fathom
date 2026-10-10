# fathom_llm

Definition package for language models. It runs no processes.

- `FathomLlm`: the service contract. `models/1` and `stream/3`, which sends
  `{tag, {:text, fragment}}` messages to the caller.
- `FathomLlm.Provider` and the `FathomLlm.Providers` registry: how provider
  plugins add a model provider.
- `FathomLlm.Protocols.*`: the Messages and Responses wire protocols, SSE text
  streaming, and model list parsing that providers share.

The bundled implementation is `plugins/llm-router`. Provider plugins are
`plugins/provider-*`.
