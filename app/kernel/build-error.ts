import { stripVTControlCharacters } from "node:util";

/** Keep actionable compiler output without terminal escapes or runtime stacks. */
export function pluginBuildError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const detail = stripVTControlCharacters(message)
    .split(/\n\s*at\s/, 1)[0]
    .trim()
    .split("\n")
    .slice(0, 10)
    .join("\n");
  return new Error(detail.slice(0, 1200), { cause: error });
}
