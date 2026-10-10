import Config

# Only for running Ecto generators in this project. As a dependency of the
# host, the repo is configured at start from the Fathom home.
config :fathom_storage_sqlite, ecto_repos: [FathomStorageSqlite.Repo]
config :fathom_storage_sqlite, FathomStorageSqlite.Repo, database: "dev.db"
