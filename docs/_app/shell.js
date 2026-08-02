/**
 * Docs shell — plan (multi-section) or single page.
 * Requires HTTP. HMR via /_events (SSE).
 */
(() => {
  const qs = (sel, root = document) => root.querySelector(sel);
  const params = new URLSearchParams(location.search);

  const els = {
    title: qs("#doc-title"),
    summary: qs("#doc-summary"),
    nav: qs("[data-nav]"),
    navAside: qs("[data-nav-aside]"),
    main: qs("#doc-main"),
    content: qs("#doc-content"),
    status: qs("#doc-status"),
    base: qs("base"),
  };

  /** @type {{ kind: "plan", doc: string, id: string, title: string, summary: string, sections: Array<{id:string,title:string,group?:string,file?:string}> } | { kind: "page", doc: string, title: string, summary: string } | null} */
  let state = null;
  let activeId = null;
  let activePath = null;

  const paint = () => {
    if (window.hljs) {
      els.content.querySelectorAll("pre code").forEach((el) => {
        if (!el.dataset.highlighted) hljs.highlightElement(el);
      });
    }
    if (window.lucide) lucide.createIcons();
  };

  const setStatus = (msg, isError = false) => {
    if (!els.status) return;
    els.status.textContent = msg || "";
    els.status.classList.toggle("text-red-600", isError);
    els.status.classList.toggle("hidden", !msg);
  };

  const setBase = (href) => {
    if (els.base) els.base.setAttribute("href", href);
  };

  const showNav = (on) => {
    if (els.navAside) els.navAside.classList.toggle("hidden", !on);
  };

  const sectionIndex = (id) =>
    state?.kind === "plan" ? state.sections.findIndex((s) => s.id === id) : -1;

  const buildNav = () => {
    if (!els.nav || state?.kind !== "plan") return;
    els.nav.replaceChildren();
    let lastGroup = undefined;
    for (const sec of state.sections) {
      if (sec.group && sec.group !== lastGroup) {
        const g = document.createElement("div");
        g.className = "nav-group";
        g.textContent = sec.group;
        els.nav.appendChild(g);
        lastGroup = sec.group;
      } else if (!sec.group && lastGroup !== null && lastGroup !== undefined) {
        lastGroup = null;
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.target = sec.id;
      btn.textContent = sec.title;
      els.nav.appendChild(btn);
    }
  };

  const syncNavOverflow = () => {
    const nav = els.nav;
    if (!nav) return;
    const top = nav.scrollTop > 2;
    const bottom = nav.scrollTop + nav.clientHeight < nav.scrollHeight - 2;
    nav.toggleAttribute("data-overflow-top", top);
    nav.toggleAttribute("data-overflow-bottom", bottom);
  };

  const updateChrome = (id) => {
    if (!els.nav) return;
    const canScroll = els.nav.scrollHeight > els.nav.clientHeight + 1;
    els.nav.querySelectorAll("button[data-target]").forEach((btn) => {
      const on = btn.dataset.target === id;
      btn.classList.toggle("is-active", on);
      if (on && canScroll) btn.scrollIntoView({ block: "nearest" });
    });
    syncNavOverflow();
  };

  const inject = (html) => {
    els.content.innerHTML = html;
    requestAnimationFrame(() => {
      paint();
      requestAnimationFrame(paint);
    });
    els.main.scrollTo({ top: 0 });
  };

  const loadSection = async (id, { pushHash = true } = {}) => {
    if (state?.kind !== "plan") return;
    const sec = state.sections.find((s) => s.id === id) || state.sections[0];
    if (!sec) {
      setStatus("No sections in plan.json", true);
      return;
    }
    activeId = sec.id;
    updateChrome(sec.id);
    if (pushHash) {
      history.replaceState(null, "", `${location.pathname}${location.search}#${sec.id}`);
    }

    els.content.innerHTML = `<p class="text-sm text-mute">Loading…</p>`;
    setStatus("");

    try {
      const url = new URL("/_section", location.origin);
      url.searchParams.set("plan", state.doc);
      url.searchParams.set("id", sec.id);
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      activePath = data.path;
      inject(data.html);
    } catch (err) {
      console.error(err);
      els.content.innerHTML = "";
      setStatus(String(err.message || err), true);
    }
  };

  const loadPage = async () => {
    if (state?.kind !== "page") return;
    els.content.innerHTML = `<p class="text-sm text-mute">Loading…</p>`;
    setStatus("");
    try {
      const url = new URL("/_render", location.origin);
      url.searchParams.set("path", state.doc);
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      activePath = data.path;
      if (data.title) {
        state.title = data.title;
        document.title = data.title;
        els.title.textContent = data.title;
      }
      inject(data.html);
    } catch (err) {
      console.error(err);
      els.content.innerHTML = "";
      setStatus(String(err.message || err), true);
    }
  };

  const goRelative = (delta) => {
    if (state?.kind !== "plan") return;
    const i = sectionIndex(activeId);
    const next = i + delta;
    if (i < 0 || next < 0 || next >= state.sections.length) return;
    loadSection(state.sections[next].id);
  };

  const resolveDocParam = async () => {
    // Preferred: ?doc=scratch/plans/agent-runtime or path/to/file.md
    let doc = params.get("doc");
    // Short plan id: ?plan=agent-runtime
    const planShort = params.get("plan");
    if (!doc && planShort) {
      if (planShort.includes("/")) {
        doc = planShort;
      } else {
        const man = await fetch("/manifest.json").then((r) => r.json());
        const hit = (man.plans || []).find((p) => p.id === planShort);
        if (hit) doc = hit.doc;
        else doc = `scratch/plans/${planShort}`;
      }
    }
    return doc;
  };

  const bootPlan = async (doc) => {
    const res = await fetch(`/${doc}/plan.json`);
    if (!res.ok) throw new Error(`Could not load ${doc}/plan.json (${res.status})`);
    const plan = await res.json();
    state = {
      kind: "plan",
      doc,
      id: plan.id || doc.split("/").pop(),
      title: plan.title || doc,
      summary: plan.summary || "",
      sections: Array.isArray(plan.sections) ? plan.sections : [],
    };

    // Relative links in sections resolve from the plans parent (legacy view.html home)
    const parent = doc.includes("/") ? doc.slice(0, doc.lastIndexOf("/") + 1) : "";
    setBase("/" + parent);

    document.title = state.title;
    els.title.textContent = state.title;
    els.summary.textContent = state.summary;
    showNav(true);
    buildNav();

    els.nav.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-target]");
      if (!btn) return;
      loadSection(btn.dataset.target);
    });
    els.nav.addEventListener("scroll", syncNavOverflow, { passive: true });
    window.addEventListener("resize", syncNavOverflow);

    document.addEventListener("keydown", (e) => {
      if (e.target.matches("input, textarea, select") || e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }
      if (e.key === "ArrowLeft") goRelative(-1);
      if (e.key === "ArrowRight") goRelative(1);
    });

    window.addEventListener("hashchange", () => {
      const id = location.hash.replace(/^#/, "");
      if (id && id !== activeId) loadSection(id, { pushHash: false });
    });

    const initial = location.hash.replace(/^#/, "") || state.sections[0]?.id;
    await loadSection(initial, { pushHash: false });
    if (initial) {
      history.replaceState(null, "", `${location.pathname}${location.search}#${initial}`);
    }
  };

  const bootPage = async (doc) => {
    state = {
      kind: "page",
      doc,
      title: doc.split("/").pop() || doc,
      summary: "",
    };
    const parent = doc.includes("/") ? doc.slice(0, doc.lastIndexOf("/") + 1) : "";
    setBase("/" + parent);
    showNav(false);
    document.title = state.title;
    els.title.textContent = state.title;
    els.summary.textContent = "";
    await loadPage();
  };

  const boot = async () => {
    const doc = await resolveDocParam();
    if (!doc) {
      location.replace("./");
      return;
    }

    document.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-copy]");
      if (!btn) return;
      const fig = btn.closest(".code");
      const code = fig?.querySelector("code");
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code.innerText);
        const span = btn.querySelector("span");
        if (span) {
          const prev = span.textContent;
          span.textContent = "Copied";
          setTimeout(() => {
            span.textContent = prev;
          }, 1200);
        }
      } catch (_) {
        /* ignore */
      }
    });

    try {
      const planProbe = await fetch(`/${doc}/plan.json`, { method: "GET" });
      if (planProbe.ok) {
        await bootPlan(doc);
      } else {
        await bootPage(doc);
      }
    } catch (err) {
      setStatus(`${err.message}. Run via HTTP (mise docs).`, true);
      els.title.textContent = "Not found";
      return;
    }

    // Live reload via SSE — never let handler errors tear down the page loop.
    try {
      const es = new EventSource("/_events");
      let reloadTimer;
      let workTimer;
      const scheduleReload = () => {
        clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => location.reload(), 150);
      };
      const schedule = (fn) => {
        clearTimeout(workTimer);
        workTimer = setTimeout(() => {
          Promise.resolve()
            .then(fn)
            .catch((err) => console.error("live reload:", err));
        }, 80);
      };

      es.onmessage = (ev) => {
        let path;
        try {
          path = JSON.parse(ev.data).path;
        } catch {
          return;
        }
        if (!path) return;

        // App chrome → full reload (debounced)
        if (path.startsWith("_app/")) {
          scheduleReload();
          return;
        }

        if (state?.kind === "plan") {
          if (path === `${state.doc}/plan.json`) {
            schedule(async () => {
              const res = await fetch(`/${state.doc}/plan.json`);
              if (!res.ok) return;
              const plan = await res.json();
              state.title = plan.title || state.title;
              state.summary = plan.summary || "";
              state.sections = Array.isArray(plan.sections) ? plan.sections : [];
              document.title = state.title;
              els.title.textContent = state.title;
              els.summary.textContent = state.summary;
              buildNav();
              const still = state.sections.some((s) => s.id === activeId);
              await loadSection(still ? activeId : state.sections[0]?.id, {
                pushHash: still,
              });
            });
            return;
          }
          if (activePath && path === activePath) {
            schedule(() => loadSection(activeId, { pushHash: false }));
            return;
          }
          return;
        }

        if (state?.kind === "page" && path === state.doc) {
          schedule(() => loadPage());
        }
      };
      es.onerror = () => {
        // auto-reconnect; do not reload
      };
    } catch (_) {
      /* SSE optional */
    }
  };

  boot();
})();
