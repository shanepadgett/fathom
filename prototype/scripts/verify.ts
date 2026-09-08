// Explicit prototype verification; never installed as a Git hook.
const commands = [
  ["fmt", "--unstable-css"],
  ["lint"],
  ["run", "-A", "npm:markdownlint-cli2@0.18.1", "--config", "../.markdownlint-cli2.jsonc"],
  ["check", "main.ts", "tests/", "scripts/"],
  ["test", "-A", "tests/"],
];
for (const args of commands) {
  const status = await new Deno.Command(Deno.execPath(), {
    args,
    cwd: new URL("../", import.meta.url),
    stdout: "inherit",
    stderr: "inherit",
  }).spawn().status;
  if (!status.success) Deno.exit(status.code);
}
