defmodule Fathom.KernelControl do
  @moduledoc """
  Plugin lifecycle control for plugin managers. Always available.

  Bundled plugins ship inside Fathom. Local plugins are Mix projects under
  `~/.fathom/plugins/`. The harness builds them at launch, lists the ones
  whose files changed since (`pending`), and builds again on `rebuild/0`:
  new code replaces running code in place, and plugins whose manifest,
  application spec, or application module changed restart.

  Subscribers receive `{:fathom_kernel, :changed}` after any plugin or build
  changes state.
  """
  use Fathom.Service

  @type state :: :stopped | :blocked | :starting | :ready | :failed
  @type status :: %{
          id: String.t(),
          app: atom(),
          source: :bundled | :local,
          dir: String.t() | nil,
          enabled: boolean(),
          stale: boolean(),
          config: map(),
          config_schema: keyword(),
          state: state(),
          gen: non_neg_integer(),
          waiting_on: [module()],
          last_error: String.t() | nil,
          requires: [module()],
          provides: [module()]
        }
  @type action :: :enable | :disable | :restart | {:configure, map()}

  @typedoc "A compiler message about one file of a local plugin."
  @type diagnostic :: %{
          file: String.t() | nil,
          line: non_neg_integer() | nil,
          severity: :error | :warning,
          message: String.t()
        }

  @typedoc "The last build of one directory under the local plugins root."
  @type plugin_build :: %{
          dir: String.t(),
          name: String.t(),
          app: atom() | nil,
          plugin: String.t() | nil,
          error: String.t() | nil,
          diagnostics: [diagnostic()]
        }

  @type builds :: %{
          root: String.t(),
          state: :idle | :building,
          error: String.t() | nil,
          css_error: String.t() | nil,
          finished_at: DateTime.t() | nil,
          log: String.t(),
          pending: [String.t()],
          plugins: [plugin_build()]
        }

  @callback plugins() :: [status()]
  @callback change(id :: String.t(), action()) :: :ok | {:error, String.t()}
  @callback restart_stale() :: :ok | {:error, String.t()}
  @callback builds() :: builds()
  @callback rebuild() :: :ok
  @callback create(name :: String.t(), ui :: String.t()) :: :ok | {:error, String.t()}

  def plugins, do: Fathom.Service.call(__MODULE__, :plugins, [])
  def change(id, action), do: Fathom.Service.call(__MODULE__, :change, [id, action])

  @doc "Restarts every stale plugin, and its dependents, in one pass."
  def restart_stale, do: Fathom.Service.call(__MODULE__, :restart_stale, [])

  @doc "The state of local plugin builds."
  def builds, do: Fathom.Service.call(__MODULE__, :builds, [])

  @doc "Builds local plugins, applies the code, and restarts those whose manifest changed."
  def rebuild, do: Fathom.Service.call(__MODULE__, :rebuild, [])

  @doc "Generates a local plugin; `ui` is `settings`, `page`, or `none`."
  def create(name, ui), do: Fathom.Service.call(__MODULE__, :create, [name, ui])

  def subscribe, do: Fathom.Events.subscribe(topic())

  @doc false
  def topic, do: "fathom:kernel"
end
