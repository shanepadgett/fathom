defmodule FathomLlm do
  @moduledoc """
  The LLM contract: list a provider's models and stream text from one, with
  credentials resolved for the caller. `llm-router` implements it by default.

  Streaming is message passing. `stream/3` sends `{tag, {:text, fragment}}`
  to `reply_to` for each fragment, then returns `:ok` or an error. Fragments
  are pieces, not accumulated text. Stop the calling process to cancel.

  Provider plugins implement `FathomLlm.Provider` and contribute to
  `FathomLlm.Providers`. `FathomLlm.Protocols` holds the wire protocols they
  share.
  """
  use Fathom.Service

  @type model :: %{id: String.t(), name: String.t(), provider: String.t()}
  @type request :: %{provider: String.t(), model: String.t(), prompt: String.t()}

  @callback models(provider :: String.t()) :: {:ok, [model()]} | {:error, String.t()}
  @callback stream(request(), reply_to :: pid(), tag :: term()) :: :ok | {:error, String.t()}

  def models(provider), do: Fathom.Service.call(__MODULE__, :models, [provider])

  def stream(request, reply_to, tag),
    do: Fathom.Service.call(__MODULE__, :stream, [request, reply_to, tag])
end
