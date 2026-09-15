import type { CommitGroup } from "../sdk/git.ts";

/** Validate model output and edited RPC input before either reaches Git. */
export function validateCommitGroups(
  value: unknown,
  paths: string[],
  requireAll: boolean,
): CommitGroup[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 30) {
    throw new Error("A commit plan must contain between 1 and 30 commits.");
  }
  const remaining = new Set(paths);
  const commits: CommitGroup[] = [];
  for (const item of value) {
    if (
      !item || typeof item !== "object" || typeof item.title !== "string" ||
      !item.title.trim() || item.title.includes("\n") ||
      item.title.includes("\r") ||
      typeof item.body !== "string" || !Array.isArray(item.files) ||
      !item.files.length
    ) {
      throw new Error(
        "Each commit needs a single-line title, a description and at least one file.",
      );
    }
    const files: string[] = [];
    for (const path of item.files) {
      if (typeof path !== "string" || !remaining.delete(path)) {
        throw new Error("Commit plan contains an invalid or duplicate file.");
      }
      files.push(path);
    }
    commits.push({ title: item.title.trim(), body: item.body, files });
  }
  if (requireAll && remaining.size) {
    throw new Error("Commit plan omitted files; retry planning.");
  }
  return commits;
}
