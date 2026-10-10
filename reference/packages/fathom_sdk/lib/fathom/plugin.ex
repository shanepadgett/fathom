defmodule Fathom.Plugin do
  @moduledoc """
  A plugin is an OTP application with a manifest.

  The manifest says what the plugin requires and provides:

      defmodule Counter.Plugin do
        use Fathom.Plugin,
          otp_app: :counter,
          id: "counter",
          requires: [Fathom.Storage, Fathom.UI.SettingsSections],
          config: [step: [type: :pos_integer, default: 1, doc: "How much each click adds."]]

        @impl true
        def contributions do
          [{Fathom.UI.SettingsSections, "counter",
            %{label: "Counter", icon: "ph-plus", order: 50, view: CounterWeb.SettingsLive}}]
        end
      end

  The application's supervision tree ends with the publisher, which registers
  services and contributions once everything before it is running:

      children = [Counter.Server, {Fathom.Plugin.Publisher, Counter.Plugin}]

  The kernel starts the application once every required token is available
  and stops it, dependents first, when one is withdrawn. Registrations belong
  to the publisher process, so they disappear with it on stop or crash.

  The application env names the manifest so the harness finds it without
  importing it: `env: [fathom_plugin: Counter.Plugin]`. Dependencies on other
  plugins use `runtime: false`; the kernel, not OTP, decides when they start.

  ## Options

  #{NimbleOptions.docs(Fathom.Plugin.Manifest.schema())}
  """

  @typedoc "A registry token, the entry key, and the entry value."
  @type contribution :: {registry :: module(), key :: String.t(), value :: map()}

  @doc "Service tokens and the modules implementing them."
  @callback services() :: [{token :: module(), implementation :: module()}]

  @doc "Entries this plugin adds to registries it requires or provides."
  @callback contributions() :: [contribution()]

  defmacro __using__(opts) do
    quote bind_quoted: [opts: opts] do
      @behaviour Fathom.Plugin
      @fathom_manifest Fathom.Plugin.Manifest.new!(__MODULE__, opts)

      @doc false
      def __fathom_plugin__, do: @fathom_manifest

      @doc "This plugin's validated configuration."
      def config, do: Fathom.Plugin.config(@fathom_manifest.otp_app)

      @impl Fathom.Plugin
      def services, do: []

      @impl Fathom.Plugin
      def contributions, do: []

      defoverridable services: 0, contributions: 0
    end
  end

  @doc "Returns the manifest of a plugin module."
  @spec manifest(module()) :: Fathom.Plugin.Manifest.t()
  def manifest(module), do: module.__fathom_plugin__()

  @doc false
  @spec config(atom()) :: map()
  def config(otp_app), do: Application.get_env(otp_app, :fathom_config, %{})
end
