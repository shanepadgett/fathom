defmodule FathomCredentialsLocal.Access do
  @moduledoc """
  Implements `FathomCredentials.get/1`. Refreshes OAuth tokens a minute
  before they expire; concurrent callers share one refresh, which runs as a
  task so a slow provider never blocks other lookups.
  """
  use GenServer
  alias FathomCredentials.Logins
  alias FathomCredentialsLocal.Store

  @refresh_ahead_ms 60_000
  @refresh_timeout_ms 60_000

  def start_link(_), do: GenServer.start_link(__MODULE__, nil, name: __MODULE__)

  def get(provider), do: GenServer.call(__MODULE__, {:get, provider}, @refresh_timeout_ms + 5_000)

  @doc "Removes a credential; lookups return `:none` while removal runs."
  def remove(provider), do: GenServer.call(__MODULE__, {:remove, provider}, :infinity)

  @impl true
  def init(nil), do: {:ok, %{refreshes: %{}, removing: MapSet.new()}}

  @impl true
  def handle_call({:get, provider}, from, state) do
    if MapSet.member?(state.removing, provider) do
      {:reply, :none, state}
    else
      lookup(provider, from, state)
    end
  end

  def handle_call({:remove, provider}, _from, state) do
    :ok = FathomCredentialsLocal.Sessions.cancel_provider(provider)
    result = Store.put(provider, nil)
    FathomCredentials.changed()
    {:reply, result, state}
  end

  defp lookup(provider, from, state) do
    now = System.system_time(:millisecond)

    case Store.get(provider) do
      nil ->
        {:reply, :none, state}

      %{kind: :api_key} = credential ->
        {:reply, {:ok, credential}, state}

      %{expires_at: expires_at} = credential when expires_at > now + @refresh_ahead_ms ->
        {:reply, {:ok, credential}, state}

      credential ->
        case state.refreshes[provider] do
          %{waiters: waiters} = refresh ->
            {:noreply, put_in(state.refreshes[provider], %{refresh | waiters: [from | waiters]})}

          nil ->
            start_refresh(provider, credential, from, state)
        end
    end
  end

  defp start_refresh(provider, credential, from, state) do
    flow = Logins.flow(provider)

    # function_exported?/3 is false for a module not loaded yet.
    if flow && Code.ensure_loaded?(flow) && function_exported?(flow, :refresh, 1) do
      task =
        Task.Supervisor.async_nolink(FathomCredentialsLocal.TaskSupervisor, fn ->
          flow.refresh(credential)
        end)

      Process.send_after(self(), {:refresh_timeout, task.ref}, @refresh_timeout_ms)
      refresh = %{task: task, waiters: [from]}
      {:noreply, put_in(state.refreshes[provider], refresh)}
    else
      {:reply, {:error, "Please reconnect this provider"}, state}
    end
  end

  @impl true
  def handle_info({ref, result}, state) when is_reference(ref) do
    Process.demonitor(ref, [:flush])
    {:noreply, finish(ref, result, state)}
  end

  def handle_info({:DOWN, ref, :process, _pid, _reason}, state),
    do: {:noreply, finish(ref, {:error, "Token refresh failed"}, state)}

  def handle_info({:refresh_timeout, ref}, state) do
    case find(state, ref) do
      {_provider, %{task: task}} ->
        Task.shutdown(task, :brutal_kill)
        {:noreply, finish(ref, {:error, "Token refresh timed out"}, state)}

      nil ->
        {:noreply, state}
    end
  end

  defp finish(ref, result, state) do
    case find(state, ref) do
      {provider, %{waiters: waiters}} ->
        reply =
          case result do
            {:ok, next} ->
              # A removal during the refresh wins; never resurrect it.
              if Store.get(provider) do
                Store.put(provider, next)
                FathomCredentials.changed()
                {:ok, next}
              else
                :none
              end

            {:error, message} ->
              {:error, message}
          end

        Enum.each(waiters, &GenServer.reply(&1, reply))
        %{state | refreshes: Map.delete(state.refreshes, provider)}

      nil ->
        state
    end
  end

  defp find(state, ref), do: Enum.find(state.refreshes, fn {_, r} -> r.task.ref == ref end)
end
