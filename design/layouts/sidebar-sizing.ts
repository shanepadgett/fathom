export const sidebarResizeBounds = { min: 180, max: 560 };

/** Leave room for the workspace content and its other visible sidebars. */
export function sidebarBounds(panel: HTMLElement) {
  const workspace = panel.closest<HTMLElement>("workspace-layout");
  let available = workspace?.clientWidth ?? innerWidth;
  if (workspace) {
    for (const sibling of panel.parentElement!.querySelectorAll<HTMLElement>(
      ":scope > workspace-sidebar",
    )) {
      if (sibling !== panel) available -= sibling.getBoundingClientRect().width;
    }
    available -= 320;
  } else available -= 80;
  const max = Math.max(1, Math.min(sidebarResizeBounds.max, available));
  return { min: Math.min(sidebarResizeBounds.min, max), max };
}
