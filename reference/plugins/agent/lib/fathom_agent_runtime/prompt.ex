defmodule FathomAgentRuntime.Prompt do
  @moduledoc """
  The system prompt: who the agent is, its tools, the folder, and the
  folder's own agent instructions (`AGENTS.md` or `CLAUDE.md`).
  """

  @instructions ~w(AGENTS.md CLAUDE.md)
  @instructions_limit 40_000

  @spec system(Path.t(), [module()]) :: String.t()
  def system(cwd, tools) do
    names = MapSet.new(tools, & &1.name())

    """
    You are an expert coding assistant working inside Fathom, a desktop coding harness. \
    You help with coding tasks by reading files, running commands, editing code, and \
    writing new files. The person sees each tool call and its result as you work.

    Available tools:
    #{Enum.map_join(tools, "\n", &"- #{&1.name()}: #{first_sentence(&1.description())}")}

    Guidelines:
    #{guidelines(names)}
    - Be concise. Show file paths clearly when you mention files.

    Current date: #{Date.utc_today()}
    Current working directory: #{cwd}
    #{instructions(cwd)}\
    """
  end

  defp guidelines(names) do
    [
      {"bash", "- Use bash for ls, rg, find, git, builds, and tests."},
      {"read", "- Read a file before you edit it. Do not use cat or sed to read files."},
      {"edit", "- Use edit for precise changes; oldText must match the file exactly."},
      {"write", "- Use write only for new files or complete rewrites."}
    ]
    |> Enum.filter(fn {tool, _} -> MapSet.member?(names, tool) end)
    |> Enum.map_join("\n", &elem(&1, 1))
  end

  defp first_sentence(text), do: text |> String.split(~r/(?<=\.)\s/, parts: 2) |> hd()

  defp instructions(cwd) do
    Enum.find_value(@instructions, "", fn name ->
      path = Path.join(cwd, name)

      case File.read(path) do
        {:ok, text} ->
          "\nProject instructions from #{path}:\n\n" <> String.slice(text, 0, @instructions_limit)

        _ ->
          nil
      end
    end)
  end
end
