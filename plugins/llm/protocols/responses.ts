import { decode, T } from "@fathom/sdk";
import {
  streamProtocol,
  type ProtocolEndpoint,
  type TextInput,
  type TextFrame,
} from "./text-stream.ts";

const ResponseFrame = T.Object({
  type: T.Optional(T.String()),
  delta: T.Optional(T.String()),
  error: T.Optional(T.Unknown()),
  response: T.Optional(T.Object({ status: T.Optional(T.String()) })),
});

function decodeResponseFrame(data: unknown): TextFrame {
  const frame = decode(ResponseFrame, data);

  if (
    frame.error ||
    ["error", "response.failed", "response.incomplete"].includes(
      frame.type ?? "",
    )
  ) {
    throw new Error(
      "Provider could not finish the response. Check model access and account limits.",
    );
  }

  const done =
    frame.type === "response.completed" || frame.type === "response.done";

  if (done && frame.response?.status && frame.response.status !== "completed") {
    throw new Error("Provider response did not complete");
  }

  return {
    text: frame.type === "response.output_text.delta" ? frame.delta : undefined,
    done,
  };
}

export function streamResponses(
  endpoint: ProtocolEndpoint,
  input: TextInput,
  signal: AbortSignal,
): AsyncIterable<string> {
  return streamProtocol(
    `${endpoint.baseUrl}/responses`,
    endpoint.headers,
    {
      model: input.model,
      stream: true,
      store: false,
      instructions: "You are a helpful assistant.",
      input: [
        { role: "user", content: [{ type: "input_text", text: input.prompt }] },
      ],
    },
    signal,
    decodeResponseFrame,
  );
}
