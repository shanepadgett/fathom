defmodule FathomEditor.LanguageServer do
  @moduledoc """
  One language server process over stdio, for one editor view.

  Messages are JSON-RPC bodies as strings; this process only frames them
  (`Content-Length`). Bodies from the server go to the owner as
  `{:lsp, id, body}`; `{:lsp_exit, id, status}` when it exits. The owner is
  the editor view, whose CodeMirror client did the `initialize` exchange,
  so the server stops when that view does.

  Servers ask the client things CodeMirror's client does not implement,
  and some wait for the answer before they start working (Expert waits on
  `client/registerCapability`). This process answers those with empty
  successes and does not forward them.
  """
  use GenServer, restart: :temporary

  require Logger

  def start(opts),
    do: DynamicSupervisor.start_child(FathomEditor.LanguageServers, {__MODULE__, opts})

  def start_link(opts), do: GenServer.start_link(__MODULE__, opts)

  @spec send_message(pid(), String.t()) :: :ok
  def send_message(pid, body), do: GenServer.cast(pid, {:send, body})

  @impl true
  def init(%{id: id, owner: owner, command: command, args: args, root: root}) do
    Process.monitor(owner)

    port =
      Port.open({:spawn_executable, command}, [
        :binary,
        :exit_status,
        :hide,
        args: args,
        cd: root,
        env: Fathom.Shell.port_env()
      ])

    {:os_pid, os_pid} = Port.info(port, :os_pid)
    Logger.info("Started #{Path.basename(command)} for #{root}")
    {:ok, %{id: id, owner: owner, port: port, os_pid: os_pid, buffer: ""}}
  end

  @impl true
  def handle_cast({:send, body}, state) do
    Port.command(state.port, [
      "Content-Length: ",
      Integer.to_string(byte_size(body)),
      "\r\n\r\n",
      body
    ])

    {:noreply, state}
  end

  @impl true
  def handle_info({port, {:data, data}}, %{port: port} = state) do
    {bodies, rest} = frames(state.buffer <> data, [])

    Enum.each(bodies, fn body ->
      case answer(body) do
        nil -> send(state.owner, {:lsp, state.id, body})
        reply -> handle_cast({:send, reply}, state)
      end
    end)

    {:noreply, %{state | buffer: rest}}
  end

  def handle_info({port, {:exit_status, status}}, %{port: port} = state) do
    send(state.owner, {:lsp_exit, state.id, status})
    {:stop, :normal, state}
  end

  def handle_info({:DOWN, _ref, :process, _pid, _reason}, state), do: {:stop, :normal, state}

  @impl true
  def terminate(_reason, state) do
    # Closing stdin asks politely; kill in case the server ignores it.
    if Port.info(state.port), do: Port.close(state.port)
    System.cmd("kill", ["-TERM", Integer.to_string(state.os_pid)], stderr_to_stdout: true)
    :ok
  end

  @answered ~w(client/registerCapability client/unregisterCapability
               window/workDoneProgress/create workspace/configuration)

  defp answer(body) do
    with true <- String.contains?(body, ~s("method")),
         {:ok, %{"id" => id, "method" => method} = request} when method in @answered <-
           Jason.decode(body) do
      result =
        case method do
          "workspace/configuration" ->
            Enum.map(get_in(request, ["params", "items"]) || [], fn _ -> nil end)

          _ ->
            nil
        end

      Jason.encode!(%{jsonrpc: "2.0", id: id, result: result})
    else
      _ -> nil
    end
  end

  defp frames(buffer, acc) do
    with [headers, rest] <- :binary.split(buffer, "\r\n\r\n"),
         [_, length] <- Regex.run(~r/Content-Length:\s*(\d+)/i, headers),
         length = String.to_integer(length),
         true <- byte_size(rest) >= length do
      body = binary_part(rest, 0, length)
      frames(binary_part(rest, length, byte_size(rest) - length), [body | acc])
    else
      _ -> {Enum.reverse(acc), buffer}
    end
  end
end
