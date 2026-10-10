defmodule FathomAgentRuntimeWeb.Markdown do
  @moduledoc """
  A model's Markdown as safe HTML. Raw HTML in the source shows as text,
  and the output is sanitized. `partial: true` closes syntax a streaming
  reply has left open, such as an unfinished code fence.
  """

  @options [
    extension: [table: true, strikethrough: true, autolink: true, tasklist: true],
    render: [escape: true],
    sanitize: MDEx.Document.default_sanitize_options()
  ]

  @spec html(String.t(), keyword()) :: Phoenix.HTML.safe()
  def html(text, opts \\ []) do
    options = Keyword.put(@options, :auto_close, Keyword.get(opts, :partial, false))
    Phoenix.HTML.raw(MDEx.to_html!(text, options))
  end
end
