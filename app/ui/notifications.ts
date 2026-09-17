import type { DesktopBindings, NotificationTarget } from "../sdk/desktop.ts";

import { type AudioCue, playAudioCue } from "./audio-cues.ts";

export interface Preferences {
  notifications: string;
  audio: boolean;
  volume: number;
  audioCues?: Partial<Record<AudioCue, boolean>>;
}

function desktop() {
  return (globalThis as typeof globalThis & { bindings?: DesktopBindings }).bindings;
}

export async function notificationPermission(request = false): Promise<NotificationPermission> {
  const bindings = desktop();
  if (bindings) return await bindings.notificationPermission(request);
  if (!("Notification" in window)) return "denied";
  return request ? await Notification.requestPermission() : Notification.permission;
}

/** Notification preferences apply equally to completion and approval requests. */
export async function notify(
  title: string,
  body: string,
  preferences: Preferences,
  target?: NotificationTarget,
  cue: AudioCue = "success",
) {
  if (preferences.notifications === "muted") return;
  if (
    preferences.notifications === "background_only" &&
    document.visibilityState === "visible" &&
    document.hasFocus()
  )
    return;
  const sound =
    preferences.audio && preferences.audioCues?.[cue] !== false
      ? playAudioCue(cue, preferences.volume)
      : Promise.resolve();
  try {
    const bindings = desktop();
    if (bindings) {
      await bindings.showNotification({ title, body, target });
    } else if ("Notification" in window && Notification.permission === "granted") {
      const notification = new Notification(title, {
        body,
        tag: target ? `fathom:${target.projectId}:${target.sessionId}` : "fathom-preview",
        silent: true,
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
        if (target) {
          window.dispatchEvent(new CustomEvent("fathom:notification", { detail: target }));
        }
      };
    }
  } finally {
    await sound;
  }
}
