const patch = [
  "diff --git a/greeting.txt b/greeting.txt",
  "--- a/greeting.txt",
  "+++ b/greeting.txt",
  "@@ -1 +1 @@",
  "-Hello",
  "+Hello, Fathom",
].join("\n");

export default {
  activate(host) {
    return host.registerView({
      id: "example:diff-view",
      title: "Diff example",
      slot: "inspector",
      mount(element) {
        const actionElement = document.createElement("div");
        const diffElement = document.createElement("div");
        element.append(actionElement, diffElement);
        let showing = true;
        const diff = host.ui.getComponent("fathom.diff")(diffElement, host, {
          patch,
        });
        const props = () => ({
          label: showing ? "Clear preview" : "Show preview",
          variant: "secondary",
          onClick() {
            showing = !showing;
            diff.update({ patch: showing ? patch : "" });
            button.update(props());
          },
        });
        const button = host.ui.getComponent("fathom.button")(actionElement, host, props());
        return async () => {
          await button.dispose();
          await diff.dispose();
          element.replaceChildren();
        };
      },
    });
  },
};
