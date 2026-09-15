export default {
  activate(host) {
    let active = true;
    let busy = false;
    const unregister = host.registerCommand({
      id: "example:workspace-info",
      title: "Show workspace information",
      shortcut: "Mod+Shift+U",
      async run() {
        if (busy) return;
        busy = true;
        try {
          const info = await host.request("example.workspaceInfo");
          if (active) {
            host.toast(
              `${info.name} · ${info.sessions} sessions · ${
                info.trusted ? "Trusted" : "Restricted"
              }\n${info.path}`,
            );
          }
        } catch (error) {
          if (active) {
            host.toast(
              `Workspace information failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        } finally {
          busy = false;
        }
      },
    });
    return () => {
      active = false;
      unregister();
    };
  },
};
