defmodule FathomCredentials.OAuth do
  @moduledoc """
  OAuth 2.0 authorization code with PKCE, token exchange, and refresh, for
  provider login flows.

  `login/3` in `:loopback` mode listens on the redirect URI's port for the
  callback and also accepts a pasted callback URL. `:paste` mode is for
  providers whose redirect is hosted; the person pastes `code#state`.
  """
  alias FathomCredentials.{Credential, LoginUI}
  alias FathomCredentials.OAuth.Callback

  defmodule Config do
    @moduledoc """
    A provider's OAuth client. `format` is the token request encoding.
    `account_id` derives an account id from `%{access_token:, id_token:}`.
    """
    @enforce_keys [:client_id, :authorize_url, :token_url, :redirect_uri, :scope]
    defstruct [
      :client_id,
      :authorize_url,
      :token_url,
      :redirect_uri,
      :scope,
      :account_id,
      format: :form,
      extra: %{}
    ]
  end

  @default_lifetime_s 3600

  @spec login(Config.t(), LoginUI.t(), :loopback | :paste) ::
          {:ok, Credential.t()} | {:error, String.t()}
  def login(%Config{} = config, ui, mode) do
    verifier = random(48)
    state = random(32)
    challenge = :crypto.hash(:sha256, verifier) |> Base.url_encode64(padding: false)

    query =
      %{
        "response_type" => "code",
        "client_id" => config.client_id,
        "redirect_uri" => config.redirect_uri,
        "scope" => config.scope,
        "code_challenge" => challenge,
        "code_challenge_method" => "S256",
        "state" => state
      }
      |> Map.merge(config.extra)

    url = config.authorize_url <> "?" <> URI.encode_query(query)

    with {:ok, server} <- listen(config, mode, state) do
      try do
        LoginUI.notify(ui,
          message:
            if(mode == :loopback,
              do: "Sign in in your browser. Fathom is listening for the callback.",
              else: "Sign in, then paste the authorization code from the provider."
            ),
          url: url
        )

        prompt =
          if mode == :loopback,
            do: "If the callback does not arrive, paste the full callback URL.",
            else: "Paste the complete code#state from the provider."

        with {:ok, code} <- await_code(ui, prompt, state) do
          fields = %{
            "grant_type" => "authorization_code",
            "code" => code,
            "code_verifier" => verifier,
            "redirect_uri" => config.redirect_uri
          }

          fields = if config.format == :json, do: Map.put(fields, "state", state), else: fields
          exchange(config, fields)
        end
      after
        if server, do: Supervisor.stop(server)
      end
    end
  end

  @spec refresh(Config.t(), Credential.t()) :: {:ok, Credential.t()} | {:error, String.t()}
  def refresh(%Config{} = config, %Credential{kind: :oauth} = credential) do
    exchange(
      config,
      %{"grant_type" => "refresh_token", "refresh_token" => credential.refresh_token},
      credential
    )
  end

  @doc "Exchanges `fields` at the token endpoint for an OAuth credential."
  @spec exchange(Config.t(), map(), Credential.t() | nil) ::
          {:ok, Credential.t()} | {:error, String.t()}
  def exchange(%Config{} = config, fields, previous \\ nil) do
    body = Map.put(fields, "client_id", config.client_id)
    encoding = if config.format == :json, do: [json: body], else: [form: body]

    with {:ok, %{body: %{"access_token" => access} = tokens}} when is_binary(access) <-
           Fathom.HTTP.request([method: :post, url: config.token_url, retries: 0] ++ encoding),
         refresh when is_binary(refresh) <-
           tokens["refresh_token"] || (previous && previous.refresh_token) do
      account_id =
        config.account_id &&
          config.account_id.(%{access_token: access, id_token: tokens["id_token"]})

      {:ok,
       Credential.oauth(
         access_token: access,
         refresh_token: refresh,
         expires_at: expires_at(access, tokens["expires_in"]),
         account_id: account_id || (previous && previous.account_id)
       )}
    else
      {:error, exception} -> {:error, Exception.message(exception)}
      {:ok, _} -> {:error, "Provider returned an unrecognized token response"}
      nil -> {:error, "Provider did not issue a refresh token"}
    end
  end

  @doc "JWT claims without signature verification; `%{}` if malformed. Never use for authorization."
  @spec claims(String.t() | nil) :: map()
  def claims(token) when is_binary(token) do
    with [_, payload | _] <- String.split(token, "."),
         {:ok, json} <- Base.url_decode64(payload, padding: false),
         {:ok, %{} = claims} <- Jason.decode(json) do
      claims
    else
      _ -> %{}
    end
  end

  def claims(_), do: %{}

  defp expires_at(access, expires_in) do
    case claims(access) do
      %{"exp" => exp} when is_number(exp) -> trunc(exp * 1000)
      _ -> System.system_time(:millisecond) + (expires_in || @default_lifetime_s) * 1000
    end
  end

  defp listen(_config, :paste, _state), do: {:ok, nil}

  defp listen(config, :loopback, state) do
    redirect = URI.parse(config.redirect_uri)
    plug = {Callback, owner: self(), path: redirect.path, parse: &parse(&1, state)}

    case Bandit.start_link(
           plug: plug,
           ip: {127, 0, 0, 1},
           port: redirect.port,
           startup_log: false
         ) do
      # Linked: the server stops with the login task, however the task ends.
      {:ok, server} ->
        {:ok, server}

      {:error, _} ->
        {:error,
         "Login port #{redirect.port} is busy. Close the other login flow or choose another sign-in method."}
    end
  end

  # The browser callback and a pasted reply race; the first valid one wins.
  defp await_code(ui, prompt, state) do
    owner = self()

    paster =
      spawn_link(fn ->
        case LoginUI.prompt(ui, prompt) do
          {:ok, value} -> send(owner, {:pasted, value})
          {:error, _} -> :ok
        end
      end)

    receive do
      {:callback, code} ->
        Process.unlink(paster)
        Process.exit(paster, :kill)
        LoginUI.notify(ui, message: "Completing login…")
        {:ok, code}

      {:pasted, value} ->
        parse(value, state)
    end
  end

  @doc false
  def parse(value, state) do
    value = String.trim(value)

    {code, received} =
      if String.starts_with?(value, "http") do
        params = URI.parse(value).query |> Kernel.||("") |> URI.decode_query()
        if params["error"], do: throw(:declined)
        {params["code"], params["state"]}
      else
        case String.split(value, "#", parts: 2) do
          [code, received] -> {code, received}
          [code] -> {code, nil}
        end
      end

    if code in [nil, ""] or received != state,
      do: {:error, "Invalid callback or state. Paste the complete callback URL or code#state."},
      else: {:ok, code}
  catch
    :declined -> {:error, "Provider declined authorization"}
  end

  defp random(bytes), do: :crypto.strong_rand_bytes(bytes) |> Base.url_encode64(padding: false)
end
