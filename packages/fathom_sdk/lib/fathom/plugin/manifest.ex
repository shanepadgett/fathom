defmodule Fathom.Plugin.Manifest do
  @moduledoc "What a plugin declares at compile time."

  @schema [
    otp_app: [type: :atom, required: true, doc: "The plugin's OTP application."],
    id: [type: :string, required: true, doc: "Stable plugin id, such as `\"counter\"`."],
    requires: [
      type: {:list, :atom},
      default: [],
      doc: "Service and registry tokens that must be available before start."
    ],
    provides: [
      type: {:list, :atom},
      default: [],
      doc: "Service and registry tokens this plugin owns."
    ],
    config: [
      type: :keyword_list,
      default: [],
      doc: "A `NimbleOptions` schema for user configuration."
    ],
    enabled: [
      type: :boolean,
      default: true,
      doc: "Whether the plugin starts enabled the first time Fathom sees it."
    ]
  ]

  @enforce_keys [:module, :otp_app, :id]
  defstruct [:module, :otp_app, :id, requires: [], provides: [], config: [], enabled: true]

  @type t :: %__MODULE__{
          module: module(),
          otp_app: atom(),
          id: String.t(),
          requires: [module()],
          provides: [module()],
          config: keyword(),
          enabled: boolean()
        }

  @doc false
  def schema, do: @schema

  @doc false
  def new!(module, opts) do
    opts = NimbleOptions.validate!(opts, @schema)
    # Fail at compile time if the config schema itself is invalid.
    NimbleOptions.new!(opts[:config])
    struct!(__MODULE__, [module: module] ++ opts)
  end
end
