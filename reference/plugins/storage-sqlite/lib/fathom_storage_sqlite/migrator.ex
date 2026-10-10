defmodule FathomStorageSqlite.Migrator do
  @moduledoc "Brings the database up to date before storage is published."

  def child_spec(_),
    do: %{id: __MODULE__, start: {__MODULE__, :start_link, []}, restart: :transient}

  def start_link do
    path = Application.app_dir(:fathom_storage_sqlite, "priv/repo/migrations")
    Ecto.Migrator.run(FathomStorageSqlite.Repo, path, :up, all: true, log: false)
    :ignore
  end
end
