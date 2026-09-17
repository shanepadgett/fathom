import type { BrowserEvent, BrowserTransport } from "./connection.ts";

import { join } from "node:path";

import { BrowserProtocol } from "./protocol.ts";

export class BrowserConnection implements BrowserTransport {
  private process?: Deno.ChildProcess;
  private socket?: WebSocket;
  private protocol: BrowserProtocol;
  private disposed = false;
  private profile = "";

  get closed() {
    return this.disposed || this.protocol.closed;
  }

  constructor(
    private home: string,
    event: BrowserEvent,
  ) {
    this.protocol = new BrowserProtocol((message) => {
      if (this.socket?.readyState !== WebSocket.OPEN) {
        throw new Error("Browser is not connected");
      }
      this.socket.send(message);
    }, event);
  }

  async start() {
    if (this.disposed) throw new Error("Browser is closed");
    const candidates = [
      Deno.env.get("FATHOM_BROWSER"),
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/usr/bin/chromium",
      "/usr/bin/google-chrome",
    ].filter(Boolean) as string[];
    let executable: string | undefined;
    for (const candidate of candidates) {
      try {
        await Deno.stat(candidate);
        executable = candidate;
        break;
      } catch {
        /* Try next installed browser. */
      }
    }
    if (!executable) {
      throw new Error(
        "Install Chrome or Chromium, or set FATHOM_BROWSER to its executable, to use the integrated browser",
      );
    }
    this.profile = join(this.home, "browser", crypto.randomUUID());
    await Deno.mkdir(this.profile, { recursive: true, mode: 0o700 });
    if (this.disposed) throw new Error("Browser is closed");
    this.process = new Deno.Command(executable, {
      args: [
        "--headless=new",
        "--remote-debugging-port=0",
        "--remote-debugging-address=127.0.0.1",
        `--user-data-dir=${this.profile}`,
        "--no-first-run",
        "--no-default-browser-check",
        "about:blank",
      ],
      stdout: "null",
      stderr: "null",
    }).spawn();
    let port: string | undefined;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (this.disposed) throw new Error("Browser is closed");
      try {
        port = (await Deno.readTextFile(join(this.profile, "DevToolsActivePort"))).split("\n")[0];
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    if (!port) {
      await this.dispose();
      throw new Error("Browser startup timed out");
    }
    const targets = (await (
      await fetch(`http://127.0.0.1:${port}/json/list`, {
        signal: AbortSignal.timeout(10_000),
      })
    ).json()) as { type: string; webSocketDebuggerUrl: string }[];
    const target = targets.find((target) => target.type === "page");
    if (!target) throw new Error("Browser did not create a page");
    if (this.disposed) throw new Error("Browser is closed");
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    this.socket = socket;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Browser connection timed out")), 10_000);
      socket.onopen = () => {
        clearTimeout(timer);
        resolve();
      };
      socket.onerror = () => {
        clearTimeout(timer);
        reject(new Error("Browser connection failed"));
      };
      socket.onmessage = (event) => {
        try {
          this.protocol.receive(String(event.data));
        } catch (error) {
          this.protocol.close(
            error instanceof Error ? error : new Error("Invalid browser message"),
          );
          socket.close();
        }
      };
      socket.onclose = () => {
        clearTimeout(timer);
        const error = new Error("Browser closed");
        this.protocol.close(error);
        reject(error);
      };
    });
    await this.call("Page.enable");
    await this.call("Runtime.enable");
    await this.call("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });
  }

  call(method: string, params: Record<string, unknown> = {}) {
    return this.protocol.call(method, params);
  }

  navigate(url: string) {
    return this.protocol.navigate(url);
  }

  async dispose() {
    this.disposed = true;
    this.protocol.close();
    this.socket?.close();
    if (this.process) {
      const process = this.process;
      const timer = setTimeout(() => {
        try {
          process.kill("SIGKILL");
        } catch {
          /* Already closed. */
        }
      }, 3000);
      try {
        process.kill("SIGTERM");
        await process.status;
      } catch {
        /* Already closed. */
      } finally {
        clearTimeout(timer);
        this.process = undefined;
      }
    }
    if (this.profile) {
      await Deno.remove(this.profile, { recursive: true }).catch(() => {});
    }
  }
}
