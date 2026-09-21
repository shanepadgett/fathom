import { createSignal, untrack } from "solid-js";
import type {
  AppearanceApi,
  MotionPreference,
  ThemePreference,
} from "@fathom/sdk/ui";

/** Host-owned presentation survives shell replacement. Preferences are browser-local. */
export function createAppearance(): AppearanceApi & { dispose(): void } {
  const [theme, setTheme] = createSignal<ThemePreference>("system");
  const [motion, setMotion] = createSignal<MotionPreference>("system");
  const [error, setError] = createSignal("");
  const dark = matchMedia("(prefers-color-scheme: dark)");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");

  const apply = () => {
    const systemTheme = dark.matches ? "dark" : "light";

    document.documentElement.dataset.theme =
      theme() === "system" ? systemTheme : theme();

    document.documentElement.dataset.reducedMotion = String(
      motion() === "reduce" || reduced.matches,
    );
  };

  const read = () => {
    try {
      const savedTheme = localStorage.getItem("fathom.theme");

      setTheme(
        savedTheme === "light" || savedTheme === "dark" ? savedTheme : "system",
      );

      setMotion(
        localStorage.getItem("fathom.motion") === "reduce"
          ? "reduce"
          : "system",
      );

      setError("");
    } catch {
      setError("Browser preferences could not be read.");
    }

    apply();
  };

  const save = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
      setError("");
    } catch {
      setError("This preference applies now, but could not be saved.");
    }

    apply();
  };

  const storage = (event: StorageEvent) => {
    if (
      event.key === null ||
      event.key === "fathom.theme" ||
      event.key === "fathom.motion"
    ) {
      read();
    }
  };

  untrack(read);
  dark.addEventListener("change", apply);
  reduced.addEventListener("change", apply);
  globalThis.addEventListener("storage", storage);

  return {
    theme,
    motion,
    error,
    setTheme(value) {
      setTheme(value);
      save("fathom.theme", value);
    },
    setMotion(value) {
      setMotion(value);
      save("fathom.motion", value);
    },
    dispose() {
      dark.removeEventListener("change", apply);
      reduced.removeEventListener("change", apply);
      removeEventListener("storage", storage);
    },
  };
}
