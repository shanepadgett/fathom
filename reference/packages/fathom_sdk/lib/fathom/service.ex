defmodule Fathom.Service do
  @moduledoc """
  One provider, many consumers.

  A service token is a contract module: a behaviour plus client functions that
  dispatch to whichever plugin currently provides it.

      defmodule Fathom.Storage do
        use Fathom.Service

        @callback get(namespace :: String.t(), key :: String.t()) :: term()
        def get(namespace, key), do: Fathom.Service.call(__MODULE__, :get, [namespace, key])
      end

  Clients go through `call/3` so they never assume where the provider runs;
  a provider on a peer node can serve the same contract. For the same reason,
  arguments and results are plain data: no anonymous functions. Stream to a
  pid with messages instead of passing a callback.

  The provider lists the token in `:provides` and returns
  `[{Fathom.Storage, MyStorage}]` from `services/0`. Its publisher registers
  the pair in a unique `Registry`, so a token has at most one provider and
  the registration ends with the provider.
  """

  @registry Fathom.Services

  defmodule UnavailableError do
    defexception [:token]

    @impl true
    def message(%{token: token}), do: "#{inspect(token)} is not provided by any running plugin"
  end

  defmacro __using__(_opts) do
    quote do
      @doc false
      def __fathom_token__, do: :service

      @doc false
      def impl!, do: Fathom.Service.impl!(__MODULE__)

      @doc "Whether a running plugin provides this service."
      def available?, do: Fathom.Service.available?(__MODULE__)
    end
  end

  @doc false
  def registry, do: @registry

  @doc "The implementation module currently providing `token`."
  @spec impl(module()) :: {:ok, module()} | :error
  def impl(token) do
    case Registry.lookup(@registry, token) do
      [{_pid, impl}] -> {:ok, impl}
      [] -> :error
    end
  rescue
    ArgumentError -> :error
  end

  @spec impl!(module()) :: module()
  def impl!(token) do
    case impl(token) do
      {:ok, impl} -> impl
      :error -> raise UnavailableError, token: token
    end
  end

  @spec available?(module()) :: boolean()
  def available?(token), do: impl(token) != :error

  @doc "Calls `fun` with `args` on the provider of `token`."
  @spec call(module(), atom(), list()) :: term()
  def call(token, fun, args), do: apply(impl!(token), fun, args)
end
