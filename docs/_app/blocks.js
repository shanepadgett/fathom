/**
 * Doc building blocks — light-DOM custom elements.
 * No shadow DOM (Tailwind/classes stay global).
 *
 * Tags keep the plan-* names used in existing content.
 * Prefer these before inventing markup. Cheatsheet:
 *   view.html?doc=scratch/plans/_template#guide/building-blocks
 */
(() => {
  const defined = (name) => customElements.get(name);

  const escapeHtml = (value) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const once = (el) => {
    if (el.dataset.planReady === "1") return false;
    el.dataset.planReady = "1";
    return true;
  };

  const childTag = (el, tag) =>
    [...el.children].find((c) => c.tagName === tag.toUpperCase()) || null;

  const otherChildren = (el, skip) => {
    const skipSet = new Set(skip.map((t) => t.toUpperCase()));
    return [...el.children].filter((c) => !skipSet.has(c.tagName));
  };

  const titleHtml = (el) => {
    const t = childTag(el, "plan-t");
    if (t) return t.innerHTML.trim();
    if (el.hasAttribute("label")) return escapeHtml(el.getAttribute("label") || "");
    return "";
  };

  const descHtml = (el) => {
    const d = childTag(el, "plan-d");
    if (d) return d.innerHTML.trim();
    if (el.hasAttribute("desc")) return escapeHtml(el.getAttribute("desc") || "");
    return "";
  };

  const listHtml = (el) => {
    const items = otherChildren(el, ["plan-t", "plan-d"]);
    if (!items.length) return "";
    return `<div class="flow-step-list">${items
      .map((item) => `<div>${item.innerHTML.trim()}</div>`)
      .join("")}</div>`;
  };

  const flowArrow = () => {
    const arrow = document.createElement("div");
    arrow.className = "flow-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.innerHTML = `<i data-lucide="arrow-down" class="h-4 w-4"></i>`;
    return arrow;
  };

  const flowStepNode = (source) => {
    const step = document.createElement("div");
    step.className = "flow-step";
    const title = titleHtml(source);
    const desc = descHtml(source);
    const list = listHtml(source);
    step.innerHTML =
      (title ? `<div class="flow-step-title">${title}</div>` : "") +
      (desc ? `<div class="flow-step-desc">${desc}</div>` : "") +
      list;
    return step;
  };

  const dedent = (text) => {
    const cleaned = text.replace(/^\n/, "").replace(/\n[ \t]*$/, "");
    const lines = cleaned.split("\n");
    let min = Infinity;
    for (const line of lines) {
      if (!line.trim()) continue;
      const m = line.match(/^[ \t]*/)?.[0].length ?? 0;
      if (m < min) min = m;
    }
    if (!Number.isFinite(min) || min === 0) return cleaned;
    return lines.map((line) => line.slice(min)).join("\n");
  };

  const LANG = {
    ts: "typescript",
    typescript: "typescript",
    js: "javascript",
    javascript: "javascript",
    sh: "bash",
    bash: "bash",
    shell: "bash",
    json: "json",
    rs: "rust",
    rust: "rust",
    go: "go",
    html: "xml",
    css: "css",
    md: "markdown",
    markdown: "markdown",
  };

  if (!defined("plan-flow")) {
    customElements.define(
      "plan-flow",
      class extends HTMLElement {
        connectedCallback() {
          if (!once(this)) return;
          this.classList.add("flow");
          const sources = [...this.children].filter((c) => c.tagName === "PLAN-FLOW-STEP");
          const out = [];
          sources.forEach((source, i) => {
            if (i > 0) out.push(flowArrow());
            out.push(flowStepNode(source));
          });
          this.replaceChildren(...out);
        }
      },
    );
  }

  if (!defined("plan-map")) {
    customElements.define(
      "plan-map",
      class extends HTMLElement {
        connectedCallback() {
          if (!once(this)) return;
          this.classList.add("flow-map");
          const rows = [...this.children].filter((c) => c.tagName === "PLAN-MAP-ROW");
          this.replaceChildren(
            ...rows.map((row) => {
              const el = document.createElement("div");
              el.className = "flow-map-row";
              const from = escapeHtml(row.getAttribute("from") || "");
              const to = escapeHtml(row.getAttribute("to") || "");
              const note = row.getAttribute("note");
              el.innerHTML =
                `<div class="flow-map-from">${from}</div>` +
                `<div class="flow-map-arrow" aria-hidden="true">→</div>` +
                `<div>` +
                `<div class="flow-map-to">${to}</div>` +
                (note ? `<div class="flow-map-note">${escapeHtml(note)}</div>` : "") +
                `</div>`;
              return el;
            }),
          );
        }
      },
    );
  }

  if (!defined("plan-code")) {
    customElements.define(
      "plan-code",
      class extends HTMLElement {
        connectedCallback() {
          if (!once(this)) return;
          const lang = (this.getAttribute("lang") || "").trim();
          const hl = LANG[lang] || lang;
          const source = dedent(this.textContent || "");
          const fig = document.createElement("figure");
          fig.className = "code";
          const langLabel = lang
            ? `<span class="code-lang">${escapeHtml(lang)}</span>`
            : `<span class="code-lang"></span>`;
          const cls = hl ? `language-${escapeHtml(hl)}` : "";
          fig.innerHTML =
            `<div class="code-head">` +
            langLabel +
            `<button type="button" class="code-copy" data-copy>` +
            `<i data-lucide="copy" class="h-3 w-3"></i>` +
            `<span>Copy</span>` +
            `</button>` +
            `</div>` +
            `<pre><code class="${cls}"></code></pre>`;
          fig.querySelector("code").textContent = source;
          this.replaceWith(fig);
        }
      },
    );
  }

  if (!defined("plan-defs")) {
    customElements.define(
      "plan-defs",
      class extends HTMLElement {
        connectedCallback() {
          if (!once(this)) return;
          this.classList.add("def-list");
          const defs = [...this.children].filter((c) => c.tagName === "PLAN-DEF");
          this.replaceChildren(
            ...defs.map((def) => {
              const row = document.createElement("div");
              row.className = "def-row";
              const term = escapeHtml(def.getAttribute("term") || "");
              row.innerHTML =
                `<div class="def-term">${term}</div>` +
                `<div class="def-desc">${def.innerHTML.trim()}</div>`;
              return row;
            }),
          );
        }
      },
    );
  }

  if (!defined("plan-steps")) {
    customElements.define(
      "plan-steps",
      class extends HTMLElement {
        connectedCallback() {
          if (!once(this)) return;
          this.classList.add("steps");
          const steps = [...this.children].filter((c) => c.tagName === "PLAN-STEP");
          this.replaceChildren(
            ...steps.map((step, i) => {
              const row = document.createElement("div");
              row.className = "step";
              const n = step.getAttribute("n") || String(i + 1).padStart(2, "0");
              const title = titleHtml(step);
              const desc = descHtml(step);
              const list = listHtml(step);
              const body =
                (title ? `<div class="flow-step-title">${title}</div>` : "") +
                (desc ? `<div class="flow-step-desc">${desc}</div>` : "") +
                list;
              const fallback = !title && !desc && !list ? step.innerHTML.trim() : "";
              row.innerHTML =
                `<div class="step-n">${escapeHtml(n)}</div>` +
                `<div>${body || fallback}</div>`;
              return row;
            }),
          );
        }
      },
    );
  }

  if (!defined("plan-terms")) {
    customElements.define(
      "plan-terms",
      class extends HTMLElement {
        connectedCallback() {
          if (!once(this)) return;
          this.classList.add("term-grid");
          let cells;
          if (this.children.length) {
            cells = [...this.children].map((c) => {
              const cell = document.createElement("div");
              cell.innerHTML = c.innerHTML.trim() || escapeHtml(c.textContent || "");
              return cell;
            });
          } else {
            cells = (this.textContent || "")
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean)
              .map((text) => {
                const cell = document.createElement("div");
                cell.textContent = text;
                return cell;
              });
          }
          this.replaceChildren(...cells);
        }
      },
    );
  }

  const SPLIT_COLS = {
    1: "my-6 grid grid-cols-1 border border-line bg-panel",
    2: "my-6 grid grid-cols-1 border border-line bg-panel lg:grid-cols-2",
    3: "my-6 grid grid-cols-1 border border-line bg-panel lg:grid-cols-3",
  };

  if (!defined("plan-split")) {
    customElements.define(
      "plan-split",
      class extends HTMLElement {
        connectedCallback() {
          if (!once(this)) return;
          const panes = [...this.children].filter((c) => c.tagName === "PLAN-PANE");
          const n = Math.min(Math.max(panes.length, 1), 3);
          this.className = SPLIT_COLS[n];
          this.replaceChildren(
            ...panes.map((pane, i) => {
              const col = document.createElement("div");
              col.className =
                i < panes.length - 1
                  ? "border-b border-line px-4 py-3 lg:border-b-0 lg:border-r"
                  : "px-4 py-3";
              const label = titleHtml(pane) || escapeHtml(pane.getAttribute("label") || "");
              const items = otherChildren(pane, ["plan-t", "plan-d"]);
              const list =
                items.length > 0
                  ? `<div class="flow-step-list">${items
                      .map((item) => `<div>${item.innerHTML.trim()}</div>`)
                      .join("")}</div>`
                  : "";
              col.innerHTML =
                (label ? `<div class="flow-step-title">${label}</div>` : "") + list;
              return col;
            }),
          );
        }
      },
    );
  }

  const ROW_COLS = {
    1: "stack-row stack-row-1",
    2: "stack-row stack-row-2",
    3: "stack-row stack-row-3",
  };

  if (!defined("plan-stack")) {
    customElements.define(
      "plan-stack",
      class extends HTMLElement {
        connectedCallback() {
          if (!once(this)) return;
          this.classList.add("stack");
          const parts = [...this.children].filter(
            (c) => c.tagName === "PLAN-ROW" || c.tagName === "PLAN-LAYER",
          );

          const renderLayer = (layer) => {
            const el = document.createElement("div");
            const accent = layer.hasAttribute("accent");
            el.className = accent ? "stack-layer stack-layer-accent" : "stack-layer";
            const title = titleHtml(layer) || escapeHtml(layer.getAttribute("label") || "");
            const desc = descHtml(layer);
            const note = layer.getAttribute("note");
            el.innerHTML =
              `<div class="stack-layer-head">` +
              (title ? `<div class="stack-layer-title">${title}</div>` : `<div></div>`) +
              (note ? `<div class="stack-layer-note">${escapeHtml(note)}</div>` : "") +
              `</div>` +
              (desc ? `<div class="stack-layer-desc">${desc}</div>` : "");
            return el;
          };

          const out = [];
          parts.forEach((part) => {
            if (part.tagName === "PLAN-ROW") {
              const layers = [...part.children].filter((c) => c.tagName === "PLAN-LAYER");
              const row = document.createElement("div");
              row.className = ROW_COLS[Math.min(Math.max(layers.length, 1), 3)];
              layers.forEach((layer) => row.appendChild(renderLayer(layer)));
              out.push(row);
            } else {
              out.push(renderLayer(part));
            }
          });
          this.replaceChildren(...out);
        }
      },
    );
  }
})();
