export default {
  id: "example:workspace-info",
  apiVersion: 1,
  frontend: "./workspace-info/view.js",
  backend: {
    requires: ["workspace", "storage", "tools", "rpc"],
    activate(ctx) {
      const workspace = ctx.get("workspace");
      const storage = ctx.get("storage");
      const readInfo = () => ({
        name: workspace.root.split(/[\\/]/).filter(Boolean).pop() ??
          workspace.root,
        path: workspace.root,
        trusted: workspace.trusted(),
        sessions: storage.listSessions().length,
      });

      ctx.effect(() =>
        ctx.get("tools").register({
          name: "workspace_info",
          description: "Read workspace information and session count.",
          readOnly: true,
          parameters: { type: "object", properties: {} },
          execute: async () => JSON.stringify(readInfo()),
        })
      );
      ctx.effect(() =>
        ctx.get("rpc").register("example.workspaceInfo", readInfo)
      );
    },
  },
};
