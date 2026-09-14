# TypeScript Style

For writing or reviewing TypeScript and TSX. Skip for pure design, markdown, or
config work.

Import order is enforced by `.oxfmtrc.json` (`oxfmt` `sortImports`). Blank lines
between top-level parts are a writing rule. Formatters keep them; they do not
add them for you.

## File order

1. Imports
2. Types and type aliases
3. Constants
4. Private helpers
5. Public exports

## Imports

- Type imports before value imports
- Built-in, then external, then internal, then relative
- One blank line between those groups (oxfmt does this)
- Prefer one import per module path; merge duplicate paths when you touch them
