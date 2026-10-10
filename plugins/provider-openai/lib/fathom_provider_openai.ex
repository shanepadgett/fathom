defmodule FathomProviderOpenAI do
  @moduledoc """
  OpenAI as an LLM provider. API keys use the public API; ChatGPT sign-in
  uses the Codex backend with the account id from the token.
  """
  @behaviour FathomLlm.Provider

  alias FathomCredentials.Credential
  alias FathomLlm.Protocols.{ModelCatalog, Responses}

  @impl true
  def id, do: "openai"

  @impl true
  def label, do: "OpenAI"

  @impl true
  def models(credential) do
    %{base_url: base_url, headers: headers} = endpoint(credential)
    # Codex hides models from older clients. Keep this at the latest Codex
    # release: https://github.com/openai/codex/releases
    path = if credential.kind == :oauth, do: "/models?client_version=0.162.1", else: "/models"
    ModelCatalog.list(base_url <> path, headers, id())
  end

  @impl true
  def stream(request, credential, reply_to, ref),
    do: Responses.stream(endpoint(credential), request, reply_to, ref)

  defp endpoint(%Credential{} = credential) do
    headers = [authorization: "Bearer " <> Credential.secret(credential)]

    headers =
      if credential.kind == :oauth and credential.account_id,
        do: headers ++ [{"ChatGPT-Account-Id", credential.account_id}],
        else: headers

    base_url =
      if credential.kind == :oauth,
        do: "https://chatgpt.com/backend-api/codex",
        else: "https://api.openai.com/v1"

    # Reasoning models need their encrypted reasoning replayed when requests
    # are not stored. Codex serves only reasoning models.
    body =
      if credential.kind == :oauth,
        do: %{include: ["reasoning.encrypted_content"], reasoning: %{summary: "auto"}},
        else: %{}

    %{base_url: base_url, headers: headers, provider: id(), body: body}
  end
end
