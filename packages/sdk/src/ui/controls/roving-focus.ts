/** Reference: context-menu.ts#keydown. Arrow traversal wraps; Home and End clamp. */
export function rovingFocus(
  container: HTMLElement,
  selector: string,
  orientation: "vertical" | "horizontal" = "vertical",
): () => void {
  const previous = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
  const next = orientation === "vertical" ? "ArrowDown" : "ArrowRight";

  const onKeyDown = (event: KeyboardEvent) => {
    const items = [...container.querySelectorAll<HTMLElement>(selector)];

    if (!items.length) {
      return;
    }

    const index = items.indexOf(document.activeElement as HTMLElement);
    let target: HTMLElement | undefined;

    if (event.key === "Home") {
      target = items[0];
    } else if (event.key === "End") {
      target = items[items.length - 1];
    } else if (event.key === previous) {
      target = items[(index <= 0 ? items.length : index) - 1];
    } else if (event.key === next) {
      target = items[(index + 1 + items.length) % items.length];
    }

    if (target) {
      event.preventDefault();
      target.focus();
    }
  };

  container.addEventListener("keydown", onKeyDown);

  return () => container.removeEventListener("keydown", onKeyDown);
}
