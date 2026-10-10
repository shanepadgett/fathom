defmodule FathomProviderAnthropic.ClaudeCode do
  @moduledoc """
  The client identity Anthropic expects on requests made with a Claude
  subscription token. Anthropic serves subscription tokens at subscription
  limits only to Claude Code; other traffic is throttled. Requests with an
  API key never use this module.

  Keep `@version` at the latest Claude Code release:
  https://www.npmjs.com/package/@anthropic-ai/claude-code

  Subscription requests also send tools under Claude Code's names (`Read`,
  `Bash`, …); `tool_name/1` maps Fathom's names. The Messages protocol maps
  replies back to the request's tools.
  """

  @version "2.1.296"
  @betas ["claude-code-20250219", "oauth-2025-04-20"]
  @identity "You are Claude Code, Anthropic's official CLI for Claude."

  # Claude Code's built-in tools. To update: https://github.com/badlogic/cchistory
  @tools ~w(Read Write Edit Bash Grep Glob AskUserQuestion EnterPlanMode ExitPlanMode
            KillShell NotebookEdit Skill Task TaskOutput TodoWrite WebFetch WebSearch)
  @tool_names Map.new(@tools, &{String.downcase(&1), &1})

  @doc "OAuth scopes Claude Code requests at sign-in."
  def scope,
    do:
      "org:create_api_key user:profile user:inference user:sessions:claude_code " <>
        "user:mcp_servers user:file_upload"

  @doc "Request headers for a subscription access token."
  @spec headers(String.t()) :: [{String.t(), String.t()}]
  def headers(access_token) do
    [
      {"authorization", "Bearer " <> access_token},
      {"anthropic-beta", Enum.join(@betas, ",")},
      {"anthropic-dangerous-direct-browser-access", "true"},
      {"user-agent", "claude-cli/" <> @version},
      {"x-app", "cli"}
    ]
  end

  @doc "A tool name in Claude Code's casing when it names a Claude Code tool."
  @spec tool_name(String.t()) :: String.t()
  def tool_name(name), do: Map.get(@tool_names, String.downcase(name), name)

  @doc "System blocks that precede any system prompt Fathom sends."
  @spec system() :: [map()]
  def system, do: [%{type: "text", text: @identity, cache_control: %{type: "ephemeral"}}]
end
