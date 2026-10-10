defmodule FathomStorageSqlite.Application do
  # See https://elixir.hexdocs.pm/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    database = Path.join(Fathom.Environment.home(), "fathom.db")
    File.mkdir_p!(Path.dirname(database))

    children = [
      # SQLite has one writer; one connection avoids lock races on a new database.
      {FathomStorageSqlite.Repo, database: database, journal_mode: :wal, pool_size: 1},
      FathomStorageSqlite.Migrator,
      # Publish services and contributions last, once the rest is running.
      {Fathom.Plugin.Publisher, FathomStorageSqlite.Plugin}
    ]

    opts = [strategy: :one_for_one, name: FathomStorageSqlite.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
