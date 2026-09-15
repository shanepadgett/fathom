export default {
  id: "example:artifact-catalog",
  apiVersion: 1,
  backend: {
    requires: ["artifacts", "tools"],
    activate(ctx) {
      const artifacts = ctx.get("artifacts");
      ctx.effect(() =>
        ctx.get("tools").register({
          name: "artifact_catalog",
          description:
            "List artifacts and revision status on this conversation branch.",
          readOnly: true,
          parameters: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          execute: async (_args, input) =>
            JSON.stringify(await artifacts.list(input.sessionId)),
        })
      );
    },
  },
};
