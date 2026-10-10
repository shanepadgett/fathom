defmodule FathomCredentialsLocal.LoginState do
  @moduledoc "Public login status. Never holds tokens or keys."
  @enforce_keys [:id, :provider, :method, :state, :message]
  defstruct [:id, :provider, :method, :state, :message, :url, :code, :prompt]

  @type t :: %__MODULE__{
          id: String.t(),
          provider: String.t(),
          method: String.t(),
          state: :working | :waiting | :connected | :failed | :cancelled,
          message: String.t(),
          url: String.t() | nil,
          code: String.t() | nil,
          prompt: String.t() | nil
        }

  def active?(%__MODULE__{state: state}), do: state in [:working, :waiting]
end
