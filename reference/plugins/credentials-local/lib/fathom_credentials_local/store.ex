defmodule FathomCredentialsLocal.Store do
  @moduledoc """
  Owns `auth.json` in the Fathom home. Writes are serialized through this
  process and atomic: a private temp file, synced, then renamed. The home is
  0700 and the file 0600. Tokens never leave the credentials plugin's
  processes except through `FathomCredentials.get/1`.
  """
  use GenServer
  alias FathomCredentials.Credential

  def start_link(_), do: GenServer.start_link(__MODULE__, nil, name: __MODULE__)

  @spec get(String.t()) :: Credential.t() | nil
  def get(provider), do: GenServer.call(__MODULE__, {:get, provider})

  @spec put(String.t(), Credential.t() | nil) :: :ok | {:error, String.t()}
  def put(provider, credential), do: GenServer.call(__MODULE__, {:put, provider, credential})

  @impl true
  def init(nil) do
    home = Fathom.Environment.home()
    File.mkdir_p!(home)
    File.chmod!(home, 0o700)

    case read(path(home)) do
      {:ok, data} -> {:ok, %{home: home, data: data}}
      {:error, message} -> {:stop, message}
    end
  end

  @impl true
  def handle_call({:get, provider}, _from, state), do: {:reply, state.data[provider], state}

  def handle_call({:put, provider, credential}, _from, state) do
    data =
      if credential,
        do: Map.put(state.data, provider, credential),
        else: Map.delete(state.data, provider)

    case write(state.home, data) do
      :ok -> {:reply, :ok, %{state | data: data}}
      {:error, reason} -> {:reply, {:error, "Cannot save credentials: #{inspect(reason)}"}, state}
    end
  end

  defp read(path) do
    with {:ok, text} <- File.read(path),
         {:ok, %{} = json} <- Jason.decode(text),
         {:ok, data} <- decode_all(json) do
      File.chmod!(path, 0o600)
      {:ok, data}
    else
      {:error, :enoent} -> {:ok, %{}}
      _ -> {:error, "Cannot read auth.json; the existing file was left intact"}
    end
  end

  defp decode_all(json) do
    Enum.reduce_while(json, {:ok, %{}}, fn {provider, value}, {:ok, acc} ->
      case Credential.from_json(value) do
        {:ok, credential} -> {:cont, {:ok, Map.put(acc, provider, credential)}}
        :error -> {:halt, :error}
      end
    end)
  end

  defp write(home, data) do
    temp = Path.join(home, ".auth-#{System.unique_integer([:positive])}")

    text =
      Jason.encode_to_iodata!(Map.new(data, fn {k, v} -> {k, Credential.to_json(v)} end),
        pretty: true
      )

    try do
      File.touch!(temp)
      File.chmod!(temp, 0o600)

      File.open!(temp, [:write, :binary], fn file ->
        IO.binwrite(file, [text, "\n"])
        :file.datasync(file)
      end)

      File.rename(temp, path(home))
    after
      File.rm(temp)
    end
  end

  defp path(home), do: Path.join(home, "auth.json")
end
