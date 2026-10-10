defmodule FathomCodingTools.Bash do
  @moduledoc """
  The `bash` tool: one command in the person's login shell, in the session
  folder, with stdin closed. Output streams to the chat as it arrives.

  The command does not inherit Fathom's own environment; see `Fathom.Shell`.
  A watcher kills the command's process tree when the timeout passes or
  the run that started it stops, so stopping an agent stops its commands.
  """
  @behaviour FathomAgent.Tool

  alias FathomAgent.Tool
  alias FathomCodingTools.Truncate

  # Kept in memory; output beyond this is only in the full-output file.
  @memory_limit 4 * 1024 * 1024

  @impl true
  def name, do: "bash"

  @impl true
  def description,
    do:
      "Execute a shell command in the current working directory. Returns stdout and stderr. " <>
        "Output is truncated to the last #{Truncate.max_lines()} lines or " <>
        "#{div(Truncate.max_bytes(), 1024)}KB, whichever is hit first; if truncated, the full " <>
        "output is saved to a temp file. Optionally provide a timeout in seconds."

  @impl true
  def parameters do
    %{
      type: "object",
      properties: %{
        command: %{type: "string", description: "Shell command to execute"},
        timeout: %{
          type: "number",
          description: "Timeout in seconds (optional, no default timeout)"
        }
      },
      required: ["command"]
    }
  end

  @impl true
  def run(%{"command" => command} = args, context) when is_binary(command) do
    started = System.monotonic_time(:millisecond)
    timeout = timeout(args["timeout"])

    port =
      Port.open({:spawn_executable, Fathom.Shell.executable()}, [
        :binary,
        :exit_status,
        :stderr_to_stdout,
        :hide,
        args: Fathom.Shell.args("exec </dev/null\n" <> command),
        cd: context.cwd,
        env: Fathom.Shell.port_env()
      ])

    {:os_pid, os_pid} = Port.info(port, :os_pid)
    watcher = watch(self(), os_pid)
    deadline = if timeout, do: started + timeout * 1000

    {status, output} = collect(port, context, deadline, os_pid, {[], 0, 0})
    send(watcher, :done)

    output = output |> IO.iodata_to_binary() |> String.replace_invalid()
    {tail, cut?} = Truncate.tail(output)
    full_path = if cut?, do: save_full(output, context.call_id)
    seconds = Float.round((System.monotonic_time(:millisecond) - started) / 1000, 1)

    notice =
      if cut?, do: "\n\n[Output truncated to the end. Full output: #{full_path}]", else: ""

    details = %{
      command: command,
      exit_code: if(is_integer(status), do: status),
      seconds: seconds,
      timed_out: status == :timeout,
      full_output: full_path
    }

    case status do
      0 ->
        {:ok, %{content: tail <> notice, details: details}}

      :timeout ->
        {:error,
         %{content: tail <> notice <> "\n\nCommand timed out after #{timeout}s", details: details}}

      code ->
        {:error,
         %{content: tail <> notice <> "\n\nCommand exited with code #{code}", details: details}}
    end
  end

  def run(_args, _context), do: {:error, "`command` is required"}

  defp collect(port, context, deadline, os_pid, {acc, size, dropped}) do
    wait =
      if deadline, do: max(deadline - System.monotonic_time(:millisecond), 0), else: :infinity

    receive do
      {^port, {:data, data}} ->
        Tool.output(context, String.replace_invalid(data))

        state =
          if size + byte_size(data) > @memory_limit,
            do: {[data], byte_size(data), dropped + size},
            else: {[acc, data], size + byte_size(data), dropped}

        collect(port, context, deadline, os_pid, state)

      {^port, {:exit_status, status}} ->
        {status, prefix(dropped, acc)}
    after
      wait ->
        kill_tree(os_pid)
        Port.close(port)
        {:timeout, prefix(dropped, acc)}
    end
  end

  defp prefix(0, acc), do: acc
  defp prefix(dropped, acc), do: ["[#{dropped} earlier bytes not kept]\n" | acc]

  defp timeout(n) when is_number(n) and n > 0, do: n
  defp timeout(_n), do: nil

  defp save_full(output, call_id) do
    path = Path.join(System.tmp_dir!(), "fathom-bash-#{call_id}.log")
    File.write!(path, output)
    path
  end

  # Kills the command if the run stops before it finishes.
  defp watch(owner, os_pid) do
    spawn(fn ->
      ref = Process.monitor(owner)

      receive do
        :done -> :ok
        {:DOWN, ^ref, :process, _, _} -> kill_tree(os_pid)
      end
    end)
  end

  defp kill_tree(pid) do
    pid = to_string(pid)

    case System.cmd("pgrep", ["-P", pid], stderr_to_stdout: true) do
      {children, 0} -> children |> String.split() |> Enum.each(&kill_tree/1)
      _ -> :ok
    end

    System.cmd("kill", ["-KILL", pid], stderr_to_stdout: true)
    :ok
  end
end
