defmodule FathomStorageSqlite.Repo.Migrations.CreatePluginValues do
  use Ecto.Migration

  # Same table the Deno version created, so existing fathom.db files keep
  # their values: a composite primary key and no timestamps.
  def change do
    create_if_not_exists table(:plugin_values, primary_key: false) do
      add(:namespace, :text, null: false, primary_key: true)
      add(:key, :text, null: false, primary_key: true)
      add(:value, :text, null: false)
    end
  end
end
