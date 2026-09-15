import { createResource, createSignal, Show } from "solid-js";

import { notificationPermission, notify } from "../notifications.ts";
import { Button } from "./primitives.tsx";

export function NotificationPermissionControl() {
  const [permission, { refetch }] = createResource(() =>
    notificationPermission()
  );
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  async function act(preview: boolean) {
    if (busy()) return;
    setBusy(true);
    setError("");
    try {
      if (preview) {
        await notify(
          "Fathom notifications",
          "Desktop notifications are enabled.",
          {
            notifications: "always",
            audio: false,
            volume: 0,
          },
        );
      } else {
        await notificationPermission(true);
      }
      await refetch();
    } catch (failure) {
      setError(
        failure && typeof failure === "object" && "message" in failure
          ? String(failure.message)
          : String(failure),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div class="mb-4 text-sm">
      <p class="text-muted" role="status">
        {permission.error
          ? "Could not read notification permission."
          : permission.loading
          ? "Checking notification permission…"
          : permission() === "granted"
          ? "Desktop notifications are enabled."
          : permission() === "denied"
          ? "Notifications are blocked. Allow Fathom in system notification settings."
          : "Allow notifications to receive desktop alerts."}
      </p>
      <Button
        disabled={busy() || permission.loading}
        onClick={() =>
          void act(!permission.error && permission() === "granted")}
      >
        {busy()
          ? "Working…"
          : !permission.error && permission() === "granted"
          ? "Send preview notification"
          : "Enable notifications"}
      </Button>
      <Show when={error()}>
        <p role="alert" class="text-danger">{error()}</p>
      </Show>
    </div>
  );
}
