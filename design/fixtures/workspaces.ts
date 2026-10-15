import type { Changes, FileNode } from "../models/files.ts";
import type { InspectorData } from "../models/inspector.ts";
import type { Chat } from "../models/session.ts";
import type {
  SetupFinding,
  Workspace,
  WorkspaceFolder,
  WorkspaceService,
} from "../models/workspace.ts";

import { inspector } from "./inspector.ts";

export const harborFolders: WorkspaceFolder[] = [
  {
    name: "api",
    path: "~/dev/harbor/harbor-api",
    branch: "fix/resumable-uploads",
    stack: "Phoenix · Elixir",
    access: "write",
    changes: { added: 86, removed: 12 },
  },
  {
    name: "web",
    path: "~/dev/harbor/harbor-web",
    branch: "fix/resumable-uploads",
    stack: "Vite · TypeScript",
    access: "write",
    changes: { added: 54, removed: 21 },
  },
  {
    name: "contracts",
    path: "~/dev/harbor/harbor-contracts",
    branch: "fix/resumable-uploads",
    stack: "OpenAPI",
    access: "write",
    changes: { added: 18, removed: 2 },
  },
  {
    name: "infra",
    path: "~/dev/platform/harbor-infra",
    branch: "main",
    stack: "Docker Compose",
    access: "read",
  },
];

export const harbor: Workspace = {
  id: "harbor",
  name: "Harbor",
  folders: harborFolders,
  file: "~/dev/harbor/harbor.fathom",
  activity: "running",
  running: 2,
  opened: "Now",
};

/** Workspaces open as tabs, in tab order. */
export const openWorkspaces: Workspace[] = [
  harbor,
  {
    id: "fathom",
    name: "Fathom",
    folders: [{ name: "fathom", path: "~/dev/open-source/fathom" }],
    activity: "attention",
    opened: "2h",
  },
  {
    id: "atlas",
    name: "Atlas documentation platform",
    folders: [
      { name: "docs", path: "~/dev/atlas/docs" },
      { name: "site", path: "~/dev/atlas/site" },
    ],
    file: "~/dev/atlas/atlas.fathom",
    activity: "running",
    running: 1,
    opened: "12m",
  },
  {
    id: "orbit",
    name: "Orbit",
    folders: [
      { name: "app", path: "~/dev/orbit/orbit-mobile" },
      { name: "api", path: "~/dev/orbit/orbit-api" },
    ],
    file: "~/dev/orbit/orbit.fathom",
    activity: "idle",
    opened: "2d",
  },
];

/** Recently used workspaces, including closed ones. */
export const recentWorkspaces: Workspace[] = [
  ...openWorkspaces,
  {
    id: "metrics",
    name: "Infrastructure metrics",
    folders: [
      { name: "collector", path: "~/dev/metrics/collector" },
      { name: "dashboard", path: "~/dev/metrics/dashboard" },
      { name: "alerts", path: "~/dev/metrics/alert-rules" },
    ],
    file: "~/dev/metrics/metrics.fathom",
    opened: "5d",
  },
  {
    id: "design",
    name: "Design reference",
    folders: [{ name: "design-reference", path: "~/dev/design-reference" }],
    opened: "1w",
  },
];

export const harborServices: WorkspaceService[] = [
  {
    name: "db",
    folder: "infra",
    command: "docker compose up postgres",
    port: 5432,
    state: "running",
  },
  {
    name: "api",
    folder: "api",
    command: "mix phx.server",
    port: 4000,
    state: "running",
    connects: "DATABASE_URL from db",
  },
  {
    name: "web",
    folder: "web",
    command: "pnpm dev",
    port: 5173,
    state: "starting",
    connects: "VITE_API_URL from api",
  },
];

export const harborSessions: Chat[] = [
  {
    id: "harbor-retry",
    title: "Retry interrupted uploads",
    folders: ["api", "web", "contracts"],
    branch: "fix/resumable-uploads",
    time: "Now",
    status: "Running upload end-to-end",
    activity: "running",
  },
  {
    id: "harbor-auth",
    title: "Refresh expired credentials",
    folders: ["api", "web"],
    branch: "fix/token-refresh",
    time: "8m",
    activity: "running",
  },
  {
    id: "harbor-quota",
    title: "Show storage quota in settings",
    folders: ["web"],
    branch: "feature/storage-quota",
    time: "1h",
    activity: "attention",
    unread: true,
  },
  {
    id: "harbor-schema",
    title: "Version the upload schema",
    folders: ["contracts", "api"],
    branch: "chore/schema-versions",
    time: "1d",
    activity: "completed",
    unread: true,
  },
  {
    id: "harbor-compose",
    title: "Explain the local Postgres setup",
    folders: [],
    branch: "main",
    time: "2d",
  },
  {
    id: "harbor-tests",
    title: "Cover multipart upload edge cases",
    folders: ["api"],
    branch: "test/multipart-boundaries",
    time: "6d",
    activity: "completed",
  },
];

export const harborPinned = ["harbor-retry"];

export const harborChanges: Changes = {
  count: 6,
  added: 158,
  removed: 35,
  files: [
    { path: "contracts/openapi/uploads.yaml", added: 18, removed: 2 },
    { path: "api/lib/harbor/uploads/resume.ex", added: 52, removed: 0 },
    { path: "api/lib/harbor_web/upload_controller.ex", added: 22, removed: 9 },
    { path: "api/test/uploads/resume_test.exs", added: 12, removed: 3 },
    { path: "web/src/uploads/resume-upload.ts", added: 41, removed: 14 },
    { path: "web/e2e/uploads.spec.ts", added: 13, removed: 7 },
  ],
};

export const harborInspector: InspectorData = {
  ...inspector,
  folders: harborFolders,
  services: harborServices,
  servers: ["ElixirLS", "TypeScript"],
};

export const setupFindings: SetupFinding[] = [
  {
    kind: "service",
    title: "db · Postgres on :5432",
    detail: "docker compose up postgres",
    source: "infra/docker-compose.yml",
    accepted: true,
  },
  {
    kind: "service",
    title: "api · Phoenix on :4000",
    detail: "mix phx.server, after db is ready",
    source: "api/config/dev.exs",
    accepted: true,
  },
  {
    kind: "service",
    title: "web · Vite on :5173",
    detail: "pnpm dev",
    source: "web/package.json",
    accepted: true,
  },
  {
    kind: "link",
    title: "web reads VITE_API_URL",
    detail: "Set to http://localhost:4000 when both run here",
    source: "web/.env.example",
    accepted: true,
  },
  {
    kind: "link",
    title: "api and web share generated types",
    detail: "contracts generates api/lib/schemas and web/src/api/types.ts",
    source: "contracts/package.json",
    accepted: true,
  },
  {
    kind: "check",
    title: "API tests",
    detail: "mix test, needs db",
    source: "api/mix.exs",
    accepted: true,
  },
  {
    kind: "check",
    title: "Upload end-to-end",
    detail: "pnpm test:e2e uploads, needs db, api, and web",
    source: "web/playwright.config.ts",
    accepted: true,
  },
  {
    kind: "check",
    title: "Lint web",
    detail: "pnpm lint · takes about 40s, so left out",
    source: "web/package.json",
    accepted: false,
  },
  {
    kind: "instructions",
    title: "Use the existing AGENTS.md files",
    detail: "api/AGENTS.md and web/AGENTS.md apply inside their folders",
    source: "2 files",
    accepted: true,
  },
];

/** The saved workspace file, shown as it will be written. */
export const harborFile = `# Harbor workspace · opened with Fathom
name = "Harbor"

[folders]
api       = "./harbor-api"
web       = "./harbor-web"
contracts = "./harbor-contracts"
infra     = "../platform/harbor-infra"
read_only = ["infra"]

[services.db]
folder = "infra"
run    = "docker compose up postgres"
port   = 5432

[services.api]
folder = "api"
run    = "mix phx.server"
port   = 4000
needs  = ["db"]

[services.web]
folder = "web"
run    = "pnpm dev"
port   = 5173

[services.web.env]
VITE_API_URL = "http://localhost:4000"

[checks.api]
folder = "api"
run    = "mix test"
needs  = ["db"]

[checks.e2e]
folder = "web"
run    = "pnpm test:e2e uploads"
needs  = ["db", "api", "web"]

[instructions]
files = ["./harbor-api/AGENTS.md", "./harbor-web/AGENTS.md"]`;

const status = (id: string, name: string, s: "M" | "A") => ({
  id,
  name,
  icon: name.endsWith(".ts") ? "file-ts" as const : "file-text" as const,
  status: s,
});

/** One tree per folder; the top-level nodes are the workspace folders. */
export const harborFiles: FileNode[] = [
  {
    id: "api",
    name: "api",
    children: [
      {
        id: "api-lib",
        name: "lib/harbor/uploads",
        children: [
          status("api-resume", "resume.ex", "A"),
          { id: "api-chunk", name: "chunk.ex", icon: "file-text" },
        ],
      },
      { id: "api-test", name: "test", children: [] },
      { id: "api-mix", name: "mix.exs", icon: "file-text" },
    ],
  },
  {
    id: "web",
    name: "web",
    children: [
      {
        id: "web-uploads",
        name: "src/uploads",
        children: [
          status("web-resume", "resume-upload.ts", "M"),
          { id: "web-queue", name: "upload-queue.ts", icon: "file-ts" },
        ],
      },
      {
        id: "web-e2e",
        name: "e2e",
        children: [status("web-spec", "uploads.spec.ts", "M")],
      },
      { id: "web-package", name: "package.json", icon: "brackets-curly" },
    ],
  },
  {
    id: "contracts",
    name: "contracts",
    children: [
      {
        id: "contracts-openapi",
        name: "openapi",
        children: [status("contracts-uploads", "uploads.yaml", "M")],
      },
    ],
  },
  { id: "infra", name: "infra", children: [] },
];

export const harborExpanded = [
  "api",
  "api-lib",
  "web",
  "web-uploads",
  "web-e2e",
  "contracts",
];
