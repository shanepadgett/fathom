defmodule FathomProviderAnthropic do
  @moduledoc """
  Anthropic as an LLM provider, by API key or Claude sign-in. Requests made
  with a sign-in present Claude Code's identity; see
  `FathomProviderAnthropic.ClaudeCode`.
  """
  @behaviour FathomLlm.Provider

  alias FathomCredentials.Credential
  alias FathomLlm.Protocols.{Messages, ModelCatalog}
  alias FathomProviderAnthropic.ClaudeCode

  @base_url "https://api.anthropic.com/v1"
  @api_version {"anthropic-version", "2023-06-01"}

  @impl true
  def id, do: "anthropic"

  @impl true
  def label, do: "Anthropic"

  @impl true
  def models(credential) do
    %{base_url: base_url, headers: headers} = endpoint(credential)
    ModelCatalog.list(base_url <> "/models", headers, id())
  end

  @impl true
  def stream(request, credential, reply_to, ref),
    do: Messages.stream(endpoint(credential), request, reply_to, ref)

  defp endpoint(%Credential{kind: :api_key, key: key}),
    do: %{base_url: @base_url, headers: [@api_version, {"x-api-key", key}]}

  defp endpoint(%Credential{kind: :oauth, access_token: token}),
    do: %{
      base_url: @base_url,
      headers: [@api_version | ClaudeCode.headers(token)],
      system: ClaudeCode.system()
    }
end
