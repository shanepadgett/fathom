defmodule FathomAgent.Tool do
  @moduledoc """
  A tool the agent can call. Contribute the module to `FathomAgent.Tools`
  as `%{tool: module}` under its name.

  `run/2` runs in the agent's loop process and may take as long as it
  needs; stopping the run kills that process, so clean up external
  processes by linking or monitoring. Paths in arguments are relative to
  `context.cwd`.

  The result's `content` is what the model reads. `details` is for the
  person: the chat shows it under the call (a diff, an exit code).
  Return `{:error, message}` for failures the model should see and fix,
  or `{:error, result}` to keep details with the failure.
  """

  @type context :: %{
          cwd: Path.t(),
          session: String.t(),
          call_id: String.t(),
          reply_to: pid()
        }
  @type result :: %{content: String.t(), details: map()}

  @callback name() :: String.t()
  @callback description() :: String.t()
  @doc "A JSON Schema object for the arguments."
  @callback parameters() :: map()
  @callback run(arguments :: map(), context()) ::
              {:ok, result()} | {:error, String.t() | result()}

  @doc "Streams output from a running tool to the chat."
  @spec output(context(), String.t()) :: :ok
  def output(%{reply_to: pid, call_id: id}, fragment) do
    send(pid, {:tool_output, id, fragment})
    :ok
  end

  @doc "Resolves a tool's path argument against the session folder."
  @spec path(context(), String.t()) :: Path.t()
  def path(%{cwd: cwd}, path), do: path |> Path.expand(cwd)
end
