import { dirname, isAbsolute, relative, resolve } from "node:path";

export async function resolveWorkspacePath(
  workspace: string,
  input: string,
  allowMissingLeaf = false,
): Promise<string> {
  if (!input.trim() || isAbsolute(input)) throw new Error("Path must be relative to the workspace");
  const root = await Deno.realPath(workspace);
  const candidate = resolve(root, input);
  assertInside(root, candidate);

  if (!allowMissingLeaf) {
    const real = await Deno.realPath(candidate);
    assertInside(root, real);
    return real;
  }

  try {
    const real = await Deno.realPath(candidate);
    assertInside(root, real);
    return real;
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
    const parent = await Deno.realPath(dirname(candidate));
    assertInside(root, parent);
    return candidate;
  }
}

export function assertInside(root: string, path: string): void {
  const rel = relative(root, path);
  if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))) return;
  throw new Error("Path escapes the selected workspace");
}
