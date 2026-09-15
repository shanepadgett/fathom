import type { AudioCue } from "../audio-cues.ts";
import type { Transport } from "../transport.ts";

import { createResource, createSignal, Show } from "solid-js";

import { AudioSettings } from "./audio-settings.tsx";

import { NotificationPermissionControl } from "./notification-permission.tsx";

import { Button, Field } from "./primitives.tsx";

interface Preferences {
  toolExecution: string;
  maxSteps: number;
  expertProvider: string;
  expertModel: string;
  defaultInput: string;
  notifications: string;
  audio: boolean;
  audioCues: Partial<Record<AudioCue, boolean>>;
  volume: number;
}

export function RuntimeSettings(
  props: { transport: Transport; error(error: unknown): void },
) {
  const projectId = props.transport.projectId;
  const [failure, setFailure] = createSignal("");
  const [preferences, { mutate }] = createResource(() =>
    props.transport.request<Preferences>("settings.runtime.get", { projectId })
  );
  const [saving, setSaving] = createSignal(false);
  const [saved, setSaved] = createSignal(false);
  const update = <K extends keyof Preferences>(
    key: K,
    value: Preferences[K],
  ) => {
    mutate((current) => current ? { ...current, [key]: value } : current);
    setSaved(false);
  };
  const save = async () => {
    if (saving() || preferences.error || !preferences()) return;
    setSaving(true);
    setFailure("");
    try {
      await props.transport.request("settings.runtime.set", {
        ...preferences(),
        projectId,
      });
      setSaved(true);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <section>
      <h3>Agent behavior</h3>
      <Show when={preferences.error}>
        <p class="error">Could not load agent settings.</p>
      </Show>
      <Show when={preferences.error ? undefined : preferences()}>
        {(value) => (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <fieldset disabled={saving()} class="m-0 min-w-0 border-0 p-0">
              <Field label="Tool execution">
                <select
                  value={value().toolExecution}
                  onChange={(event) =>
                    update("toolExecution", event.currentTarget.value)}
                >
                  <option value="adaptive">
                    Parallel reads, sequential changes
                  </option>
                  <option value="sequential">One tool at a time</option>
                  <option value="parallel">Parallel tools</option>
                </select>
              </Field>
              <Field label="Maximum steps per run">
                <input
                  type="number"
                  min="1"
                  max="10000"
                  required
                  value={value().maxSteps}
                  onChange={(event) =>
                    update("maxSteps", event.currentTarget.valueAsNumber)}
                />
              </Field>
              <Field label="Messages sent during a run">
                <select
                  value={value().defaultInput}
                  onChange={(event) =>
                    update("defaultInput", event.currentTarget.value)}
                >
                  <option value="steer">Steer at the next step</option>
                  <option value="follow_up">Queue for the next run</option>
                </select>
              </Field>
              <h4>Expert consultations</h4>
              <p class="muted">Leave these blank to use the session's model.</p>
              <Field label="Expert provider ID">
                <input
                  value={value().expertProvider}
                  placeholder="openai-codex"
                  onChange={(event) =>
                    update("expertProvider", event.currentTarget.value)}
                />
              </Field>
              <Field label="Expert model ID">
                <input
                  value={value().expertModel}
                  placeholder="gpt-6-astra"
                  onChange={(event) =>
                    update("expertModel", event.currentTarget.value)}
                />
              </Field>
              <h4>Notifications</h4>
              <NotificationPermissionControl />
              <Field label="Notify when work needs attention">
                <select
                  value={value().notifications}
                  onChange={(event) =>
                    update("notifications", event.currentTarget.value)}
                >
                  <option value="background_only">
                    While Fathom is in the background
                  </option>
                  <option value="always">Always</option>
                  <option value="muted">Muted</option>
                </select>
              </Field>
              <AudioSettings
                enabled={value().audio}
                volume={value().volume}
                cues={value().audioCues}
                setEnabled={(audio) => update("audio", audio)}
                setVolume={(volume) => update("volume", volume)}
                setCues={(cues) => update("audioCues", cues)}
              />
              <Show when={failure()}>
                <p role="alert" class="my-3 text-danger">{failure()}</p>
              </Show>
              <Button type="submit" variant="primary" disabled={saving()}>
                {saving() ? "Saving…" : saved() ? "Saved" : "Save preferences"}
              </Button>
            </fieldset>
          </form>
        )}
      </Show>
    </section>
  );
}
