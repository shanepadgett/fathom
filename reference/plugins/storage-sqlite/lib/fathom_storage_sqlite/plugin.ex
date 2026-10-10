defmodule FathomStorageSqlite.Plugin do
  @moduledoc false
  use Fathom.Plugin,
    otp_app: :fathom_storage_sqlite,
    id: "storage-sqlite",
    requires: [Fathom.Environment],
    provides: [Fathom.Storage]

  @impl true
  def services, do: [{Fathom.Storage, FathomStorageSqlite}]
end
