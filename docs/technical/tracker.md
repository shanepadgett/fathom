# Technical Planning Tracker

## Current Focus

Requirements alignment is complete. Technical planning is the active phase
across sessions until explicitly marked complete here.

Work through the three areas below in order, one decision at a time. Record
agreed decisions in `docs/technical/` and keep this tracker current. Existing
requirements in `docs/requirements/` remain the baseline.

## 1. Technologies and Versions

Current decisions are recorded in [technologies.md](technologies.md). Deno
2.9.6, `typebox` 1.3.28, `@earendil-works/pi-ai` 0.85.1, and `cordis` 4.0.0-rc.9
are pinned for planning, with Deno's built-in desktop support. Release-candidate
status for Cordis and Drizzle (1.0.0-rc.4) is accepted. CLI frontend planning
and framework selection are deferred.

- [x] Identify the technologies needed for the full system, including choices
      already set by the requirements.
- [x] Agree on exact versions and verify compatibility using official docs.
- [x] Resolve uncertain choices with focused proofs where needed.
- [x] Record each choice, its purpose, and any remaining constraints.

## 2. Architecture and Repository Layout

- [ ] Define process boundaries, responsibilities, and communication paths.
- [ ] Define shared code, core services, plugins, and dependency rules.
- [ ] Resolve SDK exports, release compatibility, and experience loading.
- [ ] Define the target repository and file structure.
- [ ] Decide how to reuse or replace `prototype/`.

## 3. Ordered Build Plan

- [ ] Break the work into milestones, features, and tasks.
- [ ] Record dependencies and completion checks.
- [ ] Identify the first working path through server, storage, model, and
      client.
- [ ] Check that the plan covers the agreed requirements and marks deferred
      work.

## Completion

- [ ] All three planning areas are agreed, with no unresolved blockers.
- [ ] Explicitly close this phase and update `AGENTS.md` for the next focus.

Planning does not authorize implementation. Revisit earlier choices if later
planning reveals a conflict.
