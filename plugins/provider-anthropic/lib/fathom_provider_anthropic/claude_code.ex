defmodule FathomProviderAnthropic.ClaudeCode do
  @moduledoc """
  The client identity Anthropic expects on requests made with a Claude
  subscription token. Anthropic serves subscription tokens at subscription
  limits only to Claude Code; other traffic is throttled. Requests with an
  API key never use this module.

  Keep `@version` at the latest Claude Code release:
  https://www.npmjs.com/package/@anthropic-ai/claude-code

  When Fathom sends tools, subscription requests must also use Claude
  Code's tool names (`Read`, `Bash`, …) and map them back on the way in.
  That mapping belongs here.
  """

  @version "2.1.296"
  @betas ["claude-code-20250219", "oauth-2025-04-20"]
  @identity "You are Claude Code, Anthropic's official CLI for Claude."

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

  @doc "System blocks that precede any system prompt Fathom sends."
  @spec system() :: [map()]
  def system, do: [%{type: "text", text: @identity, cache_control: %{type: "ephemeral"}}]
end
