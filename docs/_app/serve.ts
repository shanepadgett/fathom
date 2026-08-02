/**
 * Docs app server — content under docs/, chrome in docs/_app/.
 *
 *   deno run -A docs/_app/serve.ts
 *   mise docs
 *   mise plans   # alias
 */
import { marked } from "marked";

function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

const PORT = 4173;
const APP_ROOT = new URL("./", import.meta.url);
const DOCS_ROOT = new URL("../", import.meta.url);
const DOCS_ROOT_PATH = toPosix(Deno.realPathSync(DOCS_ROOT)).replace(/\/$/, "");

const SKIP_DIRS = new Set(["_app", "node_modules", ".git"]);

type PlanMeta = {
  kind: "plan";
  id: string;
  doc: string;
  title: string;
  summary: string;
  sections: number;
  template?: boolean;
  collection: string;
};

type PageMeta = {
  kind: "page";
  doc: string;
  title: string;
  summary: string;
  collection: string;
};

type Manifest = {
  plans: PlanMeta[];
  pages: PageMeta[];
  generatedAt: string;
};

// --- paths -----------------------------------------------------------------

function docsPath(rel: string): URL {
  const clean = rel.replace(/^\/+/, "").replace(/\\/g, "/");
  const target = new URL(clean, DOCS_ROOT);
  if (!target.pathname.startsWith(DOCS_ROOT.pathname)) {
    throw new Error("path escapes docs root");
  }
  return target;
}

function relFromAbs(abs: string): string {
  const full = toPosix(abs);
  if (full === DOCS_ROOT_PATH) return "";
  if (full.startsWith(DOCS_ROOT_PATH + "/")) return full.slice(DOCS_ROOT_PATH.length + 1);
  return full;
}

async function exists(url: URL): Promise<boolean> {
  try {
    await Deno.stat(url);
    return true;
  } catch {
    return false;
  }
}

// --- frontmatter + markdown ------------------------------------------------

function splitFrontmatter(text: string): { meta: Record<string, string>; body: string } {
  if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) {
    return { meta: {}, body: text };
  }
  const nl = text.indexOf("\n");
  const rest = text.slice(nl + 1);
  const endMatch = rest.match(/\r?\n---\r?\n/);
  if (!endMatch || endMatch.index == null) return { meta: {}, body: text };
  const raw = rest.slice(0, endMatch.index);
  const body = rest.slice(endMatch.index + endMatch[0].length);
  const meta: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    meta[m[1]] = v;
  }
  return { meta, body };
}

function titleFromMarkdown(body: string, fallback: string): string {
  const m = body.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

function wrapProse(html: string): string {
  const trimmed = html.trim();
  if (
    /class=["'][^"']*\b(doc-prose|plan-prose)\b/.test(trimmed) ||
    /^<div\b/i.test(trimmed)
  ) {
    return trimmed;
  }
  return `<div class="measure doc-prose">\n${trimmed}\n</div>`;
}

async function renderFile(rel: string): Promise<{ html: string; title?: string }> {
  const url = docsPath(rel);
  const text = await Deno.readTextFile(url);
  if (rel.endsWith(".md")) {
    const { meta, body } = splitFrontmatter(text);
    const html = wrapProse(await marked.parse(body, { gfm: true, breaks: false }));
    const fallback = rel.split("/").pop()?.replace(/\.md$/, "") || rel;
    return { html, title: meta.title || titleFromMarkdown(body, fallback) };
  }
  if (rel.endsWith(".html")) {
    return { html: text };
  }
  throw new Error(`unsupported content type: ${rel}`);
}

// --- manifest --------------------------------------------------------------

async function readPlan(dirRel: string): Promise<PlanMeta | null> {
  const base = dirRel.split("/").pop() || dirRel;
  if (SKIP_DIRS.has(base) || base.startsWith(".")) return null;
  const planUrl = docsPath(`${dirRel}/plan.json`);
  try {
    const json = JSON.parse(await Deno.readTextFile(planUrl)) as {
      id?: string;
      title?: string;
      summary?: string;
      sections?: unknown[];
      template?: boolean;
    };
    const id = json.id || base;
    const parts = dirRel.split("/");
    const collection = parts.slice(0, -1).join("/") || "docs";
    const template = Boolean(json.template) || base.startsWith("_");
    return {
      kind: "plan",
      id,
      doc: dirRel,
      title: json.title || id,
      summary: json.summary || "",
      sections: Array.isArray(json.sections) ? json.sections.length : 0,
      template,
      collection,
    };
  } catch {
    return null;
  }
}

async function walk(
  dirRel: string,
  onDir: (rel: string) => Promise<void>,
  onFile: (rel: string) => Promise<void>,
): Promise<void> {
  const dirUrl = dirRel ? docsPath(dirRel) : DOCS_ROOT;
  for await (const entry of Deno.readDir(dirUrl)) {
    if (entry.name.startsWith(".")) continue;
    const rel = dirRel ? `${dirRel}/${entry.name}` : entry.name;
    if (entry.isDirectory) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await onDir(rel);
      await walk(rel, onDir, onFile);
    } else if (entry.isFile) {
      await onFile(rel);
    }
  }
}

async function buildManifest(): Promise<Manifest> {
  const plans: PlanMeta[] = [];
  const planDirs = new Set<string>();
  const pages: PageMeta[] = [];

  await walk(
    "",
    async (rel) => {
      const meta = await readPlan(rel);
      if (!meta) return;
      planDirs.add(rel);
      if (!meta.template) plans.push(meta);
    },
    async (rel) => {
      if (!rel.endsWith(".md") && !rel.endsWith(".html")) return;
      // Skip app chrome and plan shell leftovers
      if (rel.startsWith("_app/")) return;
      const base = rel.split("/").pop() || rel;
      if (base === "README.md" || base === "index.html" || base === "view.html") return;
      // Section files belong to plans, not the page list
      if (rel.includes("/sections/")) return;
      // plan.json sibling HTML redirects
      const parent = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
      if (parent && planDirs.has(parent) && rel.endsWith(".html")) return;

      const name = rel.split("/").pop() || rel;
      let title = name.replace(/\.(md|html)$/, "");
      let summary = "";
      if (rel.endsWith(".md")) {
        try {
          const text = await Deno.readTextFile(docsPath(rel));
          const { meta, body } = splitFrontmatter(text);
          title = meta.title || titleFromMarkdown(body, title);
          summary = meta.summary || "";
        } catch {
          /* keep defaults */
        }
      }
      const parts = rel.split("/");
      const collection = parts.slice(0, -1).join("/") || "docs";
      pages.push({ kind: "page", doc: rel, title, summary, collection });
    },
  );

  plans.sort((a, b) => a.title.localeCompare(b.title));
  pages.sort((a, b) => a.doc.localeCompare(b.doc));

  return {
    plans,
    pages,
    generatedAt: new Date().toISOString(),
  };
}

/** Resolve section file relative to plan folder (.html or .md). */
async function resolveSectionFile(
  planDoc: string,
  sec: { id: string; file?: string },
): Promise<string> {
  if (sec.file) return sec.file;
  for (const ext of [".html", ".md"]) {
    const rel = `sections/${sec.id}${ext}`;
    if (await exists(docsPath(`${planDoc}/${rel}`))) return rel;
  }
  return `sections/${sec.id}.html`;
}

// --- HTML shells -----------------------------------------------------------

const STYLE_MARK = "/* __DOCS_STYLES__ */";
const THEME_MARK = "/* __DOCS_THEME__ */";

async function shellHtml(name: "index.html" | "view.html"): Promise<string> {
  const [html, css, theme] = await Promise.all([
    Deno.readTextFile(new URL(`./${name}`, APP_ROOT)),
    Deno.readTextFile(new URL("./styles.css", APP_ROOT)),
    Deno.readTextFile(new URL("./theme.js", APP_ROOT)),
  ]);
  if (!html.includes(STYLE_MARK)) {
    throw new Error(`${name} missing style marker`);
  }
  if (!html.includes(THEME_MARK)) {
    throw new Error(`${name} missing theme marker`);
  }
  return html.replace(STYLE_MARK, css).replace(THEME_MARK, theme);
}

// --- SSE watch -------------------------------------------------------------

type SseClient = {
  id: number;
  send: (data: string) => void;
  close: () => void;
};
const sseClients = new Map<number, SseClient>();
let sseSeq = 0;

function broadcast(path: string) {
  const payload = `data: ${JSON.stringify({ path: toPosix(path) })}\n\n`;
  for (const c of [...sseClients.values()]) {
    c.send(payload);
  }
}

function shouldIgnoreWatch(rel: string): boolean {
  if (!rel) return true;
  if (rel.startsWith(".git/") || rel === ".git") return true;
  const base = rel.split("/").pop() || rel;
  if (base === ".DS_Store") return true;
  // editor swap / backup noise
  if (base.endsWith("~") || base.endsWith(".swp") || base.endsWith(".swo")) return true;
  if (base.startsWith(".#") || base.endsWith(".tmp")) return true;
  if (base.startsWith(".") && (base.endsWith(".html") || base.endsWith(".md"))) return true;
  return false;
}

function startWatcher() {
  let timer: number | undefined;
  const pending = new Set<string>();

  const flush = () => {
    timer = undefined;
    const paths = [...pending];
    pending.clear();
    for (const p of paths) broadcast(p);
  };

  (async () => {
    try {
      const watcher = Deno.watchFs(DOCS_ROOT_PATH, { recursive: true });
      for await (const ev of watcher) {
        try {
          for (const p of ev.paths) {
            const rel = relFromAbs(p);
            if (shouldIgnoreWatch(rel)) continue;
            pending.add(rel);
          }
          if (timer != null) clearTimeout(timer);
          timer = setTimeout(flush, 80) as unknown as number;
        } catch (err) {
          console.error("watch event error:", err);
        }
      }
    } catch (err) {
      // Never let the watcher take down the HTTP server.
      console.error("watch loop ended:", err);
    }
  })();
}

// --- HTTP ------------------------------------------------------------------

function contentType(pathname: string): string {
  if (pathname.endsWith(".html")) return "text/html; charset=utf-8";
  if (pathname.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (pathname.endsWith(".css")) return "text/css; charset=utf-8";
  if (pathname.endsWith(".json")) return "application/json; charset=utf-8";
  if (pathname.endsWith(".md")) return "text/markdown; charset=utf-8";
  if (pathname.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function noStore(type: string, body: BodyInit, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": type,
      "cache-control": "no-store",
    },
  });
}

function safeDocsUrl(urlPath: string): URL | null {
  const clean = decodeURIComponent(urlPath.split("?")[0] || "/");
  if (clean.includes("\0") || clean.includes("..")) return null;
  const rel = clean === "/" ? "" : clean.replace(/^\//, "");
  try {
    return rel ? docsPath(rel) : DOCS_ROOT;
  } catch {
    return null;
  }
}

const manifest = await buildManifest();
console.log(
  `plans: ${manifest.plans.map((p) => p.id).join(", ") || "(none)"}`,
);
console.log(
  `pages: ${manifest.pages.length}`,
);
console.log(`http://127.0.0.1:${PORT}/`);

startWatcher();

Deno.serve({ port: PORT, hostname: "127.0.0.1" }, async (req) => {
  try {
    return await handleRequest(req);
  } catch (err) {
    console.error("request error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return noStore("text/plain; charset=utf-8", msg, 500);
  }
});

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  let pathname = url.pathname;

  if (pathname === "/_events") {
    const id = ++sseSeq;
    let closed = false;
    let heartbeat: number | undefined;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const enc = new TextEncoder();
        const send = (s: string) => {
          if (closed) return;
          try {
            controller.enqueue(enc.encode(s));
          } catch {
            closed = true;
            if (heartbeat != null) clearInterval(heartbeat);
            sseClients.delete(id);
          }
        };
        const close = () => {
          if (closed) return;
          closed = true;
          if (heartbeat != null) clearInterval(heartbeat);
          sseClients.delete(id);
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        };
        sseClients.set(id, { id, send, close });
        send(": connected\n\n");
        heartbeat = setInterval(() => send(": ping\n\n"), 15000) as unknown as number;
      },
      cancel() {
        closed = true;
        if (heartbeat != null) clearInterval(heartbeat);
        sseClients.delete(id);
      },
    });
    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store",
        connection: "keep-alive",
      },
    });
  }

  if (pathname === "/manifest.json") {
    const body = await buildManifest();
    return noStore(
      "application/json; charset=utf-8",
      JSON.stringify(body, null, 2) + "\n",
    );
  }

  if (pathname === "/_render") {
    const rel = url.searchParams.get("path") || "";
    if (!rel || rel.includes("..")) {
      return noStore("text/plain; charset=utf-8", "bad path", 400);
    }
    try {
      const { html, title } = await renderFile(rel);
      return noStore(
        "application/json; charset=utf-8",
        JSON.stringify({ html, title, path: rel }),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return noStore("application/json; charset=utf-8", JSON.stringify({ error: msg }), 404);
    }
  }

  if (pathname === "/_section") {
    const planDoc = url.searchParams.get("plan") || "";
    const sectionId = url.searchParams.get("id") || "";
    if (!planDoc || !sectionId || planDoc.includes("..")) {
      return noStore("text/plain; charset=utf-8", "bad params", 400);
    }
    try {
      const planJson = JSON.parse(
        await Deno.readTextFile(docsPath(`${planDoc}/plan.json`)),
      ) as { sections?: Array<{ id: string; file?: string }> };
      const sec = (planJson.sections || []).find((s) => s.id === sectionId);
      if (!sec) {
        return noStore(
          "application/json; charset=utf-8",
          JSON.stringify({ error: `unknown section ${sectionId}` }),
          404,
        );
      }
      const file = await resolveSectionFile(planDoc, sec);
      const { html, title } = await renderFile(`${planDoc}/${file}`);
      return noStore(
        "application/json; charset=utf-8",
        JSON.stringify({ html, title, path: `${planDoc}/${file}`, file }),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return noStore("application/json; charset=utf-8", JSON.stringify({ error: msg }), 404);
    }
  }

  if (pathname === "/" || pathname === "/index.html") {
    return noStore("text/html; charset=utf-8", await shellHtml("index.html"));
  }

  if (pathname === "/view" || pathname === "/view.html") {
    return noStore("text/html; charset=utf-8", await shellHtml("view.html"));
  }

  // App assets at /_app/*
  if (pathname.startsWith("/_app/")) {
    const rel = pathname.slice(1); // _app/...
    const fileUrl = new URL(pathname.slice("/_app/".length), APP_ROOT);
    if (!fileUrl.pathname.startsWith(APP_ROOT.pathname)) {
      return new Response("Forbidden", { status: 403 });
    }
    try {
      const data = await Deno.readFile(fileUrl);
      return noStore(contentType(fileUrl.pathname), data);
    } catch {
      return new Response(`Not found: ${rel}`, { status: 404 });
    }
  }

  // Content files under docs/
  if (pathname.endsWith("/")) pathname = `${pathname}index.html`;
  const fileUrl = safeDocsUrl(pathname);
  if (!fileUrl) return new Response("Forbidden", { status: 403 });

  try {
    const data = await Deno.readFile(fileUrl);
    return noStore(contentType(fileUrl.pathname), data);
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
