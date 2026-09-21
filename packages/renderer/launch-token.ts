import type { DesktopBindings } from "@fathom/sdk";

const STORAGE_KEY = "fathom-launch-token";

/**
 * The native shell binds the token; a browser tab receives it in the launch
 * link hash and keeps it for this tab afterwards.
 */
export async function readLaunchToken(): Promise<string | undefined> {
  const bindings = (globalThis as { bindings?: DesktopBindings }).bindings;

  if (bindings) {
    return await bindings.launchToken();
  }

  const token = new URLSearchParams(location.hash.slice(1)).get("token");

  if (token) {
    history.replaceState(null, "", location.pathname);
    sessionStorage.setItem(STORAGE_KEY, token);

    return token;
  }

  return sessionStorage.getItem(STORAGE_KEY) ?? undefined;
}

/** A launch link can navigate an existing tab; adopt its token and load the current assets. */
export function watchLaunchLink(): void {
  addEventListener("hashchange", () => {
    const token = new URLSearchParams(location.hash.slice(1)).get("token");

    if (!token) {
      return;
    }

    sessionStorage.setItem(STORAGE_KEY, token);
    history.replaceState(null, "", location.pathname);
    location.reload();
  });
}
