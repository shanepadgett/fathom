import type { ContinuationData } from "./types.ts";

export function compatibleContinuation(
  continuation: ContinuationData | undefined,
  provider: string,
  model: string,
): unknown {
  return continuation?.provider === provider && continuation.model === model
    ? continuation.value
    : undefined;
}
