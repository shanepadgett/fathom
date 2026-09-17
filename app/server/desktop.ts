import type { DesktopBindings, DesktopNotification } from "../sdk/desktop.ts";

import { NativeBrowserHost } from "./native-browser-host.ts";
import { loadNativeBrowser } from "./native-browser.ts";

interface DesktopWindow extends EventTarget {
  readonly windowId: number;
  focus(): void;
  close(): void;
  bind<K extends keyof DesktopBindings>(name: K, handler: DesktopBindings[K]): void;
  navigate(url: string): void;
  setTitle(title: string): void;
  setSize(width: number, height: number): void;
  setApplicationMenu(items: unknown[]): void;
  executeJs(script: string): Promise<unknown>;
}

type DesktopRuntime = typeof Deno & {
  BrowserWindow?: new (options: { title: string; width: number; height: number }) => DesktopWindow;
};

/** Process-owned window: project plugin reloads must not replace native chrome. */
export function createDesktopWindow(shutdown: () => Promise<void>) {
  const BrowserWindow = (Deno as DesktopRuntime).BrowserWindow;
  if (!BrowserWindow) return undefined;
  const window = new BrowserWindow({
    title: "Fathom",
    width: 1440,
    height: 940,
  });
  const backend = loadNativeBrowser();
  const browser = backend ? new NativeBrowserHost(backend, window.windowId) : undefined;
  console.info(`Native child browser backend: ${browser ? "available" : "unavailable"}`);
  const notifications = new Map<string, Notification>();
  let closing: Promise<void> | undefined;
  let readyToClose = false;
  function close() {
    if (closing) return closing;
    closing = (async () => {
      try {
        await shutdown();
      } catch (error) {
        console.error("Desktop shutdown failed", error);
      } finally {
        try {
          await browser?.close();
        } catch (error) {
          console.error("Native browser shutdown failed", error);
        }
        for (const notification of notifications.values()) notification.close();
        notifications.clear();
        readyToClose = true;
        window.close();
      }
    })();
    return closing;
  }
  window.bind("notificationPermission", async (request = false) => {
    if (typeof Notification === "undefined") return "denied";
    if (request) return await Notification.requestPermission();
    const status = await navigator.permissions.query({ name: "notifications" });
    return status.state === "prompt" ? "default" : status.state;
  });
  window.bind("showNotification", async (value: DesktopNotification) => {
    if (typeof Notification === "undefined") return false;
    if (!value || typeof value.title !== "string" || typeof value.body !== "string") {
      throw new Error("Invalid notification");
    }
    const target = value.target;
    if (target && (typeof target.projectId !== "string" || typeof target.sessionId !== "string")) {
      throw new Error("Invalid notification target");
    }
    const permission = await navigator.permissions.query({
      name: "notifications",
    });
    if (permission.state !== "granted") return false;
    const tag = target ? `fathom:${target.projectId}:${target.sessionId}` : "fathom-preview";
    notifications.get(tag)?.close();
    if (notifications.size >= 64) {
      const oldest = notifications.entries().next().value!;
      oldest[1].close();
      notifications.delete(oldest[0]);
    }
    const notification = new Notification(value.title.slice(0, 200), {
      body: value.body.slice(0, 2000),
      tag,
      silent: true,
    });
    notifications.set(tag, notification);
    console.info("Desktop notification requested");
    notification.addEventListener("show", () => console.info("Desktop notification shown"));
    notification.addEventListener("error", () => console.error("Desktop notification failed"));
    notification.addEventListener("close", () => {
      if (notifications.get(tag) === notification) notifications.delete(tag);
    });
    notification.addEventListener("click", () => {
      window.focus();
      notification.close();
      if (target) {
        void window
          .executeJs(
            `globalThis.dispatchEvent(new CustomEvent("fathom:notification", {detail: ${JSON.stringify(
              target,
            )}}))`,
          )
          .catch(console.error);
      }
    });
    return true;
  });
  window.setTitle("Fathom");
  window.setSize(1440, 940);
  const command = (label: string, id: string, accelerator: string) => ({
    item: { label, id, accelerator, enabled: true },
  });
  window.setApplicationMenu([
    {
      submenu: {
        label: "Fathom",
        items: [
          command("Settings…", "settings", "CmdOrCtrl+,"),
          "separator",
          command("Quit Fathom", "quit", "CmdOrCtrl+Q"),
        ],
      },
    },
    {
      submenu: {
        label: "File",
        items: [
          command("New Session", "new-session", "CmdOrCtrl+N"),
          command("Open Project…", "open-project", "CmdOrCtrl+O"),
        ],
      },
    },
    {
      submenu: {
        label: "Edit",
        items: [
          { role: { role: "undo" } },
          { role: { role: "redo" } },
          "separator",
          ...["cut", "copy", "paste", "selectAll"].map((role) => ({
            role: { role },
          })),
        ],
      },
    },
    {
      submenu: {
        label: "View",
        items: [
          command("Command Palette", "commands", "CmdOrCtrl+K"),
          command("Toggle Terminal", "terminal", "CmdOrCtrl+J"),
          command("Toggle Inspector", "inspector", "CmdOrCtrl+I"),
        ],
      },
    },
  ]);
  window.addEventListener("menuclick", (event) => {
    const id = (event as CustomEvent<{ id: string }>).detail.id;
    if (id === "quit") {
      close();
      return;
    }
    void window.executeJs(
      `globalThis.dispatchEvent(new CustomEvent("fathom:desktop-command", {detail: ${JSON.stringify(
        id,
      )}}))`,
    );
  });
  window.addEventListener("close", (event) => {
    if (readyToClose) return;
    event.preventDefault();
    close();
  });
  return {
    navigate: (url: string) => window.navigate(url),
    close,
    browser,
    windowId: window.windowId,
  };
}
