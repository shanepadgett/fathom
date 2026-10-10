defmodule Fathom.Kernel.Config do
  @moduledoc """
  Casts saved or submitted configuration, a JSON-style map with string keys,
  against a plugin's `NimbleOptions` schema. Form strings are coerced to the
  schema's scalar types.
  """

  @spec cast(keyword(), map()) :: {:ok, map()} | {:error, String.t()}
  def cast(schema, values) when is_map(values) do
    options =
      for {key, spec} <- schema,
          Map.has_key?(values, Atom.to_string(key)),
          do: {key, coerce(spec[:type], values[Atom.to_string(key)])}

    case NimbleOptions.validate(options, schema) do
      {:ok, options} -> {:ok, Map.new(options)}
      {:error, error} -> {:error, Exception.message(error)}
    end
  end

  def cast(_schema, _values), do: {:error, "configuration must be an object"}

  defp coerce(type, value)
       when type in [:integer, :pos_integer, :non_neg_integer] and is_binary(value) do
    case Integer.parse(String.trim(value)) do
      {integer, ""} -> integer
      _ -> value
    end
  end

  defp coerce(:float, value) when is_binary(value) do
    case Float.parse(String.trim(value)) do
      {float, ""} -> float
      _ -> value
    end
  end

  defp coerce(:boolean, "true"), do: true
  defp coerce(:boolean, "false"), do: false
  defp coerce(_type, value), do: value
end
