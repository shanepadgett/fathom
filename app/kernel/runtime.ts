/** Native hosts supply an absolute runtime path; development can use PATH. */
export function denoExecutable(): string {
  return Deno.env.get("FATHOM_DENO") || "deno";
}

/** Workspace children must bind their own servers, not the desktop host's port. */
export function workspaceEnvironment(): Record<string, string> {
  const environment = Deno.env.toObject();
  delete environment.DENO_SERVE_ADDRESS;
  return environment;
}
