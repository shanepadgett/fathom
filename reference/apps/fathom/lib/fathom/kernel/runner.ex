defmodule Fathom.Kernel.Runner do
  @moduledoc """
  Starts and stops one plugin's OTP application on this node.

  This is the seam for isolation: a plugin that brings its own dependencies
  or native code will run on a peer node through a second runner with the
  same three functions. The kernel only sees a monitor reference.
  """

  @doc "Configures and starts the plugin; returns a monitor on its application master."
  @spec start(Fathom.Plugin.Manifest.t(), map()) :: {:ok, reference()} | {:error, String.t()}
  def start(%{otp_app: app}, config) do
    Application.put_env(app, :fathom_config, config)

    with {:ok, _} <- Application.ensure_all_started(app),
         master when is_pid(master) <- :application_controller.get_master(app) do
      {:ok, Process.monitor(master)}
    else
      :undefined ->
        Application.stop(app)
        {:error, "#{app} has no application callback; plugins need a supervision tree"}

      {:error, {^app, {:bad_return, _} = reason}} ->
        {:error, describe(reason)}

      {:error, reason} ->
        {:error, describe(reason)}
    end
  end

  @spec stop(Fathom.Plugin.Manifest.t(), reference()) :: :ok
  def stop(%{otp_app: app}, ref) do
    Process.demonitor(ref, [:flush])
    Application.stop(app)
    :ok
  end

  @doc "Explains why a running plugin went down."
  @spec describe(term()) :: String.t()
  def describe({app, {{:shutdown, {:failed_to_start_child, child, reason}}, _}})
      when is_atom(app),
      do: "#{inspect(child)} failed to start: #{describe(reason)}"

  def describe({:bad_return, {_mfa, {:error, reason}}}), do: describe(reason)
  def describe({:bad_return, {_mfa, {:EXIT, {reason, _stack}}}}), do: describe(reason)
  def describe(reason) when is_binary(reason), do: reason
  def describe(%{__exception__: true} = exception), do: Exception.message(exception)
  def describe(reason), do: inspect(reason)
end
