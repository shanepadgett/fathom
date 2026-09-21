import type { Accessor } from "solid-js";
import { defineService, type ServiceToken } from "../service.ts";

export type ThemePreference = "system" | "light" | "dark";
export type MotionPreference = "system" | "reduce";

export interface AppearanceApi {
  theme: Accessor<ThemePreference>;
  motion: Accessor<MotionPreference>;
  error: Accessor<string>;
  setTheme(value: ThemePreference): void;
  setMotion(value: MotionPreference): void;
}

export const Appearance: ServiceToken<AppearanceApi> = defineService(
  "fathom.ui.appearance",
);
