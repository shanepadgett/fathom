defmodule FathomProviderOpenAI.Device do
  @moduledoc "OpenAI's device protocol, as in codex-rs/login/src/device_code_auth.rs."
  alias FathomCredentials.{LoginUI, OAuth}

  @default_interval_s 5
  @timeout_ms 15 * 60_000

  def login(%OAuth.Config{} = config, ui) do
    issuer =
      config.authorize_url
      |> URI.parse()
      |> Map.merge(%{path: nil, query: nil})
      |> URI.to_string()

    base = issuer <> "/api/accounts/deviceauth"

    with {:ok, %{body: %{"device_auth_id" => device_id} = body}} <-
           Fathom.HTTP.request(
             method: :post,
             url: base <> "/usercode",
             json: %{client_id: config.client_id},
             retries: 0
           ),
         code when is_binary(code) <- body["user_code"] || body["usercode"] do
      LoginUI.notify(ui,
        message:
          "Open the sign-in page and enter this code. Device login may need to be enabled in your ChatGPT security settings.",
        url: issuer <> "/codex/device",
        code: code
      )

      interval = max(1, to_integer(body["interval"]) || @default_interval_s) * 1000

      poll(
        config,
        issuer,
        base,
        device_id,
        code,
        interval,
        System.monotonic_time(:millisecond) + @timeout_ms
      )
    else
      {:error, exception} -> {:error, Exception.message(exception)}
      _ -> {:error, "Provider did not return a device code"}
    end
  end

  defp poll(config, issuer, base, device_id, code, interval, until) do
    if System.monotonic_time(:millisecond) >= until do
      {:error, "Device login expired. Start again."}
    else
      Process.sleep(interval)
      body = %{device_auth_id: device_id, user_code: code}

      case Fathom.HTTP.request(method: :post, url: base <> "/token", json: body, retries: 0) do
        {:ok, %{body: %{"authorization_code" => auth_code, "code_verifier" => verifier}}} ->
          OAuth.exchange(config, %{
            "grant_type" => "authorization_code",
            "code" => auth_code,
            "code_verifier" => verifier,
            "redirect_uri" => issuer <> "/deviceauth/callback"
          })

        # 403 and 404 mean the person has not approved the code yet.
        {:error, %Fathom.HTTP.Error{status: status}} when status in [403, 404] ->
          poll(config, issuer, base, device_id, code, interval, until)

        {:ok, _} ->
          {:error, "Provider returned an unrecognized device token response"}

        {:error, exception} ->
          {:error, Exception.message(exception)}
      end
    end
  end

  defp to_integer(value) when is_integer(value), do: value

  defp to_integer(value) when is_binary(value),
    do: with({int, _} <- Integer.parse(value), do: int, else: (_ -> nil))

  defp to_integer(_), do: nil
end
