defmodule FathomAgentRuntime.Store do
  @moduledoc """
  Session files: `<home>/sessions/<id>.json`, one JSON document per
  session, rewritten atomically after every change to its record.

  JSON has no atoms, so `decode/1` restores the keys and values the
  runtime matches on. Tool `details` and provider `native` data stay as
  JSON (string keys) both live and on disk.
  """

  @version 1

  def dir, do: Path.join(Fathom.Environment.home(), "sessions")

  @spec save(map()) :: :ok
  def save(session) do
    File.mkdir_p!(dir())
    path = Path.join(dir(), session.id <> ".json")
    tmp = path <> ".tmp"

    data =
      session
      |> Map.take([:id, :title, :cwd, :provider, :model, :created_at, :updated_at, :entries])
      |> Map.put(:version, @version)

    File.write!(tmp, Jason.encode_to_iodata!(data))
    File.rename!(tmp, path)
  end

  @spec delete(String.t()) :: :ok
  def delete(id) do
    File.rm(Path.join(dir(), id <> ".json"))
    :ok
  end

  @doc "Every readable session file, decoded. Unreadable files are skipped."
  @spec load_all() :: [map()]
  def load_all do
    for path <- Path.wildcard(Path.join(dir(), "*.json")),
        {:ok, data} <- [File.read(path)],
        {:ok, %{"version" => @version} = json} <- [Jason.decode(data)],
        do: decode(json)
  end

  defp decode(json) do
    %{
      id: json["id"],
      title: json["title"],
      cwd: json["cwd"],
      provider: json["provider"],
      model: json["model"],
      created_at: json["created_at"],
      updated_at: json["updated_at"],
      entries: Enum.map(json["entries"] || [], &entry/1)
    }
  end

  @doc "Restores one record entry from JSON."
  def entry(%{"role" => "user"} = e), do: %{role: :user, content: e["content"]}

  def entry(%{"role" => "assistant"} = e) do
    %{
      role: :assistant,
      content: Enum.flat_map(e["content"] || [], &part/1),
      provider: e["provider"],
      model: e["model"],
      native: e["native"],
      thinking: e["thinking"],
      usage: usage(e["usage"])
    }
  end

  def entry(%{"role" => "tool_result"} = e) do
    %{
      role: :tool_result,
      tool_call_id: e["tool_call_id"],
      name: e["name"],
      content: e["content"],
      error: e["error"] == true,
      details: e["details"] || %{},
      duration_ms: e["duration_ms"]
    }
  end

  def entry(%{"role" => "notice"} = e),
    do: %{role: :notice, content: e["content"], error: e["error"] == true}

  defp part(%{"type" => "text", "text" => text}), do: [%{type: :text, text: text}]

  defp part(%{"type" => "tool_call"} = p),
    do: [%{type: :tool_call, id: p["id"], name: p["name"], arguments: p["arguments"] || %{}}]

  defp part(_part), do: []

  defp usage(%{"input" => input, "output" => output}), do: %{input: input, output: output}
  defp usage(_usage), do: nil
end
