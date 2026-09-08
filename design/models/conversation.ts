import type { Tone } from "../primitives/tone.ts";

export type MessageBlock =
  | { kind: "prose"; text: string }
  | { kind: "tool"; label: string; duration: string; files: string[] }
  | { kind: "changes"; description: string }
  | { kind: "status"; text: string; tone: Tone };

export interface Message {
  author: string;
  time: string;
  agent?: boolean;
  blocks: MessageBlock[];
}
