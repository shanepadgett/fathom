export default {
  activate(host) {
    let removeView;
    const close = () => {
      removeView?.();
      removeView = undefined;
    };
    const removeCommand = host.registerCommand({
      id: "example:terminal-view",
      title: "Open example terminal",
      run() {
        if (removeView) return;
        const sessionId = host.session()?.session.id;
        if (!sessionId) {
          host.toast("Select a session before opening a terminal.");
          return;
        }
        removeView = host.registerView({
          id: "example:terminal-view",
          title: "Plugin terminal",
          slot: "workspace",
          mount(element) {
            const props = () => ({
              sessionId,
              theme: document.documentElement.dataset.theme ?? "dark",
              onClose: close,
              onError: (error) => host.toast(String(error)),
            });
            const terminal = host.ui.getComponent("fathom.terminal")(
              element,
              host,
              props(),
            );
            const observer = new MutationObserver(() =>
              terminal.update(props())
            );
            observer.observe(document.documentElement, {
              attributes: true,
              attributeFilter: ["data-theme"],
            });
            return async () => {
              observer.disconnect();
              await terminal.dispose();
            };
          },
        });
      },
    });
    return () => {
      close();
      removeCommand();
    };
  },
};
