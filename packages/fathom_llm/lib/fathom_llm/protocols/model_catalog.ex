defmodule FathomLlm.Protocols.ModelCatalog do
  @moduledoc """
  Reads a model list in either common shape (`data` with `id`, or `models`
  with `slug`), keeps text models, and orders them by priority, then newest.
  """

  @spec list(String.t(), keyword() | map(), String.t()) ::
          {:ok, [FathomLlm.model()]} | {:error, String.t()}
  def list(url, headers, provider) do
    case Fathom.HTTP.request(url: url, headers: headers, receive_timeout: 60_000) do
      {:ok, %{body: %{} = body}} ->
        case body["data"] || body["models"] do
          entries when is_list(entries) -> {:ok, models(entries, provider)}
          _ -> {:error, "Provider returned an unrecognized model list"}
        end

      {:ok, _} ->
        {:error, "Provider returned an unrecognized model list"}

      {:error, exception} ->
        {:error, Exception.message(exception)}
    end
  end

  defp models(entries, provider) do
    entries
    |> Enum.filter(&(is_map(&1) and (&1["id"] || &1["slug"])))
    |> Enum.reject(&(&1["visibility"] == "hide"))
    |> Enum.filter(&(&1["output_modalities"] in [nil] or "text" in &1["output_modalities"]))
    |> Enum.sort_by(&{&1["priority"] || :infinity, -(&1["created"] || 0)})
    |> Enum.map(fn entry ->
      id = entry["id"] || entry["slug"]
      %{id: id, name: entry["display_name"] || id, provider: provider}
    end)
  end
end
