# The host formats the whole Elixir tree: harness, packages, and every plugin
# share one style, and plugins need no deps of their own to be formatted.
repo = "../.."

[
  import_deps: [:phoenix],
  plugins: [Phoenix.LiveView.HTMLFormatter],
  inputs: [
    "*.{heex,ex,exs}",
    "{config,lib,test}/**/*.{heex,ex,exs}",
    "#{repo}/packages/*/*.exs",
    "#{repo}/packages/*/{config,lib,priv,test}/**/*.{heex,ex,exs}",
    "#{repo}/{plugins,examples}/*/*.exs",
    "#{repo}/{plugins,examples}/*/{config,lib,priv,test}/**/*.{heex,ex,exs}"
  ]
]
