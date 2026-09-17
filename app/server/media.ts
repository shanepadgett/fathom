import type { MediaService } from "../sdk/media.ts";

/** Auth is checked by the HTTP router before resolving branch-visible media. */
export async function mediaResponse(
  request: Request,
  service: MediaService,
  sessionId: string,
  id: string,
) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD" },
    });
  }
  const { asset, data } =
    new URL(request.url).searchParams.get("draft") === "1"
      ? await service.readDraft(sessionId, id)
      : await service.read(sessionId, id);
  if (
    !/^(image\/(png|jpeg|webp|gif)|audio\/(mpeg|wav|ogg|mp4)|video\/(mp4|webm))$/.test(asset.mime)
  ) {
    return new Response("Unsupported media type", { status: 415 });
  }
  const download = new URL(request.url).searchParams.get("download") === "1";
  const headers = new Headers({
    "Content-Type": asset.mime,
    "Content-Length": String(data.byteLength),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Content-Disposition": `${
      download ? "attachment" : "inline"
    }; filename*=UTF-8''${encodeURIComponent(asset.name).replace(
      /['()*]/g,
      (value) => `%${value.charCodeAt(0).toString(16).toUpperCase()}`,
    )}`,
  });
  if (request.method === "HEAD") return new Response(null, { headers });
  // Unsupported/multiple ranges and conditional ranges fall back to the full asset.
  const range = request.headers.has("if-range")
    ? null
    : request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, data.byteLength - Number(range[2]));
    const end =
      range[1] && range[2] ? Math.min(Number(range[2]), data.byteLength - 1) : data.byteLength - 1;
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start > end ||
      start >= data.byteLength
    ) {
      headers.set("Content-Range", `bytes */${data.byteLength}`);
      headers.set("Content-Length", "0");
      return new Response(null, { status: 416, headers });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${data.byteLength}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(new Uint8Array(data.subarray(start, end + 1)), {
      status: 206,
      headers,
    });
  }
  return new Response(new Uint8Array(data), { headers });
}

export async function mediaUpload(request: Request, service: MediaService, sessionId: string) {
  const limit = 64 * 1024 * 1024;
  if (Number(request.headers.get("content-length")) > limit) {
    return new Response("Media exceeds 64 MiB", { status: 413 });
  }
  if (!request.body) return new Response("Missing media data", { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of request.body) {
    size += chunk.byteLength;
    if (size > limit) {
      return new Response("Media exceeds 64 MiB", { status: 413 });
    }
    chunks.push(chunk);
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const name = decodeURIComponent(request.headers.get("x-fathom-filename") ?? "");
    const mime = (request.headers.get("content-type") ?? "")
      .split(";")[0]
      .replace("audio/x-wav", "audio/wav");
    const asset = await service.stage(sessionId, { name, mime, data });
    return Response.json(asset, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Upload failed", { status: 400 });
  }
}
