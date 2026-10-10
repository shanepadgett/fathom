defmodule FathomAgent do
  @moduledoc """
  The agent contract: sessions in which a model works in a folder with
  tools. The `agent` plugin implements it by default.

  A session's `entries` are its record: the conversation the model sees
  (`FathomLlm.message/0`) plus `%{role: :notice, content:}` lines for the
  person, such as errors and stops. Tool results also carry `details` for
  display and `duration_ms`.

  Subscribers to `subscribe/0` receive `{:agent_sessions, :changed}` when
  sessions are added, removed, renamed, or start or stop running, and
  `{:agent_sessions, {:show, id}}` when something asks to show a session.
  Subscribers to `subscribe/1` receive `{:agent, id, seq, event}`. `seq`
  counts the session's events; `session/1` returns the `seq` its snapshot
  includes, so a subscriber skips events at or below it:

    * `{:status, :running | :idle}`
    * `{:text, fragment}` and `{:thinking, fragment}`: the reply arriving
    * `{:tool_call, call}`: a call the reply makes, before it runs
    * `{:tool_start, call_id}`: a call starts running
    * `{:tool_output, call_id, fragment}`: output from a running tool
    * `{:entry, entry}`: an entry added to the record
  """
  use Fathom.Service

  @type id :: String.t()
  @type summary :: %{
          id: id(),
          title: String.t(),
          cwd: Path.t(),
          provider: String.t(),
          model: String.t(),
          status: :idle | :running,
          updated_at: integer()
        }
  @type entry :: FathomLlm.message() | %{role: :notice, content: String.t()}
  @type session :: %{
          required(:entries) => [entry()],
          required(:partial) =>
            %{text: String.t(), thinking: String.t(), calls: [FathomLlm.tool_call()]} | nil,
          required(:running) => %{String.t() => String.t()},
          required(:seq) => non_neg_integer(),
          optional(atom()) => term()
        }

  @doc """
  Starts a session in `cwd`. Without `provider` and `model`, it uses the
  model the person chose last.
  """
  @callback create(%{
              required(:cwd) => Path.t(),
              optional(:provider) => String.t(),
              optional(:model) => String.t()
            }) :: {:ok, id()} | {:error, String.t()}
  @callback prompt(id(), String.t()) :: :ok | {:error, String.t()}
  @callback abort(id()) :: :ok
  @callback set_model(id(), provider :: String.t(), model :: String.t()) :: :ok
  @callback delete(id()) :: :ok
  @callback sessions() :: [summary()]
  @callback session(id()) :: session() | nil

  def create(attrs), do: Fathom.Service.call(__MODULE__, :create, [attrs])
  def prompt(id, text), do: Fathom.Service.call(__MODULE__, :prompt, [id, text])
  def abort(id), do: Fathom.Service.call(__MODULE__, :abort, [id])

  def set_model(id, provider, model),
    do: Fathom.Service.call(__MODULE__, :set_model, [id, provider, model])

  def delete(id), do: Fathom.Service.call(__MODULE__, :delete, [id])
  def sessions, do: Fathom.Service.call(__MODULE__, :sessions, [])
  def session(id), do: Fathom.Service.call(__MODULE__, :session, [id])

  @doc "Asks chat views to show session `id`, such as one another plugin started."
  @spec show(id()) :: :ok
  def show(id), do: Fathom.Events.broadcast("agent:sessions", {:agent_sessions, {:show, id}})

  def subscribe, do: Fathom.Events.subscribe("agent:sessions")
  def subscribe(id), do: Fathom.Events.subscribe("agent:session:" <> id)
  def unsubscribe(id), do: Fathom.Events.unsubscribe("agent:session:" <> id)
end
