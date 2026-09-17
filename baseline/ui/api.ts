import type { FileEntry, ModelChoice, Session, SessionSnapshot, Surface } from "../types.ts";

export async function surfaces() {
  return request<Surface[]>("/api/surfaces");
}

export async function models() {
  return request<ModelChoice[]>("/api/models");
}

export async function sessions() {
  return request<Session[]>("/api/sessions");
}

export async function createSession() {
  return request<Session>("/api/sessions", { method: "POST", body: "{}" });
}

export async function snapshot(id: string) {
  return request<SessionSnapshot>(`/api/sessions/${id}`);
}

export async function send(id: string, text: string) {
  return request<SessionSnapshot>(`/api/sessions/${id}/messages`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function stop(id: string) {
  return request<{ ok: boolean }>(`/api/sessions/${id}/stop`, {
    method: "POST",
  });
}

export async function chooseModel(id: string, choice: { provider: string; model: string }) {
  return request<Session>(`/api/sessions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(choice),
  });
}

export async function tree() {
  return request<FileEntry[]>("/api/workspace/tree");
}

export async function file(path: string) {
  return request<{ path: string; text: string }>(
    `/api/workspace/file?path=${encodeURIComponent(path)}`,
  );
}

export function follow(id: string, onUpdate: (state: SessionSnapshot) => void) {
  const source = new EventSource(`/api/sessions/${id}/live`);
  source.onmessage = (event) => {
    onUpdate(JSON.parse(event.data));
  };
  return () => source.close();
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? response.statusText);
  return body;
}
