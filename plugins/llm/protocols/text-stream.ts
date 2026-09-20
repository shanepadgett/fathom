import { readSse, request } from "@fathom/sdk";

export interface TextFrame {
  text?: string;
  done?: boolean;
}

export interface ProtocolEndpoint {
  baseUrl: string;
  headers: Record<string, string>;
}

export interface TextInput {
  model: string;
  prompt: string;
}

export async function* streamProtocol(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal: AbortSignal,
  decodeFrame: (data: unknown) => TextFrame,
): AsyncIterable<string> {
  const response = await request(
    url,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    },
    signal,
  );

  if (!response.body) {
    throw new Error("Provider returned no stream");
  }

  let complete = false;

  for await (const frame of readSse(response.body)) {
    signal.throwIfAborted();

    if (frame.data === "[DONE]") {
      complete = true;
      break;
    }

    const value = decodeFrame(JSON.parse(frame.data));

    if (value.text !== undefined) {
      yield value.text;
    }

    if (value.done) {
      complete = true;
      break;
    }
  }

  if (!complete) {
    throw new Error("Provider stream ended before completion");
  }
}
