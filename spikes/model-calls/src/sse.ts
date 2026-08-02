export interface SseEvent {
  event?: string;
  data: string;
}

export async function* parseSse(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event: string | undefined;
  let data: string[] = [];

  const line = (value: string): SseEvent | undefined => {
    if (value === "") {
      if (data.length === 0) return undefined;
      const result = { event, data: data.join("\n") };
      event = undefined;
      data = [];
      return result;
    }
    if (value.startsWith(":")) return undefined;
    const colon = value.indexOf(":");
    const field = colon < 0 ? value : value.slice(0, colon);
    let fieldValue = colon < 0 ? "" : value.slice(colon + 1);
    if (fieldValue.startsWith(" ")) fieldValue = fieldValue.slice(1);
    if (field === "event") event = fieldValue;
    if (field === "data") data.push(fieldValue);
    return undefined;
  };

  try {
    while (true) {
      if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      while (true) {
        const match = /\r\n|\r|\n/.exec(buffer);
        if (!match) break;
        const value = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const parsed = line(value);
        if (parsed) yield parsed;
      }
    }
    buffer += decoder.decode();
    if (buffer) {
      const parsed = line(buffer);
      if (parsed) yield parsed;
    }
    const parsed = line("");
    if (parsed) yield parsed;
  } finally {
    reader.releaseLock();
  }
}
