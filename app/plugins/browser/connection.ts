import type { BrowserViewport } from "../../sdk/browser.ts";

export type BrowserEvent = (
  name: string,
  params: Record<string, unknown>,
) => void;

/** Browser behavior shared by native children and the standalone web host. */
export interface BrowserTransport {
  readonly closed?: boolean;
  viewport?(bounds: BrowserViewport): Promise<void>;
  start(): Promise<void>;
  call(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  navigate(url: string): Promise<void>;
  dispose(): Promise<void>;
}

export type BrowserFactory = (
  event: BrowserEvent,
) => BrowserTransport | undefined;
