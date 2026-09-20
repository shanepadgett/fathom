const MAX_BUFFER_TEXT_LENGTH = 4 * 1024 * 1024;

/**
 * Yield blank-line-terminated SSE data frames, without JSON decoding or reconnects.
 * An unfinished trailing frame is dropped. Closing iteration cancels the reader.
 */
export async function* readSse(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<{ event: string; data: string; id?: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "message";
  let data: string[] = [];
  let id: string | undefined;

  function line(line: string) {
    if (line === "") {
      const item = data.length
        ? { event, data: data.join("\n"), id }
        : undefined;

      event = "message";
      data = [];
      id = undefined;

      return item;
    }

    if (line.startsWith(":")) {
      return;
    }

    const at = line.indexOf(":");
    const field = at < 0 ? line : line.slice(0, at);
    let value = at < 0 ? "" : line.slice(at + 1);

    if (value.startsWith(" ")) {
      value = value.slice(1);
    }

    if (field === "data") {
      data.push(value);
    }

    if (field === "event") {
      event = value;
    }

    if (field === "id") {
      id = value;
    }
  }

  try {
    while (true) {
      const chunk = await reader.read();

      if (chunk.done) {
        break;
      }

      buffer += decoder.decode(chunk.value, { stream: true });

      if (buffer.length > MAX_BUFFER_TEXT_LENGTH) {
        throw new Error("SSE frame too large");
      }

      let match: RegExpExecArray | null;

      while ((match = /\r\n|\n|\r(?!$)/.exec(buffer))) {
        const item = line(buffer.slice(0, match.index));
        buffer = buffer.slice(match.index + match[0].length);

        if (item) {
          yield item;
        }
      }
    }
  } finally {
    // A failed or cancelled source may reject cancellation too; keep the read error.
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
