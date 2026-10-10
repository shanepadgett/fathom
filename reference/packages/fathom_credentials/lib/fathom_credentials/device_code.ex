defmodule FathomCredentials.DeviceCode do
  @moduledoc """
  OAuth 2.0 device authorization (RFC 8628): show a code, poll until the
  person approves, denies, or the code expires.
  """
  alias FathomCredentials.{Credential, LoginUI}

  defmodule Config do
    @moduledoc "`refresh_skew_ms` is subtracted from token expiry to refresh early."
    @enforce_keys [:client_id, :device_code_url, :token_url, :scope]
    defstruct [:client_id, :device_code_url, :token_url, :scope, :referrer, refresh_skew_ms: 0]
  end

  @default_lifetime_s 3600
  @min_interval_ms 1000
  @default_interval_ms 5000
  @slow_down_ms 5000
  @headers [accept: "application/json"]

  @spec login(Config.t(), LoginUI.t()) :: {:ok, Credential.t()} | {:error, String.t()}
  def login(%Config{} = config, ui) do
    form =
      %{"client_id" => config.client_id, "scope" => config.scope}
      |> then(&if(config.referrer, do: Map.put(&1, "referrer", config.referrer), else: &1))

    with {:ok, %{body: %{"device_code" => device_code, "user_code" => user_code} = device}} <-
           Fathom.HTTP.request(
             method: :post,
             url: config.device_code_url,
             form: form,
             headers: @headers
           ),
         {:ok, url} <- https(device["verification_uri_complete"] || device["verification_uri"]),
         expires_in when is_number(expires_in) and expires_in > 0 <- device["expires_in"] do
      LoginUI.notify(ui,
        message:
          "Open the sign-in page and authorize this device. Fathom will finish connecting automatically.",
        url: url,
        code: user_code
      )

      deadline = now() + trunc(expires_in * 1000)
      poll(config, device_code, interval(device["interval"], @default_interval_ms), deadline)
    else
      {:error, %{__exception__: true} = exception} -> {:error, Exception.message(exception)}
      {:error, message} -> {:error, message}
      _ -> {:error, "Device authorization returned an unrecognized response"}
    end
  end

  @spec refresh(Config.t(), Credential.t()) :: {:ok, Credential.t()} | {:error, String.t()}
  def refresh(%Config{} = config, %Credential{kind: :oauth} = credential) do
    form = %{
      "grant_type" => "refresh_token",
      "client_id" => config.client_id,
      "refresh_token" => credential.refresh_token
    }

    case Fathom.HTTP.request(
           method: :post,
           url: config.token_url,
           form: form,
           headers: @headers,
           retries: 0
         ) do
      {:ok, %{body: body}} -> credential(config, body, credential.refresh_token)
      {:error, exception} -> {:error, Exception.message(exception)}
    end
  end

  defp poll(config, device_code, interval, deadline) do
    wait = min(interval, deadline - now())

    if wait <= 0 do
      {:error, "Device code expired. Start login again."}
    else
      Process.sleep(wait)

      # RFC 8628 reports pending, slow_down, and denial as HTTP 400 bodies,
      # so this reads the body instead of treating 400 as failure.
      form = %{
        "grant_type" => "urn:ietf:params:oauth:grant-type:device_code",
        "client_id" => config.client_id,
        "device_code" => device_code
      }

      case Req.post(config.token_url, form: form, headers: @headers, retry: false) do
        {:ok, %{status: status, body: body}} when status in 200..299 ->
          credential(config, body, nil)

        {:ok, %{status: status, body: %{} = body}} ->
          case body["error"] do
            "authorization_pending" ->
              poll(config, device_code, interval, deadline)

            "slow_down" ->
              next = max(interval + @slow_down_ms, interval(body["interval"], 0))
              poll(config, device_code, next, deadline)

            denied when denied in ["access_denied", "authorization_denied"] ->
              {:error, "Device authorization was denied"}

            "expired_token" ->
              {:error, "Device code expired. Start login again."}

            _ ->
              {:error, "Device token polling failed (HTTP #{status})"}
          end

        {:ok, %{status: status}} ->
          {:error, "Device authorization returned invalid JSON (HTTP #{status})"}

        {:error, exception} ->
          {:error, Exception.message(exception)}
      end
    end
  end

  defp credential(config, %{"access_token" => access} = body, previous_refresh)
       when is_binary(access) do
    case body["refresh_token"] || previous_refresh do
      nil ->
        {:error, "Provider did not issue a refresh token"}

      refresh ->
        lifetime = (body["expires_in"] || @default_lifetime_s) * 1000

        {:ok,
         Credential.oauth(
           access_token: access,
           refresh_token: refresh,
           expires_at: now() + trunc(lifetime) - config.refresh_skew_ms
         )}
    end
  end

  defp credential(_config, _body, _previous),
    do: {:error, "Provider returned an unrecognized token response"}

  defp https(url) when is_binary(url) do
    case URI.parse(url) do
      %URI{scheme: "https"} -> {:ok, url}
      _ -> {:error, "Device authorization returned an unsafe sign-in URL"}
    end
  end

  defp https(_), do: {:error, "Device authorization returned no sign-in URL"}

  defp interval(seconds, _default) when is_number(seconds) and seconds > 0,
    do: max(@min_interval_ms, trunc(seconds * 1000))

  defp interval(_, default), do: default

  defp now, do: System.system_time(:millisecond)
end
