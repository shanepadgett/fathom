import { boot, mintLaunchToken } from "@fathom/server";
import type { DesktopBindings } from "@fathom/sdk";

/**
 * The part of the `deno desktop` window API this shell uses. Deno ships no
 * declarations for it yet; the constructor exists only under that runtime.
 */
interface DesktopWindow {
  bind<K extends keyof DesktopBindings>(
    name: K,
    handler: DesktopBindings[K],
  ): void;
  show(): void;
  hide(): void;
  close(): void;
  reload(): void;
  openDevtools?(): void;
  setApplicationMenu(items: MenuItem[]): void;
  addEventListener(type: "close", listener: (event: Event) => void): void;
  addEventListener(
    type: "menuclick",
    listener: (event: CustomEvent<{ id: string }>) => void,
  ): void;
}

type MenuItem =
  | {
      item: {
        label: string;
        id: string;
        accelerator?: string;
        enabled: boolean;
      };
    }
  | { submenu: { label: string; items: MenuItem[] } }
  | { role: { role: string } }
  | "separator";

export type BrowserWindowConstructor = new (options: {
  title: string;
  width: number;
  height: number;
}) => DesktopWindow;

/** Defined under `deno desktop` and inside a packaged app; undefined under `deno run`. */
export function desktopRuntime(): BrowserWindowConstructor | undefined {
  return (Deno as unknown as { BrowserWindow?: BrowserWindowConstructor })
    .BrowserWindow;
}

const command = (label: string, id: string, accelerator: string): MenuItem => ({
  item: { label, id, accelerator, enabled: true },
});

const role = (name: string): MenuItem => ({ role: { role: name } });

function applicationMenu(options: { devtools: boolean }): MenuItem[] {
  const view: MenuItem[] = [command("Reload", "reload", "CmdOrCtrl+R")];

  if (options.devtools) {
    view.push(command("Toggle DevTools", "devtools", "CmdOrCtrl+Alt+I"));
  }

  return [
    {
      submenu: {
        label: "Fathom",
        items: [command("Quit Fathom", "quit", "CmdOrCtrl+Q")],
      },
    },
    {
      submenu: {
        label: "Edit",
        items: [
          role("undo"),
          role("redo"),
          "separator",
          role("cut"),
          role("copy"),
          role("paste"),
          role("selectAll"),
        ],
      },
    },
    { submenu: { label: "View", items: view } },
  ];
}

/**
 * Adopt the runtime's initial window, start the server behind it, and tie the
 * window's close to a full shutdown. The runtime navigates the window to the
 * served origin itself once the listener is ready.
 */
export async function openDesktop(
  BrowserWindow: BrowserWindowConstructor,
  options: { home: string; resources: string },
): Promise<void> {
  const window = new BrowserWindow({
    title: "Fathom",
    width: 1440,
    height: 940,
  });

  window.hide();

  // The development harness passes a token so it can call the API on our behalf.
  const launchToken = Deno.env.get("FATHOM_LAUNCH_TOKEN") ?? mintLaunchToken();
  window.bind("launchToken", () => Promise.resolve(launchToken));

  let host: Awaited<ReturnType<typeof boot>>;

  try {
    host = await boot({ ...options, launchToken, shell: "desktop" });
  } catch (error) {
    window.close();
    throw error;
  }

  console.log(`Fathom is running at ${host.origin}`);

  let closing: Promise<void> | undefined;

  const shutdown = () => {
    closing ??= host
      .close()
      .catch((error: unknown) => {
        console.error(String(error));
      })
      .finally(() => {
        window.close();
      });

    return closing;
  };

  window.setApplicationMenu(
    applicationMenu({ devtools: typeof window.openDevtools === "function" }),
  );

  window.addEventListener("menuclick", (event) => {
    switch (event.detail.id) {
      case "quit":
        void shutdown();
        break;
      case "reload":
        window.reload();
        break;
      case "devtools":
        window.openDevtools?.();
        break;
    }
  });

  window.addEventListener("close", (event) => {
    if (!closing) {
      event.preventDefault();
      void shutdown();
    }
  });

  Deno.addSignalListener("SIGINT", () => void shutdown());
  Deno.addSignalListener("SIGTERM", () => void shutdown());

  window.show();
}
