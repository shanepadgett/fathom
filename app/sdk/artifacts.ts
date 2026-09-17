import type { Entry } from "./session.ts";

export interface Artifact {
  id: string;
  sessionId: string;
  title: string;
  name: string;
  mime: string;
  status: "pending" | "approved" | "superseded";
  supersedes?: string;
  bytes: number;
  createdAt: number;
}

export interface ArtifactInput {
  title?: string;
  name: string;
  content: string;
  supersedes?: string;
}

export interface ArtifactService {
  create(sessionId: string, input: ArtifactInput): Promise<Artifact>;
  list(sessionId: string): Artifact[];
  read(sessionId: string, id: string): Promise<Artifact & { content: string }>;
  materialize(sessionId: string, id: string, path: string): Promise<{ path: string }>;
  approve(sessionId: string, id: string): Promise<void>;
}

export function artifactsOnBranch(entries: Entry[]): Artifact[] {
  const artifacts = entries
    .filter((entry) => entry.custom?.type === "artifact")
    .map((entry) => entry.custom!.data as Artifact);
  const superseded = new Set(artifacts.map((artifact) => artifact.supersedes));
  const approved = new Set(
    entries
      .filter((entry) => entry.custom?.type === "artifact-approval")
      .map((entry) => (entry.custom!.data as { artifactId: string }).artifactId),
  );
  return artifacts.map((artifact) => ({
    ...artifact,
    status: superseded.has(artifact.id)
      ? "superseded"
      : approved.has(artifact.id)
        ? "approved"
        : "pending",
  }));
}
