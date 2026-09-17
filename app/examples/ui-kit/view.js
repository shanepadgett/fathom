export default {
  activate(host) {
    return host.registerView({
      id: "example:ui-kit",
      title: "UI kit example",
      slot: "inspector",
      mount(element) {
        element.classList.add("space-y-4");
        const fieldElement = document.createElement("div");
        const buttonElement = document.createElement("div");
        const messageElement = document.createElement("div");
        element.append(fieldElement, buttonElement, messageElement);
        const createdAt = Date.now();
        const message = host.ui.getComponent("fathom.message-card")(messageElement, host, {
          author: "UI kit",
          agent: true,
          createdAt,
          text: "Enter a name to update this **shared message card**.",
        });
        let name = "";
        const buttonProps = () => ({
          label: name.trim() ? `Greet ${name.trim()}` : "Enter a name",
          variant: "primary",
          disabled: !name.trim(),
          onClick: () =>
            message.update({
              author: "UI kit",
              agent: true,
              createdAt,
              text: `Hello, ${name.trim()}.`,
            }),
        });
        const button = host.ui.getComponent("fathom.button")(buttonElement, host, buttonProps());
        const field = host.ui.getComponent("fathom.text-field")(fieldElement, host, {
          label: "Name",
          value: name,
          hint: "This plugin uses Fathom's shared field and button.",
          onInput(value) {
            name = value;
            button.update(buttonProps());
          },
        });
        return async () => {
          await field.dispose();
          await button.dispose();
          await message.dispose();
          element.replaceChildren();
          element.classList.remove("space-y-4");
        };
      },
    });
  },
};
