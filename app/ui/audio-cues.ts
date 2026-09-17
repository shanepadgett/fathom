export type AudioCue = "success" | "approval" | "error";

const sequences: Record<AudioCue, readonly number[]> = {
  success: [523.25, 659.25, 783.99],
  approval: [587.33, 783.99],
  error: [392, 329.63, 261.63],
};

let active: (() => void) | undefined;

export async function playAudioCue(cue: AudioCue, volume: number): Promise<void> {
  if (!Number.isFinite(volume)) return;
  const level = Math.min(1, Math.max(0, volume));
  if (level === 0 || typeof AudioContext === "undefined") return;

  active?.();
  await new Promise<void>((resolve) => {
    let context: AudioContext | undefined;
    const oscillators: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const dispose = () => {
      if (disposed) return;
      disposed = true;
      clearTimeout(timer);
      for (const oscillator of oscillators) {
        oscillator.onended = null;
        try {
          oscillator.stop();
        } catch {
          // A node may not have started when setup fails.
        }
        try {
          oscillator.disconnect();
        } catch {
          // Continue releasing the remaining resources.
        }
      }
      for (const gain of gains) {
        try {
          gain.disconnect();
        } catch {
          // Closing the context also releases its graph.
        }
      }
      try {
        // Do not await close: a suspended audio backend must not block callers.
        if (context && context.state !== "closed") {
          void context.close().catch(() => {});
        }
      } catch {
        // Audio may become unavailable during teardown.
      }
      if (active === dispose) active = undefined;
      resolve();
    };

    active = dispose;
    // Covers both an indefinitely suspended resume and stalled playback.
    timer = setTimeout(dispose, 1500);

    try {
      context = new AudioContext();
      const audio = context;
      const play = () => {
        if (disposed) return;
        try {
          if (audio.state !== "running") {
            dispose();
            return;
          }
          const notes = sequences[cue];
          const start = audio.currentTime + 0.02;
          notes.forEach((frequency, index) => {
            const oscillator = audio.createOscillator();
            oscillators.push(oscillator);
            const gain = audio.createGain();
            gains.push(gain);
            const time = start + index * 0.16;
            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(frequency, time);
            gain.gain.setValueAtTime(0, audio.currentTime);
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(level * 0.12, time + 0.02);
            gain.gain.linearRampToValueAtTime(0, time + 0.14);
            oscillator.connect(gain);
            gain.connect(audio.destination);
            if (index === notes.length - 1) oscillator.onended = dispose;
            oscillator.start(time);
            oscillator.stop(time + 0.15);
          });
        } catch {
          dispose();
        }
      };
      if (audio.state === "running") play();
      else void audio.resume().then(play, dispose);
    } catch {
      dispose();
    }
  });
}
