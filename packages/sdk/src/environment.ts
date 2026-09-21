import { defineService, type ServiceToken } from "./service.ts";

export const AppEnvironment: ServiceToken<{
  home: string;
  resources: string;
  platform: string;
  /** Loopback origin the page is served from. */
  origin: string;
  launchToken: string;
  /** A native window or a browser tab. */
  shell: "desktop" | "browser";
  /** Open a URL in the user's default browser, outside the app window. */
  openExternal(url: string): Promise<void>;
}> = defineService("fathom.environment");
