defmodule Fathom.Environment do
  @moduledoc "The host machine, as the harness sees it. Always available."
  use Fathom.Service

  @doc "The Fathom home directory, such as `~/.fathom`."
  @callback home() :: Path.t()

  @doc "Open an http(s) URL in the system browser, never in the app window."
  @callback open_external(url :: String.t()) :: :ok | {:error, term()}

  def home, do: Fathom.Service.call(__MODULE__, :home, [])
  def open_external(url), do: Fathom.Service.call(__MODULE__, :open_external, [url])
end
