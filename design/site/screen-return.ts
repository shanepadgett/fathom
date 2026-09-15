/** Keep the return control anchored while revealing it near the pointer. */
export function setupScreenReturn() {
  const control = document.querySelector<HTMLElement>(".viewer-screen-return");
  if (!control) return;

  const controller = new AbortController();
  const { signal } = controller;
  let introductory = true;
  let nearby = false;
  const update = () => {
    control.toggleAttribute("data-revealed", introductory || nearby);
  };
  const timer = setTimeout(() => {
    introductory = false;
    update();
  }, 3000);

  update();

  globalThis.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "touch") return;
      // Measure the stationary wrapper, never the animated link.
      const bounds = control.getBoundingClientRect();
      const margin = bounds.height;
      nearby = event.clientX >= bounds.left - margin &&
        event.clientX <= bounds.right + margin &&
        event.clientY >= bounds.top - margin;
      update();
    },
    { signal },
  );

  const reset = () => {
    nearby = false;
    update();
  };
  document.documentElement.addEventListener("pointerleave", reset, { signal });
  globalThis.addEventListener("blur", reset, { signal });
  globalThis.addEventListener("resize", reset, { signal });
  globalThis.addEventListener(
    "pagehide",
    () => {
      clearTimeout(timer);
      controller.abort();
    },
    { once: true },
  );
}
