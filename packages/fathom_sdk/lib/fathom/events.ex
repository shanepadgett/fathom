defmodule Fathom.Events do
  @moduledoc """
  Publish and subscribe across plugins on the harness's `Phoenix.PubSub`.

  Name topics after your plugin, such as `"llm:checks"`, and document the
  messages in your contract module.
  """

  @pubsub Fathom.PubSub

  @spec subscribe(String.t()) :: :ok | {:error, term()}
  def subscribe(topic), do: Phoenix.PubSub.subscribe(@pubsub, topic)

  @spec unsubscribe(String.t()) :: :ok
  def unsubscribe(topic), do: Phoenix.PubSub.unsubscribe(@pubsub, topic)

  @spec broadcast(String.t(), term()) :: :ok | {:error, term()}
  def broadcast(topic, message), do: Phoenix.PubSub.broadcast(@pubsub, topic, message)
end
