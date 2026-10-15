import type { CodeLine } from "../models/code.ts";
import type { Message } from "../models/conversation.ts";

/** A session that changes three folders and tests them running together. */
export const harborMessages: Message[] = [
  {
    author: "You",
    time: "14:02",
    blocks: [
      {
        kind: "prose",
        text:
          "Uploads restart from zero when the connection drops. Make the API accept resumed uploads and have the web client continue from the last confirmed chunk. Prove it works with both running.",
      },
    ],
  },
  {
    author: "Fathom",
    time: "14:02",
    agent: true,
    blocks: [
      {
        kind: "tool-summary",
        operations: [
          {
            action: "read",
            files: [
              "contracts/openapi/uploads.yaml",
              "api/lib/harbor_web/upload_controller.ex",
              "web/src/uploads/upload-queue.ts",
            ],
          },
        ],
      },
      {
        kind: "prose",
        text:
          "The contract has no way to ask which chunks arrived, so I’ll start there: add HEAD /uploads/{id} returning the confirmed offset, regenerate the shared types, then use them in api and web.",
      },
      {
        kind: "tool-summary",
        operations: [
          { action: "edited", files: ["contracts/openapi/uploads.yaml"] },
          {
            action: "written",
            files: [
              "api/lib/harbor/uploads/resume.ex",
              "api/test/uploads/resume_test.exs",
            ],
          },
          {
            action: "edited",
            files: [
              "api/lib/harbor_web/upload_controller.ex",
              "web/src/uploads/resume-upload.ts",
              "web/e2e/uploads.spec.ts",
            ],
          },
        ],
      },
      {
        kind: "changes",
        description:
          "One contract change, the resume endpoint in api, and the client retry in web, on fix/resumable-uploads in all three folders.",
      },
      {
        kind: "tool",
        label: "Ran API tests · api",
        duration: "6.4s",
        files: ["mix test test/uploads"],
      },
      {
        kind: "status",
        text:
          "Running Upload end-to-end against db :5432, api :4000, and web :5173…",
        tone: "action",
      },
    ],
  },
];

/** Setting up a workspace by describing it instead of filling in steps. */
export const setupMessages: Message[] = [
  {
    author: "You",
    time: "13:48",
    blocks: [
      {
        kind: "prose",
        text:
          "Set up a workspace for harbor-api, harbor-web, and harbor-contracts in ~/dev/harbor. The Postgres setup is in ~/dev/platform/harbor-infra; agents can read it but shouldn\u2019t change it.",
      },
    ],
  },
  {
    author: "Fathom",
    time: "13:48",
    agent: true,
    blocks: [
      {
        kind: "tool-summary",
        operations: [
          {
            action: "read",
            files: [
              "harbor-api/mix.exs",
              "harbor-api/config/dev.exs",
              "harbor-web/package.json",
              "harbor-web/.env.example",
              "harbor-contracts/package.json",
              "harbor-infra/docker-compose.yml",
            ],
          },
        ],
      },
      {
        kind: "prose",
        text:
          "These run as three services: Postgres from infra on :5432, the Phoenix API on :4000, and the Vite app on :5173, which reads VITE_API_URL. contracts generates types for both api and web, so an API change should start there.",
      },
      {
        kind: "changes",
        description:
          "Drafted harbor.fathom with 4 folders, 3 services, and 2 checks. infra is read only.",
      },
      {
        kind: "prose",
        text:
          "One question before I save it: web has a Playwright suite that needs all three services running. Should agents run it before finishing any session that edits api or web, or only when you ask?",
      },
      { kind: "status", text: "Waiting for your answer", tone: "warning" },
    ],
  },
];

export const resumeCode: CodeLine[] = [
  {
    tokens: [
      { text: "import type", tone: "action" },
      " { UploadOffset } ",
      { text: "from", tone: "action" },
      " ",
      { text: '"../api/types.ts"', tone: "success" },
      ";",
    ],
  },
  { tokens: [" "] },
  {
    tokens: [
      { text: "export async function", tone: "action" },
      " resumeUpload(file: File, id: string) {",
    ],
  },
  {
    tokens: [
      "  ",
      { text: "const", tone: "action" },
      " head = ",
      { text: "await", tone: "action" },
      " fetch(",
      { text: "`${API_URL}/uploads/${id}`", tone: "success" },
      ", { method: ",
      { text: '"HEAD"', tone: "success" },
      " });",
    ],
    added: true,
  },
  {
    tokens: [
      "  ",
      { text: "const", tone: "action" },
      " offset: UploadOffset = Number(head.headers.get(",
      { text: '"Upload-Offset"', tone: "success" },
      ") ?? 0);",
    ],
    added: true,
  },
  { tokens: [" "] },
  {
    tokens: [
      "  ",
      { text: "for", tone: "action" },
      " (",
      { text: "let", tone: "action" },
      " start = offset; start < file.size; start += CHUNK_SIZE) {",
    ],
    added: true,
  },
  {
    tokens: [
      "    ",
      { text: "await", tone: "action" },
      " sendChunk(id, file.slice(start, start + CHUNK_SIZE), start);",
    ],
  },
  { tokens: ["  }"] },
  { tokens: ["}"] },
];
