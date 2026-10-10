defmodule Fathom.Plugins.Builder do
  @moduledoc """
  Builds local plugins in its own OS process. `Fathom.Plugins.Local` starts
  it with `bin/fathom eval` in a release and with `elixir` in development,
  so Mix's global state, Hex, and compile crashes stay out of the running
  app. The request and the result are Erlang terms in files.

  A build writes one Mix workspace: every local plugin as a path dependency,
  the Hex packages the host ships pinned to the shipped versions, and
  stand-ins for Fathom's own applications, which are not on Hex. Hex
  resolves all plugins together, so a conflict with the host fails here with
  Hex's explanation. Only what the host does not ship is compiled.

  A plugin that fails to load, resolve, or compile is reported with the
  reason and left out; the others still build.
  """
  alias __MODULE__.Shell

  @typedoc "Why one plugin did not build."
  @type failure :: %{app: atom() | nil, message: String.t(), diagnostics: [map()]}

  @type result ::
          {:ok,
           %{
             plugins: %{Path.t() => {:ok, atom(), Path.t(), [map()]} | {:error, failure()}},
             libs: %{atom() => Path.t()},
             css: {:ok, Path.t()} | {:error, String.t()}
           }}
          | {:ok, Path.t()}
          | {:error, String.t()}

  @compile_args ~w(--from-mix-deps-compile --no-warnings-as-errors --no-code-path-pruning --return-errors)

  @doc false
  def main do
    request =
      System.fetch_env!("FATHOM_BUILD_REQUEST") |> File.read!() |> :erlang.binary_to_term()

    result =
      try do
        run(request)
      rescue
        error in Mix.Error -> {:error, Exception.message(error)}
        error -> {:error, Exception.format(:error, error, __STACKTRACE__)}
      catch
        kind, reason -> {:error, Exception.format(kind, reason, __STACKTRACE__)}
      end

    File.write!(request.result, :erlang.term_to_binary(result))
    System.halt(0)
  end

  @spec run(map()) :: result()
  def run(%{action: :new} = request) do
    start_mix()
    target = Path.join(request.root, request.name)
    scratch = Path.join(request.scratch, request.name)
    File.rm_rf!(scratch)

    if File.exists?(target), do: Mix.raise("#{target} already exists")

    # Generated aside and moved in whole, so the watcher sees one change.
    Mix.Tasks.Fathom.Gen.Plugin.run([request.name, "--into", request.scratch, "--ui", request.ui])
    File.mkdir_p!(request.root)
    File.rename!(scratch, target)
    {:ok, target}
  end

  def run(%{action: :build} = request) do
    start_mix()
    write_stubs(request)

    {projects, failed} = request.root |> plugin_dirs() |> read_projects(request)
    {projects, failed, hex?} = install_hex(projects, failed, request)
    {projects, failed} = resolve(projects, failed, hex?, request)
    {built, libs, failed} = compile(projects, failed, request)

    plugins =
      Map.merge(
        Map.new(built, fn {dir, app, ebin, warnings} -> {dir, {:ok, app, ebin, warnings}} end),
        Map.new(failed, fn {dir, failure} -> {dir, {:error, failure}} end)
      )

    {:ok, %{plugins: plugins, libs: libs, css: css(built, request)}}
  end

  ## Setup

  defp start_mix do
    unconsolidate()
    # Every workspace defines the same project module; that is expected.
    Code.put_compiler_option(:ignore_module_conflict, true)
    Mix.start()
    Mix.env(:prod)
    Shell.start()
    Mix.shell(Shell)
  end

  # A release loads consolidated protocols, which hide implementations
  # defined later, Hex's among them. The builder dispatches the slow way.
  defp unconsolidate do
    for path <- :code.get_path(), List.ends_with?(path, ~c"/consolidated") do
      for file <- File.ls!(path), String.ends_with?(file, ".beam") do
        module = file |> Path.rootname() |> String.to_atom()
        :code.purge(module)
        :code.delete(module)
      end

      :code.del_path(path)
    end
  end

  defp write_stubs(request) do
    for {app, vsn} <- request.stubs do
      dir = stub_dir(request, app)
      File.mkdir_p!(dir)

      File.write!(Path.join(dir, "mix.exs"), """
      defmodule FathomStub.#{Macro.camelize(Atom.to_string(app))}.MixProject do
        use Mix.Project
        def project, do: [app: #{inspect(app)}, version: #{inspect(vsn)}]
      end
      """)
    end
  end

  defp stub_dir(request, app), do: Path.join([request.build, "stubs", Atom.to_string(app)])

  ## Projects

  defp plugin_dirs(root) do
    case File.ls(root) do
      {:ok, names} ->
        for name <- Enum.sort(names),
            not String.starts_with?(name, [".", "_"]),
            dir = Path.join(root, name),
            File.regular?(Path.join(dir, "mix.exs")),
            do: dir

      {:error, _} ->
        []
    end
  end

  defp read_projects(dirs, request) do
    {projects, failed} =
      Enum.reduce(dirs, {[], %{}}, fn dir, {projects, failed} ->
        case read_project(dir) do
          {:ok, project} -> {[project | projects], failed}
          {:error, message} -> {projects, Map.put(failed, dir, failure(nil, message))}
        end
      end)

    host = MapSet.new(request.host_apps)
    counts = Enum.frequencies_by(projects, & &1.app)

    Enum.reduce(Enum.reverse(projects), {[], failed}, fn project, {ok, failed} ->
      cond do
        MapSet.member?(host, project.app) ->
          message =
            "The app name #{inspect(project.app)} is already used by Fathom; rename it in mix.exs"

          {ok, Map.put(failed, project.dir, failure(project.app, message))}

        counts[project.app] > 1 ->
          message = "Another local plugin uses the app name #{inspect(project.app)}"
          {ok, Map.put(failed, project.dir, failure(project.app, message))}

        true ->
          {ok ++ [project], failed}
      end
    end)
  end

  defp read_project(dir) do
    # Mix caches a project by the name given here, so each directory gets its own.
    name = :"fathom_local_#{:erlang.phash2(dir)}"
    config = Mix.Project.in_project(name, dir, fn _ -> Mix.Project.config() end)

    case config[:app] do
      app when is_atom(app) and app != nil ->
        deps = for dep <- config[:deps] || [], do: elem(dep, 0)
        {:ok, %{dir: dir, app: app, deps: deps}}

      _ ->
        {:error, "mix.exs sets no :app in project/0"}
    end
  rescue
    error -> {:error, "mix.exs failed to load: " <> Exception.message(error)}
  end

  # Hex is needed only when a plugin names a dependency Fathom does not stand in for.
  defp needs_hex?(project, request) do
    stubs = Enum.map(request.stubs, &elem(&1, 0))
    Enum.any?(project.deps, &(&1 not in stubs))
  end

  defp install_hex(projects, failed, request) do
    {hex, plain} = Enum.split_with(projects, &needs_hex?(&1, request))

    if hex == [] do
      {projects, failed, false}
    else
      try do
        Mix.Tasks.Local.Hex.run(["--force", "--if-missing"])
        Mix.Tasks.Local.Rebar.run(["--force", "--if-missing"])
        Mix.Local.append_archives()
        {projects, failed, true}
      rescue
        error ->
          message =
            "Installing Hex failed, so Hex dependencies cannot be fetched: " <>
              Exception.message(error)

          {plain, fail_all(failed, hex, message), false}
      end
    end
  end

  ## Resolution

  defp resolve([], failed, _hex?, _request), do: {[], failed}

  defp resolve(projects, failed, hex?, request) do
    case deps_get(workspace(request), projects, hex?, request) do
      :ok ->
        {projects, failed}

      {:error, _} ->
        # Find the plugins that fail on their own, leave them out, and retry.
        {good, failed} =
          Enum.reduce(projects, {[], failed}, fn project, {good, failed} ->
            dir = Path.join([request.build, "probe", Atom.to_string(project.app)])

            case deps_get(dir, [project], needs_hex?(project, request), request) do
              :ok ->
                {good ++ [project], failed}

              {:error, message} ->
                {good, Map.put(failed, project.dir, failure(project.app, message))}
            end
          end)

        case good != [] and deps_get(workspace(request), good, hex?, request) do
          false ->
            {[], failed}

          :ok ->
            {good, failed}

          {:error, message} ->
            {[], fail_all(failed, good, "These plugins conflict with each other:\n" <> message)}
        end
    end
  end

  defp deps_get(dir, projects, hex?, request) do
    write_workspace(dir, projects, hex?, request)
    Shell.take()
    Mix.Task.clear()
    in_workspace(dir, fn -> Mix.Task.run("deps.get", []) end)
    :ok
  rescue
    error -> {:error, explain(Shell.take(), error)}
  end

  defp workspace(request), do: Path.join(request.build, "workspace")

  defp write_workspace(dir, projects, hex?, request) do
    pins = if hex?, do: request.pins, else: []

    deps =
      Enum.map(projects, &{&1.app, path: &1.dir}) ++
        Enum.map(request.stubs, fn {app, _} ->
          {app, path: stub_dir(request, app), override: true, compile: false, app: false}
        end) ++
        Enum.map(pins, fn {app, pkg, vsn} -> {app, "== " <> vsn, hex: pkg} end)

    File.mkdir_p!(dir)

    File.write!(Path.join(dir, "mix.exs"), """
    # Generated by Fathom for every plugin in #{request.root}. Do not edit.
    defmodule FathomLocalPlugins.MixProject do
      use Mix.Project

      # Plugins compile against the libraries in the running Fathom.
      def project do
        [
          app: :fathom_local_plugins,
          version: "0.0.0",
          prune_code_paths: false,
          deps: #{inspect(deps, limit: :infinity, printable_limit: :infinity)}
        ]
      end
    end
    """)
  end

  defp in_workspace(dir, fun),
    do: Mix.Project.in_project(:fathom_local_plugins, dir, fn _ -> fun.() end)

  ## Compilation

  defp compile([], failed, _request), do: {[], %{}, failed}

  defp compile(projects, failed, request) do
    by_app = Map.new(projects, &{&1.app, &1})
    host = MapSet.new(request.host_apps)

    in_workspace(workspace(request), fn ->
      lib = Path.join(Mix.Project.build_path(), "lib")

      {built, errors} =
        Enum.reduce(Mix.Dep.load_and_cache(), {%{}, %{}}, fn dep, {built, errors} ->
          blocker = Enum.find(dep.deps, &Map.has_key?(errors, &1.app))

          cond do
            MapSet.member?(host, dep.app) ->
              {built, errors}

            blocker ->
              {built,
               Map.put(
                 errors,
                 dep.app,
                 failure(dep.app, "Needs #{blocker.app}, which did not build")
               )}

            true ->
              result = if by_app[dep.app], do: compile_plugin(dep), else: compile_library(dep)

              case result do
                {:ok, warnings} ->
                  ebin = Path.join([lib, Atom.to_string(dep.app), "ebin"])
                  Code.prepend_path(ebin)
                  {Map.put(built, dep.app, {ebin, warnings}), errors}

                {:error, failure} ->
                  {built, Map.put(errors, dep.app, failure)}
              end
          end
        end)

      {plugins, libs} = Enum.split_with(built, fn {app, _} -> by_app[app] end)

      failed =
        Enum.reduce(errors, failed, fn {app, failure}, failed ->
          if project = by_app[app], do: Map.put(failed, project.dir, failure), else: failed
        end)

      # A plugin whose library failed reports that library's failure.
      failed =
        Enum.reduce(projects, failed, fn project, failed ->
          case Enum.find(project.deps, &(Map.has_key?(errors, &1) and is_nil(by_app[&1]))) do
            nil -> failed
            app -> Map.put(failed, project.dir, %{errors[app] | app: project.app})
          end
        end)

      plugins =
        for {app, {ebin, warnings}} <- plugins,
            not Map.has_key?(failed, by_app[app].dir),
            do: {by_app[app].dir, app, ebin, warnings}

      {plugins, Map.new(libs, fn {app, {ebin, _}} -> {app, ebin} end), failed}
    end)
  end

  defp compile_library(dep) do
    Shell.take()
    Mix.Task.reenable("deps.compile")
    Mix.Task.run("deps.compile", [Atom.to_string(dep.app)])
    {:ok, []}
  rescue
    error ->
      {:error,
       failure(dep.app, "#{dep.app} failed to compile:\n" <> explain(Shell.take(), error))}
  end

  # What `mix deps.compile` does for a Mix dependency, keeping the diagnostics.
  defp compile_plugin(dep) do
    Shell.take()
    result = Mix.Dep.in_dependency(dep, fn _ -> Mix.Task.run("compile", @compile_args) end)
    diagnostics = diagnostics(result, dep.opts[:dest])

    case result do
      {status, _} when status in [:ok, :noop] ->
        {:ok, diagnostics}

      _ ->
        message =
          case Enum.find(diagnostics, &(&1.severity == :error)) do
            nil -> "Compilation failed:\n" <> Shell.take()
            first -> location(first) <> first.message
          end

        {:error, %{app: dep.app, message: message, diagnostics: diagnostics}}
    end
  rescue
    error -> {:error, failure(dep.app, explain(Shell.take(), error))}
  end

  defp diagnostics({_, diagnostics}, dir) when is_list(diagnostics) do
    for %{severity: severity} = d <- diagnostics, severity in [:error, :warning] do
      %{
        file: d.file && relative(to_string(d.file), dir),
        line: line(d.position),
        severity: severity,
        message: d.message |> IO.chardata_to_string() |> drop_stacktrace()
      }
    end
  end

  defp diagnostics(_, _), do: []

  # The compiler may report a path through a symlink (/tmp is /private/tmp).
  defp relative(file, dir) do
    cond do
      String.starts_with?(file, dir <> "/") ->
        Path.relative_to(file, dir)

      match?([_, _], String.split(file, "/lib/", parts: 2)) ->
        "lib/" <> List.last(String.split(file, "/lib/", parts: 2))

      true ->
        file
    end
  end

  # Compile errors carry the compiler's own stack frames; they help nobody.
  defp drop_stacktrace(message) do
    message
    |> String.split("\n")
    |> Enum.reject(&String.match?(&1, ~r/^\s+\((elixir|stdlib|mix|kernel) [\d.]+\) /))
    |> Enum.join("\n")
    |> String.trim()
  end

  defp line({line, _column}), do: line
  defp line(line) when is_integer(line) and line > 0, do: line
  defp line(_), do: nil

  defp location(%{file: nil}), do: ""
  defp location(%{file: file, line: nil}), do: "#{file}: "
  defp location(%{file: file, line: line}), do: "#{file}:#{line}: "

  ## CSS

  # Plugin CSS holds only the classes plugins use, resolved against the
  # SDK theme by reference: the host's stylesheet already defines the tokens.
  defp css(built, request) do
    out = Path.join(request.build, "plugins.css")

    if built == [] do
      File.write!(out, "")
      {:ok, out}
    else
      with {:ok, tailwind} <- Fathom.Plugins.Tailwind.ensure(request.tools) do
        input = Path.join(request.build, "plugins.input.css")
        temp = out <> ".tmp"

        File.write!(input, [
          ~s|@import "tailwindcss/utilities.css" source(none);\n|,
          ~s|@reference "#{css_path(Path.join(request.sdk_css, "theme.css"))}";\n|,
          ~s|@reference "#{css_path(Path.join(request.sdk_css, "typography.css"))}";\n|,
          ~s|@plugin "#{css_path(Path.join(request.sdk_css, "phosphor.js"))}";\n|,
          for({dir, _, _, _} <- built, do: ~s|@source "#{css_path(Path.join(dir, "lib"))}";\n|)
        ])

        args = ["--input", input, "--output", temp, "--minify"]
        env = [{"FATHOM_PHOSPHOR_ICONS", request.icons}]

        case System.cmd(tailwind, args, stderr_to_stdout: true, env: env) do
          {_, 0} ->
            File.rename!(temp, out)
            {:ok, out}

          {output, status} ->
            {:error, "Tailwind exited #{status}:\n#{output}"}
        end
      end
    end
  end

  defp css_path(path), do: String.replace(path, ~S("), ~S(\"))

  ## Failures

  defp failure(app, message), do: %{app: app, message: message, diagnostics: []}

  defp fail_all(failed, projects, message),
    do: Enum.reduce(projects, failed, &Map.put(&2, &1.dir, failure(&1.app, message)))

  defp explain(printed, error) do
    message = Exception.message(error)
    printed = String.trim(printed)

    cond do
      printed == "" -> message
      String.contains?(printed, message) -> printed
      true -> printed <> "\n" <> message
    end
  end
end
