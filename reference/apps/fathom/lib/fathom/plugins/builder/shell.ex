defmodule Fathom.Plugins.Builder.Shell do
  @moduledoc false
  # Prints like Mix.Shell.IO and records what it printed, so a failure can
  # carry Mix's or Hex's explanation back to the plugin that caused it. The
  # builder has no terminal: prompts get no answer.
  @behaviour Mix.Shell

  def start, do: Agent.start(fn -> [] end, name: __MODULE__)

  @doc "Returns what was printed since the last call."
  def take, do: Agent.get_and_update(__MODULE__, &{&1 |> Enum.reverse() |> Enum.join("\n"), []})

  @impl true
  def print_app, do: Mix.Shell.IO.print_app()

  @impl true
  def info(message) do
    record(message)
    Mix.Shell.IO.info(message)
  end

  @impl true
  def error(message) do
    record(message)
    Mix.Shell.IO.error(message)
  end

  @impl true
  def prompt(message) do
    info(message)
    ""
  end

  @impl true
  def yes?(message, _options \\ []) do
    info(message)
    false
  end

  @impl true
  def cmd(command, options \\ []), do: Mix.Shell.IO.cmd(command, options)

  defp record(message) do
    text = message |> IO.ANSI.format(false) |> IO.chardata_to_string()
    Agent.update(__MODULE__, &[text | &1])
  end
end
