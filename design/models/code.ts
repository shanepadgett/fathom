import type { Tone } from "../primitives/tone.ts";

export interface CodeLine {
  tokens: (string | { text: string; tone: Tone })[];
  added?: boolean;
}
