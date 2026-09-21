import { encodeBase64Url } from "@std/encoding/base64url";

const LAUNCH_TOKEN_BYTES = 32;

/** A per-process bearer secret, safe to place in a URL fragment. */
export function mintLaunchToken(): string {
  return encodeBase64Url(
    crypto.getRandomValues(new Uint8Array(LAUNCH_TOKEN_BYTES)),
  );
}
