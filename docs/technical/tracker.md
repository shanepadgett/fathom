# Technical Planning Tracker

## Current Focus

Requirements alignment is complete. Technical planning is the active phase
across sessions until explicitly marked complete here.

Work through the three areas below in order, one decision at a time. Record
agreed decisions in `docs/technical/` and keep this tracker current. Existing
requirements in `docs/requirements/` remain the baseline.

The user authorized a separate [local design system scaffold](design-system.md)
in `design/`. Deep teal and the Tech sparse font stack are selected; token
defaults are ready for component review. This does not complete the planning
phase or change the production frontend decision.

The workspace screen baseline has been reviewed through iterative design edits.
The approved [component architecture](component-architecture.md) is implemented
in the local design reference. The user then authorized its full conversion to
Lit-based light-DOM Web Components, with visible screen composition and unchanged
visuals. Two registered screen families cover eight static states. Local
verification includes component contracts and browser checks. Production
architecture planning remains separate.

The user requested an audit and plan for files with multiple concerns in the
design reference. [Design file boundaries](design-file-boundaries.md) records
the findings and completed migration. Each registered component has its own
file; viewer behavior, data, examples, styles, and checks have separate owners.
Source checks, build, and browser verification pass. All 60 before/after
screenshots match exactly. Production architecture planning remains separate.

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
