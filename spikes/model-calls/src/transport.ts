import { isJsonObject } from "./json.ts";
import { Fetch, ModelError, ModelErrorKind } from "./types.ts";

export async function postSse(
  fetch: Fetch,
  url: string,
  headers: HeadersInit,
  body: unknown,
  signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
      throw new ModelError("aborted", "Model request was aborted", { cause: error });
    }
    throw new ModelError("network", "Model request failed before a response", { cause: error });
  }
  if (!response.ok) {
    const kind: ModelErrorKind = response.status === 401 || response.status === 403
      ? "auth"
      : response.status === 429
      ? "rate-limit"
      : response.status >= 500
      ? "server"
      : "invalid-request";
    const error = await responseError(response);
    throw new ModelError(
      kind,
      error.message || `Model route returned HTTP ${response.status}`,
      {
        status: response.status,
        providerCode: error.code,
        requestId: response.headers.get("request-id") ?? response.headers.get("x-request-id") ??
          undefined,
        retryAfterMs: retryAfter(response.headers),
      },
    );
  }
  if (!response.body) throw new ModelError("protocol", "Model route returned no stream body");
  return response.body;
}

async function responseError(response: Response): Promise<{ message?: string; code?: string }> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    return {};
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!isJsonObject(parsed)) return {};
    const native = isJsonObject(parsed.error) ? parsed.error : parsed;
    const detail = errorDetail(native.detail);
    return {
      message: typeof native.message === "string" ? native.message : detail,
      code: typeof native.code === "string"
        ? native.code
        : typeof native.type === "string"
        ? native.type
        : undefined,
    };
  } catch {
    const plain = text.trim();
    return { message: plain && plain.length <= 500 ? plain : undefined };
  }
}

function errorDetail(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return undefined;
  const messages = value.flatMap((item) => {
    if (!isJsonObject(item) || typeof item.msg !== "string") return [];
    const location = Array.isArray(item.loc) ? item.loc.map(String).join(".") : undefined;
    return [location ? `${location}: ${item.msg}` : item.msg];
  });
  return messages.length ? messages.join("; ") : undefined;
}

function retryAfter(headers: Headers): number | undefined {
  const milliseconds = Number(headers.get("retry-after-ms"));
  if (Number.isFinite(milliseconds) && milliseconds >= 0) return milliseconds;
  const value = headers.get("retry-after");
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}
