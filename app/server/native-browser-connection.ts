import type { BrowserEvent, BrowserTransport } from "../plugins/browser/connection.ts";
import type { BrowserViewport } from "../sdk/browser.ts";
import type { NativeBrowserHost } from "./native-browser-host.ts";

import { BrowserProtocol } from "../plugins/browser/protocol.ts";

type Child = Awaited<ReturnType<NativeBrowserHost["create"]>>;

/** CDP and the visible surface share one native child and one lifetime. */
export class NativeBrowserConnection implements BrowserTransport {
  private child?: Child;
  private protocol: BrowserProtocol;
  private timer?: ReturnType<typeof setTimeout>;
  private disposed = false;
  private disposal?: Promise<void>;
  private output = new Uint8Array(64 * 1024);
  private length = new Uint32Array(1);
  private decoder = new TextDecoder("utf-8", { fatal: true });
  private size = "";
  private layoutGeneration = 0;

  get closed() {
    return this.disposed || this.protocol.closed;
  }

  constructor(
    private host: NativeBrowserHost,
    event: BrowserEvent,
  ) {
    this.protocol = new BrowserProtocol((message) => {
      if (!this.child || this.disposed) {
        throw new Error("Native browser is closed");
      }
      this.child.send(message);
    }, event);
  }

  async start() {
    if (this.disposed) throw new Error("Native browser is closed");
    const child = await this.host.create();
    if (this.disposed) {
      await child.dispose();
      throw new Error("Native browser closed during creation");
    }
    this.child = child;
    this.pump();
    await this.call("Page.enable");
    await this.call("Runtime.enable");
  }

  call(method: string, params: Record<string, unknown> = {}) {
    return this.protocol.call(method, params);
  }

  navigate(url: string) {
    return this.protocol.navigate(url);
  }

  async viewport(bounds: BrowserViewport) {
    const generation = ++this.layoutGeneration;
    if (!this.child || this.disposed) return;
    // Hide immediately; do not wait for a protocol round trip over a dialog.
    if (!bounds.visible) {
      this.child.bounds(bounds.x, bounds.y, bounds.width, bounds.height, false);
      return;
    }
    const size = `${bounds.width}:${bounds.height}`;
    if (size !== this.size) {
      // Another layout can arrive while CDP is applying this one. Do not let it
      // reuse the previous dimensions while an override is still in flight.
      this.size = "";
      await this.call("Emulation.setDeviceMetricsOverride", {
        width: bounds.width,
        height: bounds.height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      if (this.disposed || generation !== this.layoutGeneration) return;
      this.size = size;
    }
    if (!this.disposed) {
      this.child?.bounds(bounds.x, bounds.y, bounds.width, bounds.height, true);
    }
  }

  dispose() {
    if (this.disposal) return this.disposal;
    this.disposed = true;
    this.layoutGeneration++;
    clearTimeout(this.timer);
    this.protocol.close();
    const child = this.child;
    this.child = undefined;
    this.disposal = child?.dispose() ?? Promise.resolve();
    return this.disposal;
  }

  private pump = () => {
    if (this.disposed || !this.child) return;
    try {
      // Bound work per event-loop turn so a busy page cannot starve app RPC.
      for (let count = 0; count < 32; count++) {
        const status = this.child.poll(this.output, this.length);
        if (status === 0) break;
        const length = this.length[0];
        if (status < 0) {
          throw new Error(`Native browser stream failed (${status})`);
        }
        if (length < 1 || length > 16 * 1024 * 1024) {
          throw new Error("Invalid native browser message size");
        }
        if (status === 2) {
          if (length <= this.output.byteLength) {
            throw new Error("Invalid native browser capacity request");
          }
          this.output = new Uint8Array(length);
          continue;
        }
        if (status !== 1 || length > this.output.byteLength) {
          throw new Error("Invalid native browser poll result");
        }
        this.protocol.receive(this.decoder.decode(this.output.subarray(0, length)));
      }
      this.timer = setTimeout(this.pump, 16);
    } catch (error) {
      this.protocol.close(error instanceof Error ? error : new Error(String(error)));
      void this.dispose().catch((failure) =>
        console.error("Native browser cleanup failed", failure),
      );
    }
  };
}
