defmodule FathomStorageSqlite do
  @moduledoc """
  The storage context. Implements `Fathom.Storage`: small JSON values per
  plugin namespace in SQLite under the Fathom home.
  """
  @behaviour Fathom.Storage

  import Ecto.Query
  alias FathomStorageSqlite.{Repo, Value}

  @impl true
  def get(namespace, key) do
    Value
    |> where(namespace: ^namespace, key: ^key)
    |> select([v], v.value)
    |> Repo.one()
    |> case do
      nil -> nil
      text -> Jason.decode!(text)
    end
  end

  @impl true
  def put(namespace, key, value) do
    %Value{}
    |> Value.changeset(%{namespace: namespace, key: key, value: Jason.encode!(value)})
    |> Repo.insert(
      on_conflict: {:replace, [:value]},
      conflict_target: [:namespace, :key]
    )
    |> case do
      {:ok, _} ->
        :ok

      {:error, changeset} ->
        raise ArgumentError, "cannot store #{key}: #{inspect(changeset.errors)}"
    end
  end

  @impl true
  def delete(namespace, key) do
    Value |> where(namespace: ^namespace, key: ^key) |> Repo.delete_all()
    :ok
  end
end
