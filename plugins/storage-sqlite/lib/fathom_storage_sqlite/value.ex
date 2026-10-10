defmodule FathomStorageSqlite.Value do
  @moduledoc "One JSON value under a plugin namespace and key."
  use Ecto.Schema
  import Ecto.Changeset

  @max_length 1_000_000

  @primary_key false
  schema "plugin_values" do
    field(:namespace, :string, primary_key: true)
    field(:key, :string, primary_key: true)
    field(:value, :string)
  end

  @doc false
  def changeset(value, attrs) do
    value
    |> cast(attrs, [:namespace, :key, :value])
    |> validate_required([:namespace, :key, :value])
    |> validate_length(:value, max: @max_length, count: :bytes)
  end
end
