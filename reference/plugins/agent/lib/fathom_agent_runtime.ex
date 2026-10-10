defmodule FathomAgentRuntime do
  @moduledoc """
  The bundled implementation of `FathomAgent`: one process per session
  under `FathomAgentRuntime.Sessions`, records in session files (see
  `FathomAgentRuntime.Store`), and runs in `FathomAgentRuntime.Loop`.
  Also contributes the Chat page.
  """
  @behaviour FathomAgent

  alias FathomAgentRuntime.{Session, Store}

  @impl true
  def create(%{cwd: cwd} = attrs) do
    cwd = Fathom.Folder.real(cwd)

    with {:ok, provider, model} <- model(attrs),
         true <- File.dir?(cwd) || {:error, "Not a folder: #{cwd}"} do
      now = System.system_time(:millisecond)
      id = "s" <> Integer.to_string(now, 36) <> Base.url_encode64(:crypto.strong_rand_bytes(3))

      session = %{
        id: String.downcase(id),
        title: "New chat",
        cwd: cwd,
        provider: provider,
        model: model,
        created_at: now,
        updated_at: now,
        entries: []
      }

      {:ok, _pid} = start(session)
      Store.save(session)
      Fathom.Events.broadcast("agent:sessions", {:agent_sessions, :changed})
      {:ok, session.id}
    end
  end

  @doc "Saves the person's model choice, the default for new sessions."
  def choose_model(provider, model),
    do: Fathom.Storage.put("agent", "model", %{"provider" => provider, "model" => model})

  @doc "The person's last model choice."
  def chosen_model do
    case Fathom.Storage.get("agent", "model") do
      %{"provider" => provider, "model" => model} -> {provider, model}
      _ -> nil
    end
  end

  defp model(%{provider: provider, model: model}) when is_binary(provider) and is_binary(model),
    do: {:ok, provider, model}

  defp model(_attrs) do
    case chosen_model() do
      {provider, model} -> {:ok, provider, model}
      nil -> {:error, "Choose a model in Chat first"}
    end
  end

  @impl true
  def prompt(id, text), do: call(id, {:prompt, text}, {:error, "Session not found"})

  @impl true
  def abort(id), do: call(id, :abort, :ok)

  @impl true
  def set_model(id, provider, model), do: call(id, {:set_model, provider, model}, :ok)

  @impl true
  def delete(id) do
    case Registry.lookup(FathomAgentRuntime.Registry, id) do
      [{pid, _}] -> DynamicSupervisor.terminate_child(FathomAgentRuntime.Sessions, pid)
      [] -> :ok
    end

    Store.delete(id)
    Fathom.Events.broadcast("agent:sessions", {:agent_sessions, :changed})
    :ok
  end

  @impl true
  def sessions do
    FathomAgentRuntime.Registry
    |> Registry.select([{{:"$1", :_, :_}, [], [:"$1"]}])
    |> Enum.flat_map(fn id ->
      case call(id, :summary, nil) do
        nil -> []
        summary -> [summary]
      end
    end)
    |> Enum.sort_by(& &1.updated_at, :desc)
  end

  @impl true
  def session(id), do: call(id, :snapshot, nil)

  @doc false
  def start(session),
    do: DynamicSupervisor.start_child(FathomAgentRuntime.Sessions, {Session, session})

  defp call(id, message, missing) do
    GenServer.call(Session.via(id), message)
  catch
    :exit, {:noproc, _} -> missing
  end

  defmodule Loader do
    @moduledoc false
    # Starts a process for every session file, then gets out of the way.
    def child_spec(_),
      do: %{id: __MODULE__, start: {__MODULE__, :start_link, []}, restart: :temporary}

    def start_link do
      Enum.each(Store.load_all(), &FathomAgentRuntime.start/1)
      :ignore
    end
  end
end
