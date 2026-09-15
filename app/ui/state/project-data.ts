import type {
  Project,
  Session,
  SessionState,
  UsageRecord,
} from "../../sdk/session.ts";
import type { ModelChoice } from "../../sdk/models.ts";
import type { WorkspaceLayout } from "../../sdk/layout.ts";
import type { Transport } from "../transport.ts";

export interface Approval {
  id: string;
  sessionId: string;
  explanation: string;
  name: string;
  args: Record<string, unknown>;
}

export async function projectOverview(transport: Transport, projectId: string) {
  const [sessions, models, usage, approvals] = await Promise.all([
    transport.request<Session[]>("sessions.list", { projectId }),
    transport.request<ModelChoice[]>("models.list", { projectId }),
    transport.request<UsageRecord[]>("usage.list", { projectId }),
    transport.request<Approval[]>("approvals.list", { projectId }),
  ]);
  return { sessions, models, usage, approvals };
}

export async function prepareProject(transport: Transport, path: string) {
  const project = await transport.request<Project>("projects.open", { path });
  const projectId = project.id;
  const [overview, projects, layout, remembered] = await Promise.all([
    projectOverview(transport, projectId),
    transport.request<Project[]>("projects.list"),
    transport.request<WorkspaceLayout>("settings.layout.get", { projectId }),
    transport.request<string | null>("session.selection.get", { projectId }),
  ]);
  let session =
    overview.sessions.find((item) =>
      item.id === remembered && !item.archived
    ) ??
      overview.sessions.find((item) => !item.archived);
  if (!session) {
    session = await transport.request<Session>("session.create", { projectId });
    overview.sessions = [session, ...overview.sessions];
  }
  const state = await transport.request<SessionState>("session.get", {
    projectId,
    sessionId: session.id,
  });
  await transport.request("session.selection.set", {
    projectId,
    sessionId: session.id,
  });
  return { project, projects, state, layout, ...overview };
}
