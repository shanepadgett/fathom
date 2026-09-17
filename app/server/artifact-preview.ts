import type { Artifact } from "../sdk/artifacts.ts";
import type { Application } from "./application.ts";

import { installPicker } from "./preview-picker.ts";

export async function artifactPreview(request: Request, app: Application, origin: string) {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }
  const url = new URL(request.url);
  const channel = url.searchParams.get("channel") ?? "";
  if (!/^[a-f0-9-]{36}$/.test(channel)) {
    return new Response("Invalid preview channel", { status: 400 });
  }
  const artifact = (await app.request("artifact.read", {
    projectId: url.searchParams.get("project"),
    sessionId: url.searchParams.get("session"),
    id: url.searchParams.get("artifact"),
  })) as Artifact & { content: string };
  if (artifact.mime !== "text/html") {
    return new Response("Unsupported preview", { status: 415 });
  }
  const bootstrap = `<script>(${installPicker.toString()})(${JSON.stringify(
    channel,
  )},${JSON.stringify(origin)})</script>`;
  const html = /^\s*<!doctype[^>]*>/i.test(artifact.content)
    ? artifact.content.replace(/^(\s*<!doctype[^>]*>)/i, (doctype) => doctype + bootstrap)
    : bootstrap + artifact.content;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy":
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'; sandbox allow-scripts",
    },
  });
}
