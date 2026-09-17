export default {
  activate(host) {
    return host.registerView({
      id: "example:connection-controls",
      title: "Connection controls example",
      slot: "inspector",
      mount(element) {
        const actions = document.createElement("div");
        let enabled = false;
        const rowProps = () => ({
          name: "Example connection",
          status: enabled ? "Preview enabled" : "Preview disabled",
          avatar: "E",
          actions,
        });
        const row = host.ui.getComponent("fathom.connection-row")(element, host, rowProps());
        const buttonProps = () => ({
          name: enabled ? "check" : "plus",
          label: "Toggle connection preview",
          pressed: enabled,
          onClick() {
            enabled = !enabled;
            row.update(rowProps());
            button.update(buttonProps());
          },
        });
        const button = host.ui.getComponent("fathom.icon-button")(actions, host, buttonProps());
        return async () => {
          await button.dispose();
          await row.dispose();
        };
      },
    });
  },
};
