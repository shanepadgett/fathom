defmodule FathomCredentials.LoginUI do
  @moduledoc "What a running login flow uses to talk to the person signing in."
  @enforce_keys [:server, :id]
  defstruct [:server, :id]

  @type t :: %__MODULE__{server: pid(), id: String.t()}

  @doc "Show status: `:message`, and optionally `:url` and `:code`. Public data only."
  @spec notify(t(), keyword() | map()) :: :ok
  def notify(%__MODULE__{} = ui, attrs),
    do: GenServer.cast(ui.server, {:notify, ui.id, Map.new(attrs)})

  @doc "Ask for a secret reply. Blocks until the person replies or the login ends."
  @spec prompt(t(), String.t()) :: {:ok, String.t()} | {:error, :cancelled}
  def prompt(%__MODULE__{} = ui, message),
    do: GenServer.call(ui.server, {:prompt, ui.id, message}, :infinity)
end
