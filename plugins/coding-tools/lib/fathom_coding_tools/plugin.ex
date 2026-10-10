defmodule FathomCodingTools.Plugin do
  @moduledoc false
  use Fathom.Plugin,
    otp_app: :fathom_coding_tools,
    id: "coding-tools",
    requires: [FathomAgent.Tools],
    provides: []

  @tools [
    FathomCodingTools.Read,
    FathomCodingTools.Write,
    FathomCodingTools.Edit,
    FathomCodingTools.Bash
  ]

  @impl true
  def contributions do
    for {tool, order} <- Enum.with_index(@tools),
        do: {FathomAgent.Tools, tool.name(), %{tool: tool, order: order}}
  end
end
