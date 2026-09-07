# Agent Rules

## Current Primary Focus: Technical Planning

Requirements alignment is complete. Until explicitly completed, the primary
focus across sessions is technical planning for the Fathom desktop/server
coding harness. Follow `docs/technical/tracker.md` in order: technologies and
versions, architecture and repository layout, then an ordered build plan.

### Guidelines for Agent Interactions

- **No Walls of Text**: Keep responses concise, direct, and conversational. Tackle one feature/topic at a time.
- **Maintain Planning Docs**:
  - Keep the live planning tracker in `docs/technical/tracker.md` current.
  - Record agreed technical decisions in `docs/technical/`.
  - Use `docs/requirements/` as the baseline. Update requirements only when an agreed decision changes them.
- **Iterative Clarification**: Plan one topic at a time. Agree on technologies and compatible versions before settling architecture and layout, then define build dependencies and tasks. Revisit choices when conflicts arise.
- **Phase Boundary**: Stay in technical planning until explicitly completed. Planning does not authorize implementation.
- **Use Automated Fix Tools**: Always use automated fix commands (e.g. `deno fmt`, `npx markdownlint-cli2 --fix`) for formatting and lint issues instead of manually editing files by hand.
