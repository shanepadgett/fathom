const VIEWPORT_MARGIN = 4;

/** Fixed-position a popover under its trigger, clamped to the viewport. */
export function anchorPosition(
  menu: HTMLElement,
  anchor: HTMLElement,
): () => void {
  const update = () => {
    const trigger = anchor.getBoundingClientRect();
    const panel = menu.getBoundingClientRect();

    const below =
      innerHeight - trigger.bottom >= panel.height ||
      trigger.top < panel.height;

    const top = below
      ? trigger.bottom + VIEWPORT_MARGIN
      : trigger.top - panel.height - VIEWPORT_MARGIN;

    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, trigger.left),
      Math.max(VIEWPORT_MARGIN, innerWidth - panel.width - VIEWPORT_MARGIN),
    );

    menu.style.top = `${Math.max(VIEWPORT_MARGIN, top)}px`;
    menu.style.left = `${left}px`;
  };

  update();
  addEventListener("scroll", update, true);
  addEventListener("resize", update);

  return () => {
    removeEventListener("scroll", update, true);
    removeEventListener("resize", update);
  };
}
