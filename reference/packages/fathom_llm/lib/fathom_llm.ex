defmodule FathomLlm do
  @moduledoc """
  The LLM contract: list a provider's models and stream a response from one,
  with credentials resolved for the caller. `llm-router` implements it by
  default.

  A request is a conversation: an optional system prompt, messages, and the
  tools the model may call. `prompt:` is shorthand for one user message.

  Streaming is message passing. `stream/3` sends events to `reply_to` while
  the response arrives, then returns the complete assistant response:

    * `{tag, {:text, fragment}}`: a piece of answer text, not accumulated
    * `{tag, {:thinking, fragment}}`: a piece of the model's reasoning summary
    * `{tag, {:tool_call, tool_call}}`: a complete call, once its arguments are in

  Stop the calling process to cancel.

  Provider plugins implement `FathomLlm.Provider` and contribute to
  `FathomLlm.Providers`. `FathomLlm.Protocols` holds the wire protocols they
  share.
  """
  use Fathom.Service

  @type model :: %{id: String.t(), name: String.t(), provider: String.t()}

  @typedoc "A tool the model may call. `parameters` is a JSON Schema object."
  @type tool :: %{name: String.t(), description: String.t(), parameters: map()}

  @type tool_call :: %{id: String.t(), name: String.t(), arguments: map()}

  @type part :: %{type: :text, text: String.t()} | %{type: :tool_call, id: String.t()}

  @typedoc """
  A conversation message. Assistant messages keep `native`: the provider's
  own record of the response, which it replays to the same model (OpenAI's
  encrypted reasoning, say). Other providers read `content`.
  """
  @type message ::
          %{role: :user, content: String.t()}
          | %{
              role: :assistant,
              content: [part()],
              provider: String.t(),
              model: String.t(),
              native: term()
            }
          | %{
              role: :tool_result,
              tool_call_id: String.t(),
              name: String.t(),
              content: String.t(),
              error: boolean()
            }

  @type request :: %{
          required(:provider) => String.t(),
          required(:model) => String.t(),
          optional(:system) => String.t() | nil,
          optional(:messages) => [message()],
          optional(:tools) => [tool()],
          optional(:prompt) => String.t(),
          optional(:cache_key) => String.t()
        }

  @type usage :: %{input: non_neg_integer(), output: non_neg_integer()}

  @type response :: %{
          content: [part()],
          stop: :stop | :tool_use | :length,
          usage: usage() | nil,
          native: term()
        }

  @callback models(provider :: String.t()) :: {:ok, [model()]} | {:error, String.t()}
  @callback stream(request(), reply_to :: pid(), tag :: term()) ::
              {:ok, response()} | {:error, String.t()}

  def models(provider), do: Fathom.Service.call(__MODULE__, :models, [provider])

  def stream(request, reply_to, tag),
    do: Fathom.Service.call(__MODULE__, :stream, [request, reply_to, tag])

  @doc "The request's messages, with `prompt:` as one user message."
  @spec messages(request()) :: [message()]
  def messages(%{messages: messages}) when is_list(messages), do: messages
  def messages(%{prompt: prompt}) when is_binary(prompt), do: [%{role: :user, content: prompt}]
  def messages(_request), do: []

  @doc "The text parts of assistant content, joined."
  @spec text([part()]) :: String.t()
  def text(content), do: for(%{type: :text, text: text} <- content, into: "", do: text)

  @doc "The tool calls in assistant content."
  @spec tool_calls([part()]) :: [tool_call()]
  def tool_calls(content),
    do: for(%{type: :tool_call} = call <- content, do: Map.take(call, [:id, :name, :arguments]))
end
