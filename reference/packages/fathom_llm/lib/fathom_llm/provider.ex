defmodule FathomLlm.Provider do
  @moduledoc """
  Provider-owned endpoints and authentication. Contribute the module to
  `FathomLlm.Providers` as `%{provider: module}` under the provider id.

  `stream/4` gets the request with `messages` filled in (never `prompt`),
  sends the events `FathomLlm` documents to `reply_to`, and returns the
  complete response.
  """
  alias FathomCredentials.Credential

  @callback id() :: String.t()
  @callback label() :: String.t()
  @callback models(Credential.t()) :: {:ok, [FathomLlm.model()]} | {:error, String.t()}
  @callback stream(FathomLlm.request(), Credential.t(), reply_to :: pid(), tag :: term()) ::
              {:ok, FathomLlm.response()} | {:error, String.t()}
end
