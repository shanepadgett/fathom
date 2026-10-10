defmodule FathomStorageSqlite.Repo do
  use Ecto.Repo, otp_app: :fathom_storage_sqlite, adapter: Ecto.Adapters.SQLite3
end
