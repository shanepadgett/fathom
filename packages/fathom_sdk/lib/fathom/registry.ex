defmodule Fathom.Registry do
  @moduledoc """
  One owner, many contributors.

      defmodule MyPlugin.Widgets do
        use Fathom.Registry
      end

  The owner lists the token in `:provides`. Contributors list it in
  `:requires` and return `[{MyPlugin.Widgets, "key", value}]` from
  `contributions/0`. Entries live in a duplicate-key `Registry` under the
  contributor's publisher process, so they disappear when it stops. Values
  are maps; `:order` sorts entries, lowest first.
  """

  @registry Fathom.Contributions

  defmodule Entry do
    @moduledoc "A registry entry. `owner` is the publisher process that holds it."
    @enforce_keys [:registry, :key, :plugin, :value, :owner]
    defstruct [:registry, :key, :plugin, :value, :owner, order: 100]

    @type t :: %__MODULE__{
            registry: module(),
            key: String.t(),
            plugin: String.t(),
            value: map(),
            owner: pid(),
            order: integer()
          }
  end

  defmacro __using__(_opts) do
    quote do
      @doc false
      def __fathom_token__, do: :registry

      @doc "Entries in order."
      def entries, do: Fathom.Registry.entries(__MODULE__)

      @doc "The entry under `key`, or nil."
      def get(key), do: Fathom.Registry.get(__MODULE__, key)

      @doc "Receive `{:fathom_registry, #{inspect(__MODULE__)}}` when entries change."
      def subscribe, do: Fathom.Registry.subscribe(__MODULE__)
    end
  end

  @doc false
  def registry, do: @registry

  @spec entries(module()) :: [Entry.t()]
  def entries(registry) do
    @registry
    |> Registry.lookup(registry)
    |> Enum.map(&elem(&1, 1))
    |> Enum.sort_by(&{&1.order, &1.key})
  rescue
    ArgumentError -> []
  end

  @spec get(module(), String.t()) :: Entry.t() | nil
  def get(registry, key), do: Enum.find(entries(registry), &(&1.key == key))

  @spec subscribe(module()) :: :ok | {:error, term()}
  def subscribe(registry), do: Fathom.Events.subscribe(topic(registry))

  @doc false
  def notify(registry), do: Fathom.Events.broadcast(topic(registry), {:fathom_registry, registry})

  @doc false
  def topic(registry), do: "fathom:registry:" <> Atom.to_string(registry)
end
