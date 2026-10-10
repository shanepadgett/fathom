defmodule Fathom.Plugins.Local do
  @moduledoc """
  Local plugins: Mix projects under `~/.fathom/plugins/`, built and loaded
  while Fathom runs.

    * Builds at launch, when a plugin is created, and when someone presses
      Reload, one build at a time, in a separate OS process
      (`Fathom.Plugins.Builder`). Between builds it watches the plugins root
      and lists the plugins that changed, so an editor or agent that is still
      writing never triggers a half-written build.
    * Loads what built (`Fathom.Plugins.Loader`) and hands the plugins to the
      kernel, which starts new ones and removes deleted ones. A reload
      restarts running plugins whose manifest or application changed.
    * Code changes that need no restart replace modules in place; views
      re-render through `Fathom.UI.CodeReload`.
    * Builds plugin CSS, served at `/plugins.css`.

  A failed build leaves the previous code running.

      ~/.fathom/plugins/<name>/   plugin sources, ordinary Mix projects
      ~/.fathom/build/            workspace, compiled code, plugins.css, build.log
      ~/.fathom/mix/              MIX_HOME and HEX_HOME for the builder
      ~/.fathom/tools/            the Tailwind binary
  """
  use GenServer
  require Logger

  alias Fathom.Plugins.{Host, Loader}

  # Watcher events for a plugin just generated arrive after its build starts.
  @created_quiet 3_000
  @timeout :timer.minutes(10)
  @log_limit 200_000
  @ignored ~w(_build deps node_modules)
  @topic "fathom:plugins"

  def start_link(opts), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)

  @doc "Messages: `{:fathom_plugins, {:css, version}}` when plugin CSS changes."
  def topic, do: @topic

  @spec status() :: Fathom.KernelControl.builds()
  def status, do: GenServer.call(__MODULE__, :status)

  @doc "Builds, applies the new code, and restarts plugins whose manifest changed."
  @spec rebuild() :: :ok
  def rebuild, do: GenServer.cast(__MODULE__, :reload)

  @spec create(String.t(), String.t()) :: :ok | {:error, String.t()}
  def create(name, ui), do: GenServer.call(__MODULE__, {:create, name, ui}, :timer.minutes(2))

  @doc "The built plugin CSS, if there is any."
  @spec css_path() :: Path.t() | nil
  def css_path do
    path = :persistent_term.get({__MODULE__, :css_path}, nil)
    if path && File.regular?(path), do: path
  end

  @doc "Changes whenever plugin CSS changes; used to bust caches."
  @spec css_version() :: String.t()
  def css_version, do: :persistent_term.get({__MODULE__, :css_version}, "0")

  ## Callbacks

  @impl true
  def init(opts) do
    home = Keyword.fetch!(opts, :home)

    state = %{
      home: home,
      root: Path.join(home, "plugins"),
      build: Path.join(home, "build"),
      port: nil,
      os_pid: nil,
      output: [],
      output_size: 0,
      dirty: false,
      restart: false,
      pending: %{},
      quiet: %{},
      loaded: %{},
      libs: %{},
      status: nil
    }

    File.mkdir_p!(state.root)
    File.mkdir_p!(state.build)
    :persistent_term.put({__MODULE__, :css_path}, Path.join(state.build, "plugins.css"))
    put_css_version(state)

    status = %{
      root: state.root,
      state: :idle,
      error: nil,
      css_error: nil,
      finished_at: nil,
      log: "",
      pending: [],
      plugins: []
    }

    {:ok, %{state | status: status} |> watch(), {:continue, :build}}
  end

  @impl true
  def handle_continue(:build, state), do: {:noreply, start_build(state, false)}

  @impl true
  def handle_call(:status, _from, state), do: {:reply, state.status, state}

  def handle_call({:create, name, ui}, from, state) do
    cond do
      not (name =~ ~r/^[a-z][a-z0-9-]*$/) ->
        {:reply, {:error, "Use lowercase letters, digits, and dashes, starting with a letter"},
         state}

      ui not in ~w(settings page none) ->
        {:reply, {:error, "Unknown UI kind #{ui}"}, state}

      File.exists?(Path.join(state.root, name)) ->
        {:reply, {:error, "#{Path.join(state.root, name)} already exists"}, state}

      true ->
        request = %{
          action: :new,
          root: state.root,
          scratch: Path.join(state.build, "new"),
          name: name,
          ui: ui
        }

        Task.start(fn ->
          result = create_now(state, request)
          if result == :ok, do: GenServer.cast(__MODULE__, {:created, name})
          GenServer.reply(from, result)
        end)

        {:noreply, state}
    end
  end

  @impl true
  def handle_cast(:reload, state), do: {:noreply, start_build(state, true)}

  def handle_cast({:created, name}, state) do
    quiet = Map.put(state.quiet, name, System.monotonic_time(:millisecond) + @created_quiet)
    {:noreply, start_build(%{state | quiet: quiet}, true)}
  end

  @impl true
  def handle_info({:file_event, _watcher, {path, _events}}, state) do
    case changed_plugin(path, state) do
      nil -> {:noreply, state}
      name -> {:noreply, mark_pending(state, name)}
    end
  end

  def handle_info({:file_event, _watcher, :stop}, state) do
    Logger.warning("Stopped watching #{state.root}; press Reload after changes")
    {:noreply, state}
  end

  def handle_info({port, {:data, data}}, %{port: port} = state) do
    size = state.output_size + byte_size(data)
    output = if size > @log_limit, do: state.output, else: [state.output, data]
    {:noreply, %{state | output: output, output_size: size}}
  end

  def handle_info({port, {:exit_status, status}}, %{port: port} = state) do
    {:noreply, finish(%{state | port: nil, os_pid: nil}, status)}
  end

  def handle_info({:build_timeout, port}, %{port: port, os_pid: os_pid} = state) do
    Logger.error("Plugin build took over #{div(@timeout, 60_000)} minutes; stopping it")
    if os_pid, do: System.cmd("kill", ["-9", Integer.to_string(os_pid)])
    {:noreply, state}
  end

  def handle_info(_message, state), do: {:noreply, state}

  ## Watching

  defp watch(state) do
    case FileSystem.start_link(dirs: [state.root]) do
      {:ok, watcher} ->
        FileSystem.subscribe(watcher)

      other ->
        Logger.warning(
          "Cannot watch #{state.root} (#{inspect(other)}); press Reload after changes"
        )
    end

    state
  end

  # The plugin directory a file event belongs to, or nil for build output,
  # dependencies, hidden files, and editor backups.
  defp changed_plugin(path, state) do
    # macOS reports /tmp paths as /private/tmp.
    relative =
      Enum.find_value([state.root, "/private" <> state.root], fn root ->
        if String.starts_with?(path, root <> "/"), do: Path.relative_to(path, root)
      end)

    with relative when relative != nil <- relative,
         [name | _] = parts <- Path.split(relative),
         false <- Enum.any?(parts, &ignored?/1),
         false <- quiet?(state, name) do
      name
    else
      _ -> nil
    end
  end

  defp ignored?(part),
    do: part in @ignored or String.starts_with?(part, ".") or String.ends_with?(part, "~")

  # Monotonic time can be negative, so absence is not a zero deadline.
  defp quiet?(state, name) do
    case Map.get(state.quiet, name) do
      nil -> false
      until -> until > System.monotonic_time(:millisecond)
    end
  end

  defp mark_pending(state, name) do
    if Map.has_key?(state.pending, name) do
      state
    else
      state = put_in(state.pending[name], true)
      changed(state, state.status.state, %{pending: Enum.sort(Map.keys(state.pending))})
    end
  end

  ## Building

  # A reload asked for during a build runs after it, and restarts.
  defp start_build(%{port: port} = state, restart?) when port != nil,
    do: %{state | dirty: true, restart: state.restart or restart?}

  defp start_build(state, restart?) do
    request = %{
      action: :build,
      root: state.root,
      build: state.build,
      tools: Path.join(state.home, "tools"),
      sdk_css: Application.app_dir(:fathom_sdk, "priv/css"),
      icons: Host.icons(),
      stubs: Host.stubs(),
      pins: Host.pins(),
      # What this module loaded is rebuilt, not treated as the host's.
      host_apps: Host.apps() -- (Map.keys(state.loaded) ++ Map.keys(state.libs))
    }

    {exe, args, env} = builder(state, request, "build")

    port =
      Port.open({:spawn_executable, exe}, [
        :binary,
        :exit_status,
        :stderr_to_stdout,
        :hide,
        args: args,
        env: for({key, value} <- env, do: {~c"#{key}", if(value, do: ~c"#{value}", else: false)}),
        cd: state.build
      ])

    Process.send_after(self(), {:build_timeout, port}, @timeout)
    {:os_pid, os_pid} = Port.info(port, :os_pid)

    changed(
      %{
        state
        | port: port,
          os_pid: os_pid,
          output: [],
          output_size: 0,
          dirty: false,
          restart: restart?,
          pending: %{}
      },
      :building,
      %{pending: []}
    )
  end

  defp finish(state, exit_status) do
    log = IO.iodata_to_binary(state.output)
    File.write!(Path.join(state.build, "build.log"), log)

    result =
      case File.read(Path.join(state.build, "build.result")) do
        {:ok, binary} -> :erlang.binary_to_term(binary)
        {:error, _} -> {:error, "The plugin builder exited with status #{exit_status}"}
      end

    File.rm(Path.join(state.build, "build.result"))
    state = apply_result(state, result, log)
    if state.restart, do: Fathom.Kernel.restart_stale()
    if state.dirty, do: start_build(state, true), else: state
  end

  # Builder process: a release evaluates in itself; development runs elixir
  # with the host's code paths. Mix and Hex keep their files under Fathom's home.
  # `name` keeps a build and a plugin generation from sharing files.
  defp builder(state, request, name) do
    request_file = Path.join(state.build, "#{name}.request")
    request = Map.put(request, :result, Path.join(state.build, "#{name}.result"))
    File.write!(request_file, :erlang.term_to_binary(request))
    {exe, args} = command()

    env = [
      {"FATHOM_BUILD_REQUEST", request_file},
      {"MIX_HOME", Path.join(state.home, "mix")},
      {"HEX_HOME", Path.join([state.home, "mix", "hex"])},
      {"MIX_ENV", "prod"},
      {"MIX_EXS", nil},
      {"MIX_BUILD_PATH", nil},
      {"MIX_DEPS_PATH", nil},
      {"MIX_LOCKFILE", nil},
      {"MIX_TARGET", nil},
      {"FATHOM_PARENT_STDIN", nil},
      # A node name meant for the app would collide in the builder.
      {"ELIXIR_ERL_OPTIONS", nil},
      {"ERL_AFLAGS", nil},
      # The elixir script finds erl on PATH: use the running Erlang's.
      {"PATH", Enum.join([Path.join(:code.root_dir(), "bin"), System.get_env("PATH", "")], ":")}
    ]

    {exe, args, env}
  end

  defp command do
    case System.get_env("RELEASE_ROOT") do
      nil ->
        elixir_root = Path.expand("../..", :code.lib_dir(:elixir))
        skip = [to_string(:code.lib_dir()), elixir_root, Fathom.Environment.home()]

        paths =
          for path <- :code.get_path(),
              path = to_string(path),
              Path.type(path) == :absolute,
              not String.starts_with?(path, skip),
              not String.ends_with?(path, "/consolidated"),
              not String.contains?(path, "/archives/"),
              do: ["-pa", path]

        {Path.join([elixir_root, "bin", "elixir"]),
         ["--erl", "-noinput"] ++ List.flatten(paths) ++ ["-e", "Fathom.Plugins.Builder.main()"]}

      root ->
        {Path.join([root, "bin", System.get_env("RELEASE_NAME", "fathom")]),
         ["eval", "Fathom.Plugins.Builder.main()"]}
    end
  end

  defp create_now(state, request) do
    {exe, args, env} = builder(state, request, "create")
    result = Path.join(state.build, "create.result")
    {output, _} = System.cmd(exe, args, env: env, stderr_to_stdout: true, cd: state.build)

    case File.read(result) do
      {:ok, binary} ->
        File.rm(result)

        case :erlang.binary_to_term(binary) do
          {:ok, _dir} -> :ok
          {:error, message} -> {:error, message}
        end

      {:error, _} ->
        {:error, "Generating the plugin failed:\n" <> output}
    end
  end

  ## Applying a build

  defp apply_result(state, {:error, message}, log) do
    Logger.error("Plugin build failed: #{message}")
    changed(state, :idle, %{error: message, log: log, finished_at: DateTime.utc_now()})
  end

  defp apply_result(state, {:ok, result}, log) do
    # Libraries first: plugin modules may call them as they load.
    {libs, lib_changes, lib_errors} =
      Enum.reduce(result.libs, {state.libs, [], []}, fn {app, ebin}, {libs, changes, errors} ->
        case Loader.load(app, ebin, libs[app]) do
          {:ok, loaded, changed, removed} ->
            {Map.put(libs, app, loaded), changes ++ changed ++ removed, errors}

          {:error, message} ->
            {libs, changes, [message | errors]}
        end
      end)

    previous_by_dir = Map.new(state.loaded, fn {app, loaded} -> {loaded.dir, {app, loaded}} end)

    {loaded, entries, builds, hot?} =
      result.plugins
      |> Enum.sort_by(&elem(&1, 0))
      |> Enum.reduce({%{}, [], [], lib_changes != []}, fn {dir, outcome},
                                                          {loaded, entries, builds, hot?} ->
        previous = previous_by_dir[dir]

        case load_plugin(outcome, dir, state.loaded) do
          {:ok, app, info, changed?} ->
            structural? =
              case previous do
                {^app, %{structure: structure}} -> structure != info.structure
                _ -> false
              end

            entry = %{
              dir: dir,
              app: app,
              manifest: info.manifest,
              structural?: structural?,
              changed?: changed?
            }

            build = %{
              build_status(dir, app, info.manifest.id, nil)
              | diagnostics: warnings(outcome)
            }

            {Map.put(loaded, app, info), [entry | entries], [build | builds], hot? or changed?}

          {:error, app, failure} ->
            build = build_status(dir, app, nil, failure)

            # The previous build keeps running.
            case previous do
              {app, info} ->
                entry = %{
                  dir: dir,
                  app: app,
                  manifest: info.manifest,
                  structural?: false,
                  changed?: false
                }

                {Map.put(loaded, app, info), [entry | entries],
                 [%{build | plugin: info.manifest.id} | builds], hot?}

              nil ->
                {loaded, entries, [build | builds], hot?}
            end
        end
      end)

    %{rejected: rejected} = Fathom.Kernel.sync_local(Enum.reverse(entries))

    # Rejected plugins and plugins whose directory is gone leave the node.
    rejected_apps = Map.new(rejected)
    keep = Map.drop(loaded, Map.keys(rejected_apps))

    for {app, info} <- Map.merge(state.loaded, loaded),
        not Map.has_key?(keep, app),
        do: Loader.unload(app, info)

    builds =
      Enum.map(Enum.reverse(builds), fn build ->
        case rejected_apps[build.app] do
          nil -> build
          message -> %{build | plugin: nil, error: message}
        end
      end)

    css_error =
      case result.css do
        {:ok, _} ->
          if put_css_version(state),
            do: Fathom.Events.broadcast(@topic, {:fathom_plugins, {:css, css_version()}})

          nil

        {:error, message} ->
          message
      end

    if hot?,
      do:
        Fathom.Events.broadcast(
          Fathom.UI.CodeReload.topic(),
          {:phoenix_live_reload, "fathom", "plugins"}
        )

    error = if lib_errors != [], do: Enum.join(lib_errors, "\n")

    %{state | loaded: keep, libs: libs}
    |> changed(:idle, %{
      error: error,
      css_error: css_error,
      log: log,
      finished_at: DateTime.utc_now(),
      plugins: builds
    })
  end

  defp warnings({:ok, _app, _ebin, warnings}), do: warnings

  defp load_plugin({:error, failure}, _dir, _loaded), do: {:error, failure.app, failure}

  defp load_plugin({:ok, app, ebin, _warnings}, dir, loaded) do
    with {:ok, info, changed, removed} <- Loader.load(app, ebin, loaded[app]),
         {:ok, manifest, structure} <- describe(app, info.spec) do
      {:ok, app, Map.merge(info, %{dir: dir, manifest: manifest, structure: structure}),
       changed != [] or removed != []}
    else
      {:error, message} -> {:error, app, %{app: app, message: message, diagnostics: []}}
    end
  end

  # What a running plugin cannot take in place: its manifest, services,
  # contributions, application spec, or application module.
  defp describe(app, spec) do
    module = spec[:env][:fathom_plugin]

    cond do
      module == nil ->
        {:error,
         "mix.exs names no plugin; add env: [fathom_plugin: MyPlugin.Plugin] to application/0"}

      not function_exported?(module, :__fathom_plugin__, 0) ->
        {:error, "#{inspect(module)} does not `use Fathom.Plugin`"}

      true ->
        manifest = Fathom.Plugin.manifest(module)

        if manifest.otp_app != app do
          {:error,
           "#{inspect(module)} says otp_app: #{inspect(manifest.otp_app)}, but the app is #{inspect(app)}"}
        else
          app_module = with {mod, _} <- spec[:mod], do: mod.module_info(:md5)
          spec = Keyword.drop(spec, [:modules, :vsn])

          structure =
            :erlang.phash2(
              {manifest, module.services(), module.contributions(), spec, app_module}
            )

          {:ok, manifest, structure}
        end
    end
  rescue
    error -> {:error, "Reading the plugin manifest failed: " <> Exception.message(error)}
  end

  defp build_status(dir, app, plugin, failure) do
    %{
      dir: dir,
      name: Path.basename(dir),
      app: app,
      plugin: plugin,
      error: failure && failure.message,
      diagnostics: (failure && failure.diagnostics) || []
    }
  end

  ## Status

  defp changed(state, building, fields) do
    state = %{state | status: Map.merge(state.status, Map.put(fields, :state, building))}
    Fathom.Events.broadcast(Fathom.KernelControl.topic(), {:fathom_kernel, :changed})
    state
  end

  # Returns true when the CSS changed.
  defp put_css_version(state) do
    version =
      case File.read(Path.join(state.build, "plugins.css")) do
        {:ok, css} ->
          :crypto.hash(:md5, css) |> Base.url_encode64(padding: false) |> binary_part(0, 10)

        {:error, _} ->
          "0"
      end

    changed? = version != css_version()
    :persistent_term.put({__MODULE__, :css_version}, version)
    changed?
  end
end
