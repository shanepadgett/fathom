import { decode, T } from "@fathom/sdk";
import {
  streamProtocol,
  type ProtocolEndpoint,
  type TextInput,
  type TextFrame,
} from "./text-stream.ts";

const MAX_OUTPUT_TOKENS = 2048;

const MessageFrame = T.Object({
  type: T.Optional(T.String()),
  error: T.Optional(T.Unknown()),
  delta: T.Optional(
    T.Object({ type: T.Optional(T.String()), text: T.Optional(T.String()) }),
  ),
});

function decodeMessageFrame(data: unknown): TextFrame {
  const frame = decode(MessageFrame, data);

  if (frame.error || frame.type === "error") {
    throw new Error(
      "Provider could not finish the response. Check model access and account limits.",
    );
  }

  return {
    text:
      frame.type === "content_block_delta" && frame.delta?.type === "text_delta"
        ? frame.delta.text
        : undefined,
    done: frame.type === "message_stop",
  };
}

export function streamMessages(
  endpoint: ProtocolEndpoint,
  input: TextInput,
  signal: AbortSignal,
): AsyncIterable<string> {
  return streamProtocol(
    `${endpoint.baseUrl}/messages`,
    endpoint.headers,
    {
      model: input.model,
      max_tokens: MAX_OUTPUT_TOKENS,
      stream: true,
      messages: [{ role: "user", content: input.prompt }],
    },
    signal,
    decodeMessageFrame,
  );
}
