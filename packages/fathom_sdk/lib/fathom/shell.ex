defmodule Fathom.Shell do
  @moduledoc """
  The person's shell, for running their tools.

  An app opened from the Finder inherits launchd's minimal `PATH`, not the
  one a terminal has. `env/0` asks the login shell once and caches the
  answer, so commands and language servers find what a terminal would.

  `env/0` also unsets what Fathom's own process carries and a person's
  command must not inherit: the release's `RELEASE_*` and Erlang variables,
  distribution flags, and Fathom's launch settings such as `PORT`.
  """

  @key {__MODULE__, :path}

  @unset ~w(ELIXIR_ERL_OPTIONS ERL_AFLAGS ERL_ZFLAGS HEART_COMMAND BINDIR ROOTDIR EMU PROGNAME
            PORT FATHOM_HOME FATHOM_DESKTOP FATHOM_PARENT_STDIN)

  @doc "The person's shell executable."
  @spec executable() :: Path.t()
  def executable do
    case System.get_env("SHELL") do
      shell when is_binary(shell) and shell != "" -> shell
      _ -> if File.exists?("/bin/zsh"), do: "/bin/zsh", else: "/bin/sh"
    end
  end

  @doc "Arguments that run `command` in a login shell."
  @spec args(String.t()) :: [String.t()]
  def args(command), do: ["-l", "-c", command]

  @doc """
  Environment changes for a child process, in `System.cmd/3` form: `nil`
  unsets. Use `port_env/0` for `Port.open/2`.
  """
  @spec env() :: [{String.t(), String.t() | nil}]
  def env do
    release = for {name, _} <- System.get_env(), String.starts_with?(name, "RELEASE_"), do: name
    unset = for name <- @unset ++ release, System.get_env(name), do: {name, nil}
    [{"PATH", path()} | unset]
  end

  @doc "`env/0` in `Port.open/2` form."
  @spec port_env() :: [{charlist(), charlist() | false}]
  def port_env,
    do:
      for(
        {k, v} <- env(),
        do: {String.to_charlist(k), if(v, do: String.to_charlist(v), else: false)}
      )

  @doc "The login shell's `PATH`, asked once."
  @spec path() :: String.t()
  def path do
    case :persistent_term.get(@key, nil) do
      nil ->
        path = login_path() || System.get_env("PATH", "/usr/bin:/bin:/usr/sbin:/sbin")
        :persistent_term.put(@key, path)
        path

      path ->
        path
    end
  end

  @doc "Finds `program` on the login shell's `PATH`."
  @spec find(String.t()) :: Path.t() | nil
  def find(program) do
    path()
    |> String.split(":", trim: true)
    |> Enum.map(&Path.join(&1, program))
    |> Enum.find(&(File.regular?(&1) and executable?(&1)))
  end

  defp executable?(path) do
    case File.stat(path) do
      {:ok, %{mode: mode}} -> Bitwise.band(mode, 0o111) != 0
      _ -> false
    end
  end

  defp login_path do
    marker = "__FATHOM_PATH__"
    command = ~s(printf "#{marker}%s" "$PATH")
    task = Task.async(fn -> System.cmd(executable(), args(command), stderr_to_stdout: true) end)

    case Task.yield(task, 10_000) || Task.shutdown(task, :brutal_kill) do
      {:ok, {output, 0}} ->
        case String.split(output, marker) do
          [_, path] when path != "" -> String.trim(path)
          _ -> nil
        end

      _ ->
        nil
    end
  end
end
