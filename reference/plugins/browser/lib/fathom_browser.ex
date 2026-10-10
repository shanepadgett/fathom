defmodule FathomBrowser do
  @moduledoc """
  The browser context: tabs, their addresses, and annotations.

  Tab state lives in `FathomBrowser.Tabs`, so tabs survive closing the dock
  and leaving the workspace. The desktop shell renders each tab in a native
  webview; `FathomBrowserWeb.BrowserLive` keeps those webviews in step.

  Annotations live in `FathomBrowser.Annotations`. While annotating is on,
  the active tab's page lets the person pick an element, write what should
  change, and try style edits; each note arrives here numbered.
  `annotations_prompt/0` turns them into text for an agent.
  """

  defdelegate state(), to: FathomBrowser.Tabs

  @doc "Subscribes to `{:browser_tabs, state}` and `{:browser_annotations, state}`."
  def subscribe do
    FathomBrowser.Tabs.subscribe()
    FathomBrowser.Annotations.subscribe()
  end

  defdelegate annotations(), to: FathomBrowser.Annotations, as: :state
  defdelegate annotate(on?), to: FathomBrowser.Annotations
  defdelegate add_annotation(tab, payload), to: FathomBrowser.Annotations, as: :add
  defdelegate remove_annotation(n), to: FathomBrowser.Annotations, as: :remove
  defdelegate clear_annotations(), to: FathomBrowser.Annotations, as: :clear

  @doc "The current notes as Markdown for an agent."
  @spec annotations_prompt() :: String.t()
  def annotations_prompt, do: FathomBrowser.Annotations.prompt(annotations().notes)
  defdelegate open(url \\ nil), to: FathomBrowser.Tabs
  defdelegate close(id), to: FathomBrowser.Tabs
  defdelegate activate(id), to: FathomBrowser.Tabs
  defdelegate navigate(id, url), to: FathomBrowser.Tabs
  defdelegate loaded(id, url, loading?), to: FathomBrowser.Tabs
  defdelegate titled(id, title), to: FathomBrowser.Tabs

  @doc """
  Turns what someone typed into the address bar into a URL: a URL as is, a
  local address over http, a domain over https, anything else a search.

      iex> FathomBrowser.address("localhost:4000")
      "http://localhost:4000"
      iex> FathomBrowser.address("hexdocs.pm/phoenix")
      "https://hexdocs.pm/phoenix"
  """
  @spec address(String.t()) :: String.t() | nil
  def address(input) do
    input = String.trim(input)

    cond do
      input == "" ->
        nil

      input =~ ~r"^[a-z][a-z0-9+.-]*://"i or String.starts_with?(input, "about:") ->
        input

      input =~ ~r"^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(/|$)" ->
        "http://" <> input

      not String.contains?(input, " ") and input =~ ~r"^[^/ ]+\.[a-z]{2,}(:\d+)?(/|$)"i ->
        "https://" <> input

      true ->
        "https://duckduckgo.com/?q=" <> URI.encode_www_form(input)
    end
  end
end
