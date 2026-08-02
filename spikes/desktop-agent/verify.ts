import { join } from "node:path";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { SessionRepository } from "./engine/database.ts";
import { resolveWorkspacePath } from "./engine/paths.ts";

const root = await Deno.makeTempDir({ prefix: "fathom-runtime-" });
const workspace = join(root, "workspace");
const outside = join(root, "outside");
await Deno.mkdir(workspace);
await Deno.mkdir(outside);
await Deno.writeTextFile(join(outside, "secret.txt"), "outside");
await Deno.symlink(outside, join(workspace, "escape"));

let escaped = false;
try {
  await resolveWorkspacePath(workspace, "escape/secret.txt");
  escaped = true;
} catch {
  // Expected.
}
if (escaped) throw new Error("Workspace resolver followed a symlink outside the workspace");

const dbPath = join(root, "fathom.sqlite");
let repository = new SessionRepository(dbPath, workspace);
const sessionId = repository.createSession();
const runId = repository.startRun(sessionId);
const user = { role: "user", content: "hello", timestamp: Date.now() } satisfies AgentMessage;
const record = repository.startMessage(sessionId, runId, user);
repository.updateMessage(record, user, true);
repository.finishRun(runId, "complete");
repository.close();

repository = new SessionRepository(dbPath, workspace);
const loaded = repository.loadMessages(sessionId);
if (loaded.length !== 1 || loaded[0].message.role !== "user") {
  throw new Error("SQLite session did not resume deterministically");
}
repository.close();
await Deno.remove(root, { recursive: true });
console.log("verified workspace confinement and SQLite session resume");
