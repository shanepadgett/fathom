/** Allows a 4 MB editor document even when JSON escapes every byte. */
export const MAX_RPC_REQUEST_BYTES = 25_000_000;

/** A slow connection is closed rather than silently dropping responses/events. */
export const MAX_RPC_BUFFER_BYTES = 32_000_000;
