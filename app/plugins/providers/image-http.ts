import type { ImagesApi, ImagesModel, ImagesOptions } from "@earendil-works/pi-ai";

export async function imageRequest<T>(
  model: ImagesModel<ImagesApi>,
  endpoint: string,
  payload: unknown,
  options: ImagesOptions = {},
  headers: Record<string, string> = {},
): Promise<T> {
  const requestHeaders = new Headers({
    "content-type": "application/json",
    ...model.headers,
    ...headers,
  });
  for (const [name, value] of Object.entries(options.headers ?? {})) {
    if (value === null) requestHeaders.delete(name);
    else if (value !== undefined) requestHeaders.set(name, value);
  }
  const signal = AbortSignal.any([
    ...(options.signal ? [options.signal] : []),
    AbortSignal.timeout(options.timeoutMs ?? 300_000),
  ]);
  signal.throwIfAborted();
  const body = (await options.onPayload?.(payload, model)) ?? payload;
  // Fetch supplies the multipart boundary for image-edit uploads.
  if (body instanceof FormData) requestHeaders.delete("content-type");
  const response = await (options.fetch ?? fetch)(
    `${model.baseUrl.replace(/\/$/, "")}/${endpoint}`,
    {
      method: "POST",
      headers: requestHeaders,
      body: body instanceof FormData ? body : JSON.stringify(body),
      signal,
      redirect: "error",
    },
  );
  await options.onResponse?.(
    {
      status: response.status,
      headers: Object.fromEntries(response.headers),
    },
    model,
  );
  const limit = response.ok ? 90_000_000 : 16_384;
  if (Number(response.headers.get("content-length")) > limit) {
    await response.body?.cancel();
    throw new Error(`Image provider response exceeds the size limit (HTTP ${response.status})`);
  }
  const chunks: string[] = [];
  const decoder = new TextDecoder();
  let bytes = 0;
  if (response.body) {
    for await (const chunk of response.body) {
      bytes += chunk.byteLength;
      if (bytes > limit) {
        throw new Error(`Image provider response exceeds the size limit (HTTP ${response.status})`);
      }
      chunks.push(decoder.decode(chunk, { stream: true }));
    }
  }
  chunks.push(decoder.decode());
  let parsed: unknown;
  try {
    parsed = JSON.parse(chunks.join(""));
  } catch {
    throw new Error(`Image provider returned an invalid response (HTTP ${response.status})`);
  }
  if (!response.ok) {
    const error = parsed as {
      error?: { message?: unknown };
      message?: unknown;
    };
    const message = error?.error?.message ?? error?.message;
    throw new Error(
      `Image provider request failed (HTTP ${response.status})${
        typeof message === "string" ? `: ${message.slice(0, 800)}` : ""
      }`,
    );
  }
  return parsed as T;
}
