# Agent Instructions

- Any Mise work goes through the `mise` CLI the Mise way — check latest/available versions and tool
  presence with commands like `mise latest`, `mise ls-remote`, `mise search`, and `mise which`
  instead of guessing or bypassing it.
- Pin every dependency and tool to an exact version in committed configuration, regardless of
  ecosystem or installer, including Deno imports, package managers, and Mise. Never commit floating
  tags or version ranges such as `latest`, `^`, or `~`; resolve the desired version first, then pin
  it to reduce supply-chain risk.
- Use `docs/scratch/` for ephemeral research and working documents that are not meant to be kept
  long term.
- Docs app lives in `docs/_app/`. Content is anything else under `docs/` (plans, research, etc.).
  Run `mise docs` and open http://127.0.0.1:4173/ — see `docs/_app/README.md` before inventing
  structure.
- Plans: folder per plan under `docs/scratch/plans/` with `plan.json` + `sections/` (`.html` or
  `.md`). Prefer shared `<plan-*>` blocks from `docs/_app/blocks.js` over one-off diagram markup.
- Never browse or preload `docs/standards/`. Project tooling will identify a relevant standards file
  when work crosses a governed boundary.
- Protect context from command output. Scope and filter shell commands with targeted paths and tools
  such as `rg`, `find` limits, `jq`, or `head`. Redirect potentially large or unpredictable output
  to a temporary file, then query only the needed portions. Never dump an unbounded repository scan,
  build log, or generated artifact into context.
