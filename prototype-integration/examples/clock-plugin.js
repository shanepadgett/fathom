// An external module needs no build, SDK import, or edits to the host.
export default {
  id: "external-clock",
  apiVersion: 1,
  requires: ["tools"],
  activate(ctx) {
    ctx.effect(() =>
      ctx.get("tools").register({
        name: "clock",
        description: "Read the current UTC date and time.",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        execute: () => Promise.resolve(new Date().toISOString()),
      })
    );
  },
};
