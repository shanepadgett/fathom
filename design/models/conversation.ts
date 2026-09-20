import type { Tone } from "../primitives/tone.ts";

export interface ToolOperation {
  action: "read" | "edited" | "written";
  files: string[];
}

export type MessageBlock =
  | { kind: "prose"; text: string }
  | { kind: "tool-summary"; operations: ToolOperation[] }
  | { kind: "tool"; label: string; duration: string; files: string[] }
  | { kind: "research"; label: string; duration: string; detail: string }
  | { kind: "changes"; description: string }
  | { kind: "status"; text: string; tone: Tone };

export type MessageAttachment =
  | { kind: "file"; name: string; detail: string }
  | { kind: "image"; name: string; detail: string; src: string; alt: string };

export interface Message {
  author: string;
  time: string;
  agent?: boolean;
  model?: string;
  edited?: boolean;
  working?: boolean;
  collapsible?: boolean;
  attachments?: MessageAttachment[];
  annotationCount?: number;
  blocks: MessageBlock[];
}
