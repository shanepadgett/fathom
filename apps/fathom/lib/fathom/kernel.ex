defmodule Fathom.Kernel do
  @moduledoc """
  Plugin lifecycle. One process serializes every change.

  The kernel orchestrates; the parts beside it decide and act:

    * `Fathom.Kernel.Catalog` finds plugin manifests.
    * `Fathom.Kernel.Graph` decides what stops and what starts, as pure functions.
    * `Fathom.Kernel.Runner` starts and stops a plugin's application.
    * `Fathom.Kernel.Desired` saves what the user chose.

  Plugins start once every required token is available and stop, dependents
  first, when one is withdrawn or the user disables them. A plugin whose
  supervision tree gives up is marked failed and stays failed until it is
  enabled or restarted. Services and contributions are not kept here: each
  plugin's `Fathom.Plugin.Publisher` holds them in the harness registries.

  Bundled plugins come from the catalog at boot. Local plugins arrive from
  `Fathom.Plugins.Local` after each build through `sync_local/1`. A running
  local plugin whose manifest or application changed is marked stale and
  picks up the change the next time it stops.
  """
  use GenServer
  require Logger

  alias Fathom.Kernel.{Catalog, Config, Desired, Graph, Runner}

  defmodule Plugin do
    @moduledoc false
    defstruct [
      :manifest,
      :enabled,
      :config,
      :ref,
      :last_error,
      :dir,
      source: :bundled,
      stale: false,
      state: :stopped,
      gen: 0,
      waiting_on: []
    ]
  end

  def start_link(opts), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)

  @doc "Statuses of every known plugin, ordered by id."
  def plugins, do: GenServer.call(__MODULE__, :plugins)

  @doc "Applies a change and waits until the plugin graph settles."
  def change(id, action), do: GenServer.call(__MODULE__, {:change, id, action}, :infinity)

  @doc "Restarts every stale plugin, and its dependents, in one pass."
  def restart_stale, do: GenServer.call(__MODULE__, :restart_stale, :infinity)

  @doc """
  Replaces the set of local plugins with `entries`, one per built plugin:
  `%{dir, app, manifest, structural?, changed?}`. New plugins are added,
  missing ones stop and go, and running ones whose structure changed become
  stale. A failed plugin whose code changed gets another try. Returns the
  apps rejected, with the reason.
  """
  def sync_local(entries), do: GenServer.call(__MODULE__, {:sync_local, entries}, :infinity)

  ## Callbacks

  @impl true
  def init(opts) do
    Process.flag(:trap_exit, true)
    home = Keyword.fetch!(opts, :home)
    desired = Desired.read(home)

    plugins =
      Map.new(Catalog.manifests(Keyword.fetch!(opts, :apps)), fn manifest ->
        saved = Map.get(desired, manifest.id, %{})

        {manifest.id,
         %Plugin{
           manifest: manifest,
           enabled: Map.get(saved, "enabled", manifest.enabled),
           config: Map.get(saved, "config", %{})
         }}
      end)

    harness = Fathom.Plugin.manifest(Fathom.Host.Plugin)
    state = %{home: home, saved: desired, provided: harness.provides, plugins: plugins}
    {:ok, state, {:continue, :settle}}
  end

  @impl true
  def handle_continue(:settle, state), do: {:noreply, settle(state)}

  @impl true
  def handle_call(:plugins, _from, state), do: {:reply, statuses(state), state}

  def handle_call({:change, id, action}, _from, state) do
    if Map.has_key?(state.plugins, id),
      do: change(state, id, action),
      else: {:reply, {:error, "Unknown plugin #{id}"}, state}
  end

  def handle_call(:restart_stale, _from, state) do
    stale = for {id, %Plugin{stale: true}} <- state.plugins, do: id
    state = state |> stop_all(stale) |> settle() |> save()

    case for(id <- stale, state.plugins[id].state == :failed, do: id) do
      [] -> {:reply, :ok, state}
      failed -> {:reply, {:error, "Failed after restart: #{Enum.join(failed, ", ")}"}, state}
    end
  end

  def handle_call({:sync_local, entries}, _from, state) do
    {accepted, rejected} = Enum.split_with(entries, &local_id?(state, &1))

    rejected =
      for e <- rejected,
          do: {e.app, "The plugin id #{e.manifest.id} is taken by a bundled plugin"}

    {accepted, duplicates} =
      accepted |> Enum.group_by(& &1.manifest.id) |> Enum.split_with(&match?({_, [_]}, &1))

    rejected =
      rejected ++
        for {id, group} <- duplicates,
            e <- group,
            do: {e.app, "Several local plugins use the id #{id}"}

    incoming = Map.new(accepted, fn {id, [entry]} -> {id, entry} end)

    gone =
      for {id, %Plugin{source: :local}} <- state.plugins, not Map.has_key?(incoming, id), do: id

    state = stop_all(state, gone)
    state = %{state | plugins: Map.drop(state.plugins, gone)}

    state =
      incoming
      |> Enum.sort()
      |> Enum.reduce(state, fn {id, entry}, s -> put_local(s, id, entry) end)

    {:reply, %{rejected: rejected}, state |> settle() |> save()}
  end

  @impl true
  def handle_info({:DOWN, ref, :process, _pid, reason}, state) do
    case Enum.find(state.plugins, fn {_, plugin} -> plugin.ref == ref end) do
      {id, plugin} ->
        Logger.error("Plugin #{id} stopped: #{inspect(reason)}")
        state = Enum.reduce(Graph.dependents(state.plugins, id), state, &stop(&2, &1))
        notify(plugin.manifest)

        failed = %{
          plugin
          | ref: nil,
            state: :failed,
            last_error: "Stopped: #{Runner.describe(reason)}"
        }

        {:noreply, settle(put_in(state.plugins[id], failed))}

      nil ->
        {:noreply, state}
    end
  end

  def handle_info({:EXIT, _pid, _reason}, state), do: {:noreply, state}

  @impl true
  def terminate(_reason, state) do
    Enum.reduce(Map.keys(state.plugins), state, &stop(&2, &1))
    :ok
  end

  ## Changes

  defp change(state, id, :enable),
    do: state |> update(id, &clear_failure(%{&1 | enabled: true})) |> finish(id)

  defp change(state, id, :disable),
    do: state |> update(id, &%{&1 | enabled: false}) |> finish(id)

  defp change(state, id, :restart) do
    state
    |> stop(id)
    |> update(id, &(&1 |> clear_failure() |> refresh()))
    |> finish(id)
  end

  defp change(state, id, {:configure, values}) do
    plugin = state.plugins[id]

    case Config.cast(plugin.manifest.config, values) do
      {:ok, cast} ->
        # Save typed values, not the strings a form submitted.
        config = Map.new(cast, fn {key, value} -> {Atom.to_string(key), value} end)
        previous = plugin.config

        state =
          state |> stop(id) |> update(id, &clear_failure(%{&1 | config: config})) |> settle()

        case state.plugins[id] do
          %{state: :failed, last_error: error} ->
            # Roll back to the configuration that worked.
            state = state |> update(id, &clear_failure(%{&1 | config: previous})) |> settle()
            {:reply, {:error, "Configuration rejected: #{error}"}, save(state)}

          _ ->
            {:reply, :ok, save(state)}
        end

      {:error, message} ->
        {:reply, {:error, message}, state}
    end
  end

  defp change(state, _id, action),
    do: {:reply, {:error, "Unknown action #{inspect(action)}"}, state}

  defp finish(state, id) do
    state = state |> settle() |> save()

    case state.plugins[id] do
      %{state: :failed, last_error: error} -> {:reply, {:error, error}, state}
      _ -> {:reply, :ok, state}
    end
  end

  defp clear_failure(%Plugin{state: :failed} = plugin),
    do: %{plugin | state: :stopped, last_error: nil}

  defp clear_failure(plugin), do: plugin

  defp update(state, id, fun), do: update_in(state.plugins[id], fun)

  # Choices for plugins not present now, such as a local plugin that failed
  # to build, are kept for when they come back.
  defp save(state) do
    current =
      Map.new(state.plugins, fn {id, p} ->
        {id, %{"enabled" => p.enabled, "config" => p.config}}
      end)

    saved = Map.merge(state.saved, current)
    Desired.write(state.home, saved)
    %{state | saved: saved}
  end

  ## Local plugins

  defp local_id?(state, entry) do
    case state.plugins[entry.manifest.id] do
      %Plugin{source: :bundled} -> false
      _ -> true
    end
  end

  defp put_local(state, id, entry) do
    case state.plugins[id] do
      nil ->
        saved = Map.get(state.saved, id, %{})

        plugin = %Plugin{
          manifest: entry.manifest,
          source: :local,
          dir: entry.dir,
          enabled: Map.get(saved, "enabled", entry.manifest.enabled),
          config: Map.get(saved, "config", %{})
        }

        put_in(state.plugins[id], refresh(plugin))

      %Plugin{state: :ready} when entry.structural? ->
        update(state, id, &%{&1 | stale: true, dir: entry.dir})

      %Plugin{state: :ready} ->
        update(state, id, &%{&1 | dir: entry.dir})

      %Plugin{} = plugin ->
        retry? = plugin.state == :failed and (entry.changed? or entry.structural?)
        plugin = if retry?, do: clear_failure(plugin), else: plugin
        plugin = if entry.structural?, do: refresh(plugin), else: plugin
        put_in(state.plugins[id], %{plugin | dir: entry.dir})
    end
  end

  # Reads the manifest, and for a local plugin its application spec, again.
  # Only for a stopped plugin.
  defp refresh(plugin) do
    case Catalog.refresh(plugin.manifest, plugin.source) do
      {:ok, manifest} ->
        %{plugin | manifest: manifest, stale: false}

      {:error, message} ->
        %{plugin | stale: false, state: :failed, last_error: message}
    end
  end

  ## Settling

  # Stop what must stop, then start one plugin at a time until nothing
  # changes. Each start can provide tokens that unblock the next.
  defp settle(state) do
    state = Enum.reduce(Graph.to_stop(state.plugins, state.provided), state, &stop(&2, &1))

    case Graph.next_start(state.plugins, state.provided) do
      nil ->
        state = %{state | plugins: Graph.mark_waiting(state.plugins, state.provided)}
        Fathom.Events.broadcast(Fathom.KernelControl.topic(), {:fathom_kernel, :changed})
        state

      id ->
        state |> start(id) |> settle()
    end
  end

  defp start(state, id) do
    plugin = state.plugins[id]
    gen = plugin.gen + 1

    result =
      with {:ok, config} <- Config.cast(plugin.manifest.config, plugin.config),
           do: Runner.start(plugin.manifest, config)

    case result do
      {:ok, ref} ->
        Logger.info("Plugin #{id} started (generation #{gen})")

        update(
          state,
          id,
          &%{&1 | ref: ref, state: :ready, gen: gen, waiting_on: [], last_error: nil}
        )

      {:error, message} ->
        Logger.error("Plugin #{id} failed to start: #{message}")
        update(state, id, &%{&1 | state: :failed, gen: gen, last_error: message})
    end
  end

  # Dependents stop first so nothing calls into a plugin while it shuts down.
  defp stop(state, id) do
    case state.plugins[id] do
      %Plugin{state: :ready} = plugin ->
        state = Enum.reduce(Graph.dependents(state.plugins, id), state, &stop(&2, &1))
        Runner.stop(plugin.manifest, plugin.ref)
        notify(plugin.manifest)
        Logger.info("Plugin #{id} stopped")
        stopped = %{plugin | ref: nil, state: :stopped}
        # A stale plugin takes its new manifest while it is down.
        put_in(state.plugins[id], if(plugin.stale, do: refresh(stopped), else: stopped))

      _ ->
        state
    end
  end

  defp stop_all(state, ids), do: Enum.reduce(ids, state, &stop(&2, &1))

  # The publisher's registrations vanish with it; tell views to look again.
  defp notify(manifest),
    do: Enum.each(manifest.requires ++ manifest.provides, &Fathom.Registry.notify/1)

  ## Status

  defp statuses(state) do
    state.plugins
    |> Enum.sort_by(&elem(&1, 0))
    |> Enum.map(fn {id, p} ->
      %{
        id: id,
        app: p.manifest.otp_app,
        source: p.source,
        dir: p.dir,
        enabled: p.enabled,
        stale: p.stale,
        config: p.config,
        config_schema: p.manifest.config,
        state: p.state,
        gen: p.gen,
        waiting_on: p.waiting_on,
        last_error: p.last_error,
        requires: p.manifest.requires,
        provides: p.manifest.provides
      }
    end)
  end
end
