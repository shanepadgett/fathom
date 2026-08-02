# Docs app

Small Deno app over `docs/`. No framework. Markdown + HTML fragments + shared blocks.

## Run

```bash
mise docs
```

Open http://127.0.0.1:4173/

`mise plans` is the same task.

Edit a file → the open page reloads that content (SSE). App chrome changes full-reload.

## Layout

```text
docs/
  _app/                 # this app (not listed as content)
    serve.ts
    shell.js
    blocks.js
    styles.css
    index.html
    view.html
  scratch/
    plans/
      _template/        # copy to start a plan
      agent-runtime/
        plan.json
        sections/...
    research/
      api-catalogs/*.md
```

Anything under `docs/` except `_app/` is content.

## Content kinds

| Kind | How | URL |
|------|-----|-----|
| **Plan** | Folder with `plan.json` + `sections/` | `view.html?doc=scratch/plans/agent-runtime` |
| **Page** | Standalone `.md` or `.html` | `view.html?doc=scratch/research/api-catalogs/anthropic-api.md` |

Short plan id still works: `view.html?plan=agent-runtime`.

### Plan

Same as before. `plan.json` lists ordered sections. Each section is `sections/<id>.html` or `sections/<id>.md`.

```json
{
  "id": "my-plan",
  "title": "My plan",
  "summary": "One line.",
  "sections": [
    { "id": "frame/map", "title": "Map", "group": "Frame" }
  ]
}
```

### Page (markdown)

```markdown
---
title: Optional title
summary: Optional one-liner for the explorer
---

# Heading used if title omitted

Prose. Use normal markdown.

<plan-flow>
  <plan-flow-step label="A" desc="First"></plan-flow-step>
  <plan-flow-step label="B" desc="Second"></plan-flow-step>
</plan-flow>
```

Raw HTML in markdown is fine — that is how blocks work. Fenced code gets highlighting. No MDX.

### Page (HTML fragment)

```html
<div class="measure doc-prose">
  <h2>Title</h2>
  <p>…</p>
</div>
```

`.plan-prose` still works (alias). Prefer `.doc-prose` for new files.

## Blocks

Tags from `_app/blocks.js`. Prefer these over hand-rolled diagram markup.

| Need | Tag |
|------|-----|
| Sequence | `<plan-flow>` / `<plan-flow-step>` |
| Map id → id | `<plan-map>` / `<plan-map-row>` |
| Side-by-side | `<plan-split>` / `<plan-pane>` |
| Layers | `<plan-stack>` / `<plan-row>` / `<plan-layer>` |
| Numbered steps | `<plan-steps>` / `<plan-step>` |
| Definitions | `<plan-defs>` / `<plan-def>` |
| Name inventory | `<plan-terms>` |
| Real code | `<plan-code lang="ts">` |

Plain titles: `label` + `desc`. HTML in title/desc: `<plan-t>` / `<plan-d>`. Extra children under a step or pane become list lines.

Cheatsheet (server running):

http://127.0.0.1:4173/view.html?doc=scratch/plans/_template#guide/building-blocks

## Create a plan

1. Copy `scratch/plans/_template/` → `scratch/plans/my-plan/`.
2. Edit `plan.json` (`id` = folder name). Remove `"template": true`.
3. Replace guide sections with real ones.
4. Refresh explorer (or wait for HMR on the list).

## Links

Injected content resolves relative URLs from the **content directory** (plan parent for plans, file folder for pages). Link a sibling note as `./other.md`. Link another plan as `/view.html?doc=scratch/plans/other#section-id`.

## Writing rules

Teach a sharp first-year. Short paragraphs. Real names. No architecture poetry.

Prefer prose over bullets. Diagrams = blocks, not ASCII. Code fences / `<plan-code>` = real source only.

### No visible meta

Do not narrate chrome the reader can already see. No counts, structure captions, or empty-state coaching in the product surface. How-to stays in this README.

## Agent workflow

- Edit one section or page file.
- Add plan section: new file under `sections/` + one `plan.json` entry.
- Reorder plan: reorder `sections` array.
- Prefer markdown for long prose; HTML or tags for structured blocks.
- Do not paste a full document shell into a section file.
- Do not reinvent flow/stack/map markup — use blocks.

## Out of scope

- Frameworks, MDX, dark mode, per-doc themes
- `file://` browsing
