defmodule Fathom.Kernel.Graph do
  @moduledoc """
  The kernel's decisions, as pure functions over plugin records. No process,
  no side effects: given what is running and what is wanted, say what to stop
  and what to start next.

  Records are maps with `:manifest`, `:enabled`, and `:state`
  (`:stopped | :blocked | :ready | :failed`). `provided` is the set of tokens
  the harness itself provides.
  """

  @type records :: %{String.t() => map()}

  @doc "Tokens available: the harness's plus every running plugin's."
  @spec available(records(), [module()]) :: MapSet.t(module())
  def available(records, provided) do
    for {_, %{state: :ready, manifest: m}} <- records,
        token <- m.provides,
        into: MapSet.new(provided),
        do: token
  end

  @doc "Required tokens of `id` that nothing currently provides."
  @spec missing(records(), [module()], String.t()) :: [module()]
  def missing(records, provided, id) do
    available = available(records, provided)
    Enum.reject(records[id].manifest.requires, &MapSet.member?(available, &1))
  end

  @doc "Running plugins that should stop: disabled, or missing a requirement."
  @spec to_stop(records(), [module()]) :: [String.t()]
  def to_stop(records, provided) do
    for {id, %{state: :ready} = r} <- records,
        not r.enabled or missing(records, provided, id) != [],
        do: id
  end

  @doc "The next plugin to start, in id order, or nil when nothing can."
  @spec next_start(records(), [module()]) :: String.t() | nil
  def next_start(records, provided) do
    records
    |> Enum.sort_by(&elem(&1, 0))
    |> Enum.find_value(fn {id, r} ->
      if r.state in [:stopped, :blocked] and r.enabled and missing(records, provided, id) == [],
        do: id
    end)
  end

  @doc "Running plugins that require a token `id` provides."
  @spec dependents(records(), String.t()) :: [String.t()]
  def dependents(records, id) do
    provides = records[id].manifest.provides

    for {other, %{state: :ready} = r} <- records,
        other != id,
        Enum.any?(r.manifest.requires, &(&1 in provides)),
        do: other
  end

  @doc "Marks plugins that are neither running nor failed as stopped or blocked."
  @spec mark_waiting(records(), [module()]) :: records()
  def mark_waiting(records, provided) do
    Map.new(records, fn {id, r} ->
      {id,
       case r do
         %{state: s} when s in [:ready, :failed] -> r
         %{enabled: false} -> %{r | state: :stopped, waiting_on: []}
         _ -> %{r | state: :blocked, waiting_on: missing(records, provided, id)}
       end}
    end)
  end
end
