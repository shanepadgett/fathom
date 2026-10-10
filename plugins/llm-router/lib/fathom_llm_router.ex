defmodule FathomLlmRouter do
  @moduledoc """
  The bundled implementation of `FathomLlm`: finds the provider plugin in
  `FathomLlm.Providers`, resolves its credential through `FathomCredentials`,
  and hands the request over. Also runs the model diagnostics page.
  """
  @behaviour FathomLlm

  @impl true
  def models(provider) do
    with {:ok, module, credential} <- resolve(provider), do: module.models(credential)
  end

  @impl true
  def stream(%{provider: provider} = request, reply_to, ref) do
    with {:ok, module, credential} <- resolve(provider) do
      request =
        request
        |> Map.take([:provider, :model, :system, :tools, :cache_key])
        |> Map.put(:messages, FathomLlm.messages(request))

      module.stream(request, credential, reply_to, ref)
    end
  end

  defp resolve(provider) do
    with module when module != nil <- FathomLlm.Providers.provider(provider),
         {:ok, credential} <- FathomCredentials.get(provider) do
      {:ok, module, credential}
    else
      nil -> {:error, "Provider unavailable"}
      :none -> {:error, "Connect this provider first"}
      {:error, message} -> {:error, message}
    end
  end
end
