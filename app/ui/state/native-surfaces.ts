import { createEffect, createSignal, onCleanup } from "solid-js";

const [occlusions, setOcclusions] = createSignal(0);

export const nativeSurfacesOccluded = () => occlusions() > 0;

/** Native child views sit above DOM content; shared overlays suspend them. */
export function occludeNativeSurfaces(active: () => boolean = () => true) {
  createEffect(() => {
    if (!active()) return;
    setOcclusions((count) => count + 1);
    onCleanup(() => setOcclusions((count) => count - 1));
  });
}
