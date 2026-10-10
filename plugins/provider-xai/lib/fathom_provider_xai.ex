defmodule FathomProviderXAI do
  @moduledoc "xAI as an LLM provider, by API key or SuperGrok / X Premium sign-in."
  @behaviour FathomLlm.Provider

  alias FathomCredentials.Credential
  alias FathomLlm.Protocols.{ModelCatalog, Responses}

  @base_url "https://api.x.ai/v1"

  @impl true
  def id, do: "xai"

  @impl true
  def label, do: "xAI"

  @impl true
  def models(credential),
    do: ModelCatalog.list(@base_url <> "/language-models", headers(credential), id())

  @impl true
  def stream(request, credential, reply_to, ref),
    do:
      Responses.stream(
        %{base_url: @base_url, headers: headers(credential)},
        request,
        reply_to,
        ref
      )

  defp headers(credential), do: [authorization: "Bearer " <> Credential.secret(credential)]
end
