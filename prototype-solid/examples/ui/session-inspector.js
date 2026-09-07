export default {
  id: "example.session-inspector",
  activate(host) {
    return host.registerView("session-inspector", {
      title: "Session inspector",
      slot: "rail",
      mount(container) {
        const heading = document.createElement("h3");
        heading.textContent = "Session inspector";
        const value = document.createElement("pre");
        container.append(heading, value);
        return host.state.subscribe(({ bootstrap }) => {
          value.textContent = bootstrap
            ? `${bootstrap.session.id}\n${bootstrap.session.messages.length} messages`
            : "Loading…";
        });
      },
    });
  },
};
