export default {
  activate(host) {
    return host.registerView({
      id: "example:split-view",
      title: "Split-pane example",
      slot: "workspace",
      mount(element) {
        const controls = document.createElement("div");
        const splitElement = document.createElement("div");
        controls.className = "flex gap-3 p-2";
        splitElement.className = "h-64";
        element.append(controls, splitElement);
        let mode = 0;
        let width = 360;
        const first = document.createElement("div");
        const second = document.createElement("div");
        const cardElement = document.createElement("div");
        const status = document.createElement("p");
        first.className = "p-4";
        first.append(cardElement, status);
        const card = host.ui.getComponent("fathom.message-card")(cardElement, host, {
          author: "Split panes",
          createdAt: Date.now(),
          text: "Drag the divider, or focus it and use **Left/Right**, **Home/End**, or **Enter** to reset.",
        });
        const diff = host.ui.getComponent("fathom.diff")(second, host, {
          patch: "--- a/example.txt\n+++ b/example.txt\n@@ -1 +1 @@\n-Before\n+After",
        });
        const splitProps = () => ({
          first,
          second,
          label: "Example details",
          width,
          minFirst: 180,
          minSecond: 180,
          firstVisible: mode !== 2,
          secondVisible: mode !== 1,
          onResize: (value) => {
            width = value;
            status.textContent = `First pane: ${value}px`;
          },
        });
        const split = host.ui.getComponent("fathom.split-pane")(splitElement, host, splitProps());
        const buttonProps = () => ({
          label: ["Show first pane only", "Show second pane only", "Show both panes"][mode],
          variant: "secondary",
          onClick() {
            mode = (mode + 1) % 3;
            split.update(splitProps());
            button.update(buttonProps());
          },
        });
        const button = host.ui.getComponent("fathom.button")(controls, host, buttonProps());
        return async () => {
          await button.dispose();
          await card.dispose();
          await diff.dispose();
          await split.dispose();
          element.replaceChildren();
        };
      },
    });
  },
};
