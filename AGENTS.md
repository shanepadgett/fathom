# Agent Instructions

- Any Mise work goes through the `mise` CLI the Mise way — check latest/available versions and tool presence with commands like `mise latest`, `mise ls-remote`, `mise search`, and `mise which` instead of guessing or bypassing it.
- Pin every dependency and tool to an exact version in committed configuration, regardless of ecosystem or installer, including Deno imports, package managers, and Mise. Never commit floating tags or version ranges such as `latest`, `^`, or `~`; resolve the desired version first, then pin it to reduce supply-chain risk.
- Use `docs/scratch/` for ephemeral research and working documents that are not meant to be kept long term.
