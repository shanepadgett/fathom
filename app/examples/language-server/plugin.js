// Standalone manifest: copy this file into either plugin discovery directory.
export default {
  id: "example:language-server",
  apiVersion: 1,
  frontend: "./language-server/view.js",
  backend: {
    requires: ["lsp"],
    activate(ctx) {
      ctx.effect(() =>
        ctx.get("lsp").register({
          id: "rust-analyzer",
          name: "Rust Analyzer",
          command: "rust-analyzer",
          args: [],
          languages: { ".rs": "rust" },
          initializationOptions: { checkOnSave: false },
          priority: 0,
        })
      );
    },
  },
};
