import { definePlugin } from "../kernel/plugin.ts";
// Desktop APIs are experimental and absent from the ordinary deno.window lib.
interface NativeWindow {
  addEventListener(type: string, listener: (event: Event) => void): void;
  executeJs(script: string): Promise<unknown>;
  setApplicationMenu(menu: unknown[]): void;
  setSize(width: number, height: number): void;
  setTitle(title: string): void;
}
type DesktopDeno = typeof Deno & {
  BrowserWindow?: new (
    options: { title: string; width: number; height: number },
  ) => NativeWindow;
};
// The startup window belongs to the process and survives composition switches.
let startupWindow: NativeWindow | undefined;
export default definePlugin({
  id: "desktop-window",
  apiVersion: 1,
  activate() {
    const Window = (Deno as DesktopDeno).BrowserWindow;
    if (!Window || startupWindow) return; // The same composition can run as a local web app.
    const win = new Window({
      title: "Fathom Prototype",
      width: 1280,
      height: 860,
    });
    startupWindow = win;
    win.addEventListener(
      "close",
      () => globalThis.dispatchEvent(new Event("fathom:close")),
    );
    win.setSize(1280, 860);
    win.setTitle("Fathom Prototype");
    win.setApplicationMenu([
      {
        submenu: {
          label: "Fathom",
          items: [{ role: { role: "quit" } }],
        },
      },
      {
        submenu: {
          label: "Edit",
          items: [
            { role: { role: "undo" } },
            { role: { role: "redo" } },
            "separator",
            { role: { role: "cut" } },
            { role: { role: "copy" } },
            { role: { role: "paste" } },
            { role: { role: "selectAll" } },
          ],
        },
      },
      {
        submenu: {
          label: "View",
          items: [
            {
              item: {
                label: "Zoom In",
                id: "view.zoomIn",
                accelerator: "CmdOrCtrl+=",
                enabled: true,
              },
            },
            {
              item: {
                label: "Zoom Out",
                id: "view.zoomOut",
                accelerator: "CmdOrCtrl+-",
                enabled: true,
              },
            },
            {
              item: {
                label: "Actual Size",
                id: "view.resetZoom",
                accelerator: "CmdOrCtrl+0",
                enabled: true,
              },
            },
          ],
        },
      },
    ]);
    win.addEventListener("menuclick", (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (!id?.startsWith("view.zoom") && id !== "view.resetZoom") return;
      void win.executeJs(
        `globalThis.dispatchEvent(new CustomEvent("fathom:view-command", { detail: ${
          JSON.stringify(id)
        } }))`,
      );
    });
  },
});
