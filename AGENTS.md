# Repository Guidelines

- Finish authorized work and verify it. Repo-local Codex lifecycle hooks run
  automated fixes at turn completion; let them run automatically. No Git hooks.
- Make routine decisions. Ask when scope, correctness, or permission is unclear.
- Preserve unrelated work. Keep responses short and concrete.
- Production implementation is active. Track delivery and direct-use evidence
  in `docs/technical/implementation.md`. Do not add tests; use the running app.
- Use Fathom itself to build parts of Fathom with OpenAI GPT-6 Astra, then
  review and exercise the changes. This is a standing development requirement.
- Use ChatGPT GPT-5.6 Luna for simple chat and agent functionality checks;
  reserve Astra for substantive implementation work through Fathom.
- Build and use the native desktop app for verification. A Chrome-hosted UI
  does not satisfy desktop verification.
- Match the approved `design/` components, screens, Tailwind styles and tokens
  component by component. Do not substitute approximate styling.

Read only matching standards before work. Reuse unchanged standards already
read; reassess when scope changes. No folder preloading or recursive reading.

| Standard                                                         | Read for                                                                 | Skip for                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| [Design system](docs/standards/design-system.md)                 | Editing or reviewing `design/`                                           | Reading designs or implementing app code                            |
| [TypeScript style](docs/standards/typescript-style.md)           | Writing or reviewing TypeScript and TSX                                  | Pure design, markdown, or config work                               |
| [Technical planning](docs/standards/technical-planning.md)       | Changing requirements, architecture, technical decisions, or build plans | Implementing agreed work, editing previews, or consulting decisions |
| [Standards maintenance](docs/standards/standards-maintenance.md) | Editing standards or `AGENTS.md` rules                                   | Following standards                                                 |

Read source and reference material as needed; that alone does not trigger
maintenance standards.
