defmodule Mix.Tasks.Fathom.Gen.Plugin do
  @shortdoc "Generates a Fathom plugin project"

  @moduledoc """
  Generates a plugin project with `mix new --sup`, then adds the plugin
  manifest, the publisher at the end of its supervision tree, a context
  module, and optionally a UI contribution under the `Web` namespace.

      $ mix fathom.gen.plugin counter
      $ mix fathom.gen.plugin counter --into ../../examples --ui page --disabled

  ## Options

    * `--into` - parent directory for the project. Defaults to the current one.
    * `--app` - OTP app name. Defaults to the id with dashes as underscores.
    * `--module` - root module. Defaults to the camelized app name.
    * `--ui` - `settings` (default) contributes a settings section, `page`
      contributes a workspace page, `none` contributes nothing.
    * `--disabled` - the plugin starts disabled the first time Fathom sees it.

  The project depends on `fathom_sdk` by path when the current project does,
  and on the Hex package otherwise.
  """
  use Mix.Task

  import Mix.Generator

  @switches [into: :string, app: :string, module: :string, ui: :string, disabled: :boolean]

  @impl true
  def run(argv) do
    {opts, args} = OptionParser.parse!(argv, strict: @switches)

    id =
      case args do
        [id] -> id
        _ -> Mix.raise("Expected one plugin id, such as: mix fathom.gen.plugin counter")
      end

    unless id =~ ~r/^[a-z][a-z0-9-]*$/ do
      Mix.raise("Plugin id must be lowercase letters, digits, and dashes, starting with a letter")
    end

    ui = Keyword.get(opts, :ui, "settings")

    unless ui in ~w(settings page none) do
      Mix.raise("--ui must be settings, page, or none")
    end

    app = Keyword.get(opts, :app, String.replace(id, "-", "_"))
    mod = Keyword.get(opts, :module, Macro.camelize(app))
    path = Path.expand(Path.join(Keyword.get(opts, :into, "."), id))

    if File.exists?(path), do: Mix.raise("#{path} already exists")

    Mix.Task.run("new", [path, "--sup", "--app", app, "--module", mod])

    assigns = [
      id: id,
      app: app,
      mod: mod,
      ui: ui,
      label: id |> String.split("-") |> Enum.map_join(" ", &String.capitalize/1),
      enabled: !Keyword.get(opts, :disabled, false),
      sdk_dep: sdk_dep(path)
    ]

    # `mix new` writes a hello-world module, application, and test, named
    # after the module when --module is given. The plugin templates replace them.
    File.rm_rf!(Path.join(path, "lib"))
    Enum.each(Path.wildcard(Path.join(path, "test/*_test.exs")), &File.rm!/1)

    for {template, target} <- files(app, ui) do
      contents = EEx.eval_file(template_path(template), assigns: assigns)
      create_file(Path.join(path, target), contents, force: true)
    end

    Mix.shell().info("""

    Your plugin is ready at #{Path.relative_to_cwd(path)}.
    Fathom builds plugins in ~/.fathom/plugins/ as you save. Bundled plugins
    under plugins/ and examples/ are picked up on the next `mise run dev`.
    """)
  end

  defp files(app, ui) do
    [
      {"mix.exs.eex", "mix.exs"},
      {"formatter.exs.eex", ".formatter.exs"},
      {"README.md.eex", "README.md"},
      {"contract.ex.eex", "lib/#{app}.ex"},
      {"application.ex.eex", "lib/#{app}/application.ex"},
      {"plugin.ex.eex", "lib/#{app}/plugin.ex"}
    ] ++
      case ui do
        "settings" -> [{"live.ex.eex", "lib/#{app}_web/settings_live.ex"}]
        "page" -> [{"live.ex.eex", "lib/#{app}_web/page_live.ex"}]
        "none" -> []
      end
  end

  defp template_path(name) do
    Application.app_dir(:fathom_sdk, Path.join("priv/templates/fathom.gen.plugin", name))
  end

  # Outside a Mix project (inside Fathom, or a bare directory) the plugin
  # names the Hex package; Fathom supplies its own SDK when it builds.
  defp sdk_dep(plugin_path) do
    if Mix.Project.get(), do: project_sdk_dep(plugin_path), else: ~s({:fathom_sdk, "~> 0.1"})
  end

  defp project_sdk_dep(plugin_path) do
    deps_path = Path.expand(Mix.Project.deps_path())

    case Mix.Project.deps_paths()[:fathom_sdk] do
      nil ->
        ~s({:fathom_sdk, "~> 0.1"})

      sdk ->
        if String.starts_with?(Path.expand(sdk), deps_path) do
          ~s({:fathom_sdk, "~> 0.1"})
        else
          ~s({:fathom_sdk, path: "#{Path.relative_to(Path.expand(sdk), plugin_path, force: true)}"})
        end
    end
  end
end
