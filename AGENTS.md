# Agent Rules

## Current Primary Focus: Requirements & Vocabulary Architecture

Until explicitly completed, the primary focus across sessions is conversational requirements definition and vocabulary alignment for the Fathom desktop/server coding harness.

### Guidelines for Agent Interactions

- **No Walls of Text**: Keep responses concise, direct, and conversational. Tackle one feature/topic at a time.
- **Maintain Requirements Docs**:
  - Keep a live tracker of covered vs. pending requirements in `docs/requirements/tracker.md`.
  - Record agreed specifications into domain-specific documents in `docs/requirements/`.
- **Iterative Clarification**: Work from core architecture up to frontend/tools. Align on terms, invariants, and edge cases collaboratively.
- **Use Automated Fix Tools**: Always use automated fix commands (e.g. `deno fmt`, `npx markdownlint-cli2 --fix`) for formatting and lint issues instead of manually editing files by hand.
