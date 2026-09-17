import type { Message } from "@earendil-works/pi-ai";

export type SessionStatus = "idle" | "running" | "error";

export type SurfaceId = "agent" | "editor" | "chat";

export interface Session {
  id: string;
  title: string;
  provider: string;
  model: string;
  status: SessionStatus;
  createdAt: number;
  updatedAt: number;
}

export interface SessionSnapshot extends Session {
  messages: Message[];
}

export interface ModelChoice {
  provider: string;
  id: string;
  name: string;
}

export interface Surface {
  id: SurfaceId;
  label: string;
}

export interface FileEntry {
  id: string;
  name: string;
  kind: "file" | "directory";
  children?: FileEntry[];
}
