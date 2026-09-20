/** The viewer owns the document theme. Storage is optional. */
export function setupViewerTheme(host: HTMLElement, signal: AbortSignal) {
  const button = host.querySelector<HTMLButtonElement>("[data-theme-toggle]")!;
  const state = host.querySelector("[data-theme-state]")!;
  const update = () => {
    const dark = document.documentElement.dataset.theme === "dark";
    state.textContent = dark ? "On" : "Off";
    button.setAttribute("aria-pressed", String(dark));
  };
  button.addEventListener(
    "click",
    () => {
      const theme = document.documentElement.dataset.theme === "dark"
        ? "light"
        : "dark";
      document.documentElement.dataset.theme = theme;
      try {
        localStorage.setItem("fathom-design-theme", theme);
      } catch {
        /* Optional persistence. */
      }
      update();
    },
    { signal },
  );
  update();
}
