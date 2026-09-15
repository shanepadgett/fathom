import type { AudioCue } from "../audio-cues.ts";

import { createSignal, For } from "solid-js";

import { playAudioCue } from "../audio-cues.ts";
import { Button, Field } from "./primitives.tsx";

const cues: { id: AudioCue; label: string }[] = [
  { id: "success", label: "Run completed" },
  { id: "approval", label: "Approval required" },
  { id: "error", label: "Run failed or interrupted" },
];

export function AudioSettings(props: {
  enabled: boolean;
  volume: number;
  cues?: Partial<Record<AudioCue, boolean>>;
  setEnabled(value: boolean): void;
  setVolume(value: number): void;
  setCues(value: Partial<Record<AudioCue, boolean>>): void;
}) {
  const [playing, setPlaying] = createSignal<AudioCue>();
  async function preview(cue: AudioCue) {
    if (playing()) return;
    setPlaying(cue);
    try {
      await playAudioCue(cue, props.volume);
    } finally {
      setPlaying(undefined);
    }
  }
  return (
    <div class="mb-4">
      <label class="mb-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={props.enabled}
          onChange={(event) => props.setEnabled(event.currentTarget.checked)}
        />
        Play sounds
      </label>
      <For each={cues}>
        {(cue) => (
          <div class="flex items-center justify-between gap-3 py-1 text-sm">
            <label class="flex items-center gap-2">
              <input
                type="checkbox"
                disabled={!props.enabled}
                checked={props.cues?.[cue.id] !== false}
                onChange={(event) =>
                  props.setCues({
                    ...props.cues,
                    [cue.id]: event.currentTarget.checked,
                  })}
              />
              {cue.label}
            </label>
            <Button
              disabled={!!playing() || props.volume <= 0}
              aria-label={`Preview ${cue.label.toLowerCase()} sound`}
              onClick={() => void preview(cue.id)}
            >
              {playing() === cue.id ? "Playing…" : "Preview"}
            </Button>
          </div>
        )}
      </For>
      <Field label="Sound volume">
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={props.volume}
          onInput={(event) =>
            props.setVolume(event.currentTarget.valueAsNumber)}
        />
      </Field>
    </div>
  );
}
