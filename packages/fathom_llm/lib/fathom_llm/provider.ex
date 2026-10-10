defmodule FathomLlm.Provider do
  @moduledoc """
  Provider-owned endpoints and authentication. Contribute the module to
  `FathomLlm.Providers` as `%{provider: module}` under the provider id.

  `stream/4` sends `{tag, {:text, fragment}}` to `reply_to` for each
  fragment and returns once the response completes.
  """
  alias FathomCredentials.Credential

  @callback id() :: String.t()
  @callback label() :: String.t()
  @callback models(Credential.t()) :: {:ok, [FathomLlm.model()]} | {:error, String.t()}
  @callback stream(
              %{model: String.t(), prompt: String.t()},
              Credential.t(),
              reply_to :: pid(),
              tag :: term()
            ) ::
              :ok | {:error, String.t()}
end
