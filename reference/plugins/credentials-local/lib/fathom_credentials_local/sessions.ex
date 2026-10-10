defmodule FathomCredentialsLocal.Sessions do
  @moduledoc """
  Runs logins. Each login is a task running the provider's flow; it talks
  back through `FathomCredentials.LoginUI`. Cancelling, the 15-minute
  timeout, and plugin shutdown all end a login by shutting down its task;
  processes linked to it, like an OAuth callback server, stop with it.

  Keeps the last 50 logins' public state for the settings page.
  """
  use GenServer
  alias FathomCredentials.{Credential, LoginUI, Logins}
  alias FathomCredentialsLocal.{LoginState, Store}

  @history_limit 50
  @timeout_ms 15 * 60_000

  def start_link(_), do: GenServer.start_link(__MODULE__, nil, name: __MODULE__)

  def list, do: GenServer.call(__MODULE__, :list)
  def start(provider, method), do: GenServer.call(__MODULE__, {:start, provider, method})
  def reply(id, value), do: GenServer.call(__MODULE__, {:reply, id, value})
  def cancel(id), do: GenServer.call(__MODULE__, {:cancel, id})
  def cancel_provider(provider), do: GenServer.call(__MODULE__, {:cancel_provider, provider})
  def url(id), do: GenServer.call(__MODULE__, {:url, id})

  @impl true
  def init(nil), do: {:ok, %{sessions: %{}, order: []}}

  @impl true
  def handle_call(:list, _from, state) do
    {:reply, Enum.map(state.order, &state.sessions[&1].state), state}
  end

  def handle_call({:start, provider, method}, _from, state) do
    flow = Logins.flow(provider)

    cond do
      Enum.any?(
        Map.values(state.sessions),
        &(&1.state.provider == provider and LoginState.active?(&1.state))
      ) ->
        {:reply, {:error, "A login is already active for this provider"}, state}

      flow == nil ->
        {:reply, {:error, "Login provider unavailable"}, state}

      not Enum.any?(flow.methods(), &(&1.id == method)) ->
        {:reply, {:error, "Unknown login method"}, state}

      true ->
        id = Base.url_encode64(:crypto.strong_rand_bytes(12), padding: false)
        ui = %LoginUI{server: self(), id: id}

        task =
          Task.Supervisor.async_nolink(FathomCredentialsLocal.TaskSupervisor, fn ->
            flow.login(method, ui)
          end)

        timer = Process.send_after(self(), {:expire, id}, @timeout_ms)

        login = %LoginState{
          id: id,
          provider: provider,
          method: method,
          state: :working,
          message: "Starting login…"
        }

        session = %{state: login, task: task, pending: nil, timer: timer}

        state =
          prune(%{
            state
            | sessions: Map.put(state.sessions, id, session),
              order: state.order ++ [id]
          })

        publish(login)
        {:reply, {:ok, id}, state}
    end
  end

  def handle_call({:prompt, id, message}, from, state) do
    case state.sessions[id] do
      %{task: task} = session when task != nil ->
        login = %{
          session.state
          | state: :waiting,
            prompt: message,
            message: if(session.state.url, do: session.state.message, else: message)
        }

        publish(login)
        {:noreply, put_in(state.sessions[id], %{session | state: login, pending: from})}

      _ ->
        {:reply, {:error, :cancelled}, state}
    end
  end

  def handle_call({:reply, id, value}, _from, state) do
    case state.sessions[id] do
      %{pending: from} = session when from != nil ->
        GenServer.reply(from, {:ok, value})
        login = %{session.state | state: :working, prompt: nil, message: "Completing login…"}
        publish(login)
        {:reply, :ok, put_in(state.sessions[id], %{session | state: login, pending: nil})}

      _ ->
        {:reply, {:error, "This login is not waiting for input"}, state}
    end
  end

  def handle_call({:cancel, id}, _from, state) do
    if Map.has_key?(state.sessions, id),
      do: {:reply, :ok, end_login(state, id, :cancelled, "Login cancelled or expired.")},
      else: {:reply, {:error, "Unknown login"}, state}
  end

  def handle_call({:cancel_provider, provider}, _from, state) do
    state =
      state.sessions
      |> Enum.filter(fn {_, s} ->
        s.state.provider == provider and LoginState.active?(s.state)
      end)
      |> Enum.reduce(state, fn {id, _}, state ->
        end_login(state, id, :cancelled, "Login cancelled.")
      end)

    {:reply, :ok, state}
  end

  def handle_call({:url, id}, _from, state) do
    case state.sessions[id] do
      %{state: %{state: :waiting, url: url}} when is_binary(url) -> {:reply, {:ok, url}, state}
      _ -> {:reply, {:error, "This login has no sign-in page to open"}, state}
    end
  end

  @impl true
  def handle_cast({:notify, id, attrs}, state) do
    case state.sessions[id] do
      %{task: task} = session when task != nil ->
        login =
          struct(session.state, Map.take(attrs, [:message, :url, :code]))
          |> Map.put(:state, :waiting)

        publish(login)
        {:noreply, put_in(state.sessions[id], %{session | state: login})}

      _ ->
        {:noreply, state}
    end
  end

  @impl true
  def handle_info({ref, result}, state) when is_reference(ref) do
    Process.demonitor(ref, [:flush])

    case find_task(state, ref) do
      nil -> {:noreply, state}
      id -> {:noreply, complete(state, id, result)}
    end
  end

  def handle_info({:DOWN, ref, :process, _pid, _reason}, state) do
    case find_task(state, ref) do
      nil -> {:noreply, state}
      id -> {:noreply, end_login(state, id, :failed, "Login failed")}
    end
  end

  def handle_info({:expire, id}, state) do
    if Map.has_key?(state.sessions, id) and LoginState.active?(state.sessions[id].state),
      do: {:noreply, end_login(state, id, :cancelled, "Login cancelled or expired.")},
      else: {:noreply, state}
  end

  defp complete(state, id, {:ok, %Credential{} = credential}) do
    provider = state.sessions[id].state.provider

    case Store.put(provider, credential) do
      :ok ->
        FathomCredentials.changed()
        end_login(state, id, :connected, "Credentials saved.")

      {:error, message} ->
        end_login(state, id, :failed, message)
    end
  end

  defp complete(state, id, {:error, message}) when is_binary(message),
    do: end_login(state, id, :failed, message)

  defp complete(state, id, _other), do: end_login(state, id, :failed, "Login failed")

  defp end_login(state, id, outcome, message) do
    case state.sessions[id] do
      %{task: nil} -> state
      session -> finish_login(state, id, session, outcome, message)
    end
  end

  defp finish_login(state, id, session, outcome, message) do
    # :shutdown, not :kill, so linked servers stop cleanly instead of crashing.
    Task.shutdown(session.task, 1_000)
    if session.pending, do: GenServer.reply(session.pending, {:error, :cancelled})
    Process.cancel_timer(session.timer)

    login = %LoginState{
      id: id,
      provider: session.state.provider,
      method: session.state.method,
      state: outcome,
      message: message
    }

    publish(login)
    put_in(state.sessions[id], %{session | state: login, task: nil, pending: nil})
  end

  defp find_task(state, ref) do
    Enum.find_value(state.sessions, fn {id, s} -> if s.task && s.task.ref == ref, do: id end)
  end

  # Drop the oldest finished login once history is full.
  defp prune(%{order: order} = state) when length(order) <= @history_limit, do: state

  defp prune(state) do
    case Enum.find(state.order, &(not LoginState.active?(state.sessions[&1].state))) do
      nil ->
        state

      id ->
        %{state | sessions: Map.delete(state.sessions, id), order: List.delete(state.order, id)}
    end
  end

  defp publish(login), do: FathomCredentialsLocal.publish_login(login)
end
