import { decode, request, T } from "@fathom/sdk";
import type { ModelInfo } from "../contract.ts";

export async function listModels(
  url: string,
  headers: Record<string, string>,
  providerId: string,
  signal: AbortSignal,
): Promise<ModelInfo[]> {
  const response = await request(url, { headers, cache: "no-store" }, signal);

  const metadata = {
    display_name: T.Optional(T.String()),
    created: T.Optional(T.Number()),
    priority: T.Optional(T.Number()),
    visibility: T.Optional(T.String()),
    output_modalities: T.Optional(T.Array(T.String())),
  };

  const item = T.Union([
    T.Object({ id: T.String(), ...metadata }),
    T.Object({ slug: T.String(), ...metadata }),
  ]);

  const result = decode(
    T.Object({
      data: T.Optional(T.Array(item)),
      models: T.Optional(T.Array(item)),
    }),
    await response.json(),
  );

  const entries = result.data ?? result.models;

  if (!entries) {
    throw new Error("Provider returned an unrecognized model list");
  }

  return entries
    .filter(
      (m) =>
        m.visibility !== "hide" &&
        (!m.output_modalities || m.output_modalities.includes("text")),
    )
    .sort(
      (a, b) =>
        (a.priority ?? Number.MAX_SAFE_INTEGER) -
          (b.priority ?? Number.MAX_SAFE_INTEGER) ||
        (b.created ?? 0) - (a.created ?? 0),
    )
    .map((m) => {
      const id = "id" in m ? m.id : m.slug;

      return { id, name: m.display_name ?? id, provider: providerId };
    });
}
