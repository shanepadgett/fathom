/** Keep each preview's sidebar toggle scoped to its own workspace. */
document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLButtonElement>("[data-sidebar-toggle]");
  const sidebar = button
    ?.closest("[data-workspace]")
    ?.querySelector<HTMLElement>("[data-workspace-body] > aside");
  if (!button || !sidebar) return;
  sidebar.hidden = !sidebar.hidden;
  button.setAttribute("aria-expanded", String(!sidebar.hidden));
  const label = sidebar.hidden ? "Open sidebar" : "Close sidebar";
  button.setAttribute("aria-label", label);
  button.title = label;
});
