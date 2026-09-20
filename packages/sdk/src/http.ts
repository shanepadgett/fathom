import { delay } from "./delay.ts";

const DEFAULT_RETRIES = 2;
const INITIAL_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 10_000;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly retryable: boolean,
  ) {
    let guidance = "Check the request and service availability.";

    if (status === 401 || status === 403) {
      guidance = "Check authentication and access permissions.";
    } else if (status === 429) {
      guidance = "Rate limit reached. Try again shortly.";
    }

    super(`Request failed (HTTP ${status}). ${guidance}`);
  }
}

/**
 * Retry HTTP 429, 502, 503, and 504; network failures are not retried.
 * `retries` counts extra attempts. Use zero for requests unsafe to repeat.
 * Throws HttpError for final HTTP failures; the caller owns a successful body.
 * The signal cancels both requests and retry waits.
 */
export async function request(
  url: string,
  init: RequestInit,
  signal: AbortSignal,
  retries = DEFAULT_RETRIES,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();

    const response = await fetch(url, { ...init, signal });

    if (response.ok) {
      return response;
    }

    const retryable = [429, 502, 503, 504].includes(response.status);
    const retryAfter = Number(response.headers.get("retry-after"));

    await response.body?.cancel();

    if (!retryable || attempt >= retries) {
      throw new HttpError(response.status, retryable);
    }

    const retryDelayMs =
      retryAfter > 0
        ? retryAfter * 1000
        : INITIAL_RETRY_DELAY_MS * 2 ** attempt;

    await delay(Math.min(MAX_RETRY_DELAY_MS, retryDelayMs), signal);
  }
}
