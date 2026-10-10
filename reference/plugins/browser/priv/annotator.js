// The Fathom annotator. The browser plugin has the desktop shell run this in
// every tab's page before the page's own scripts. It does nothing until the
// dock calls start(): then hovering highlights elements, clicking one opens a
// panel for a note and live style edits, and adding it sends a description of
// the element to Fathom through the shell's `browser_message` command.
//
// The UI lives in a shadow root so the page's styles cannot reach it.
// Listeners are registered now, before the page's, so picking wins clicks.
(() => {
  if (window.top !== window || window.__fathomAnnotator) return

  const tauri = window.__TAURI_INTERNALS__
  const send = (message) =>
    (tauri || window.__TAURI_INTERNALS__)
      ?.invoke("browser_message", {message})
      .catch((error) => console.warn("Fathom annotator:", error))

  const STYLES = [
    "color", "background-color", "font-size", "font-weight", "line-height",
    "letter-spacing", "text-align", "padding", "margin", "gap", "border",
    "border-radius", "width", "height", "display", "opacity",
  ]
  const COLORS = new Set(["color", "background-color"])
  const POINTER = ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "dblclick", "auxclick", "contextmenu"]

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    [hidden] { display: none !important; }
    .box { position: fixed; pointer-events: none; border: 2px solid #398f82; border-radius: 3px;
      background: rgb(57 143 130 / 0.14); }
    .tag { position: fixed; pointer-events: none; padding: 2px 6px; border-radius: 4px; white-space: nowrap;
      background: #398f82; color: #fff; font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
    .pin { position: fixed; display: grid; place-items: center; width: 20px; height: 20px; margin: -10px 0 0 -10px;
      border-radius: 10px; background: #398f82; color: #fff; font-weight: 600; font-size: 11px;
      box-shadow: 0 0 0 2px #fff, 0 2px 6px rgb(0 0 0 / 0.3); pointer-events: none; }
    .panel { position: fixed; display: grid; gap: 8px; width: 300px; padding: 10px; cursor: auto;
      pointer-events: auto; color: #f4f4f5; background: #1f1f22; border: 1px solid #3f3f46; border-radius: 10px;
      box-shadow: 0 12px 32px rgb(0 0 0 / 0.35); }
    .panel.nudge { animation: nudge 0.25s; }
    @keyframes nudge { 25% { transform: translateX(-4px) } 75% { transform: translateX(4px) } }
    header { display: flex; align-items: center; gap: 6px; }
    .selector { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      color: #a1a1aa; font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
    textarea, input { width: 100%; color: inherit; background: #131315; border: 1px solid #3f3f46;
      border-radius: 6px; outline: none; cursor: text; }
    textarea { min-height: 56px; padding: 6px 8px; resize: vertical; }
    textarea:focus, input:focus { border-color: #398f82; }
    details summary { cursor: pointer; color: #a1a1aa; user-select: none; }
    .styles { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 4px 8px;
      max-height: 220px; margin-top: 6px; overflow: auto; }
    .styles span { color: #a1a1aa; font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
    .value { display: flex; align-items: center; gap: 4px; }
    .value i { flex: none; width: 14px; height: 14px; border: 1px solid #52525b; border-radius: 3px; }
    input { padding: 2px 6px; font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
    input.changed { border-color: #f59e0b; }
    footer { display: flex; align-items: center; gap: 6px; }
    footer small { flex: 1; color: #71717a; font-size: 11px; }
    button { padding: 4px 10px; color: inherit; background: transparent; border: 1px solid #3f3f46;
      border-radius: 6px; cursor: pointer; }
    button.primary { color: #fff; background: #398f82; border-color: #398f82; }
    button.close { padding: 0 6px; border: 0; color: #a1a1aa; font-size: 16px; line-height: 1; }
  `

  let host, root, box, tag, pins, panel, frame, cursor
  let picking = false
  let hovered = null
  let editing = null // {el, html, edits: Map(property -> {from, to, original})}
  const pending = new Map() // key -> editing, sent and waiting for a number
  const marks = new Map() // key -> {el, edits, pin}

  function mount() {
    if (host?.isConnected) return
    if (!host) {
      host = document.createElement("fathom-annotator")
      host.style.cssText = "all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;"
      root = host.attachShadow({mode: "open"})
      root.innerHTML = `<style>${CSS}</style><div class="box" hidden></div><div class="tag" hidden></div><div class="pins"></div>`
      box = root.querySelector(".box")
      tag = root.querySelector(".tag")
      pins = root.querySelector(".pins")
      // Typing in the panel must not trigger the page's shortcuts.
      for (const type of ["keydown", "keyup", "keypress", "input", "beforeinput", "paste", "copy", "cut"]) {
        host.addEventListener(type, (event) => event.stopPropagation())
      }
    }
    document.documentElement.append(host)
  }

  const ours = (event) => host && event.composedPath().includes(host)

  function start() {
    mount()
    picking = true
    pins.hidden = false
    if (!cursor) {
      cursor = document.createElement("style")
      cursor.textContent = "* { cursor: crosshair !important; }"
    }
    document.documentElement.append(cursor)
    loop()
  }

  function stop() {
    picking = false
    hovered = null
    close(true)
    cursor?.remove()
    if (box) {
      box.hidden = tag.hidden = true
      pins.hidden = true
    }
  }

  // Pointer events while picking: the page never sees them.
  for (const type of POINTER) {
    window.addEventListener(type, (event) => {
      if (!picking || ours(event)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (type === "click") pick(event.target)
    }, true)
  }

  window.addEventListener("pointermove", (event) => {
    if (!picking || ours(event) || editing) return
    hovered = event.target instanceof Element ? event.target : null
  }, true)

  window.addEventListener("keydown", (event) => {
    if (!picking || event.key !== "Escape") return
    event.preventDefault()
    event.stopImmediatePropagation()
    if (editing) {
      close(true)
    } else {
      stop()
      send({type: "stop"})
    }
  }, true)

  function pick(el) {
    if (!(el instanceof Element) || el === document.documentElement || editing?.el === el) return
    if (editing && dirty()) {
      // Clicking away would lose a note; make the panel ask for attention.
      panel.classList.remove("nudge")
      void panel.offsetWidth
      panel.classList.add("nudge")
      return
    }
    close(true)
    hovered = null
    editing = {el, html: snippet(el), edits: new Map()}
    open(el)
  }

  function dirty() {
    return panel.querySelector("textarea").value.trim() !== "" || [...editing.edits.values()].some((e) => e.to !== e.from)
  }

  function open(el) {
    const computed = getComputedStyle(el)
    panel = document.createElement("form")
    panel.className = "panel"
    panel.innerHTML = `
      <header><span class="selector"></span><button type="button" class="close" aria-label="Close">×</button></header>
      <textarea name="comment" placeholder="What should change?" rows="3"></textarea>
      <details><summary>Styles</summary><div class="styles"></div></details>
      <footer><small>⌘↩ to add</small><button type="button" class="cancel">Cancel</button><button type="submit" class="primary">Add</button></footer>`
    panel.querySelector(".selector").textContent = selectorOf(el)

    const rows = panel.querySelector(".styles")
    for (const property of STYLES) {
      const value = computed.getPropertyValue(property)
      const label = document.createElement("span")
      label.textContent = property
      const cell = document.createElement("div")
      cell.className = "value"
      const input = document.createElement("input")
      input.value = value
      input.placeholder = "unset"
      input.spellcheck = false
      if (COLORS.has(property)) {
        const swatch = document.createElement("i")
        swatch.style.background = value
        cell.append(swatch)
        input.addEventListener("input", () => (swatch.style.background = input.value))
      }
      input.addEventListener("input", () => {
        preview(property, value, input.value.trim())
        input.classList.toggle("changed", input.value.trim() !== value)
      })
      cell.append(input)
      rows.append(label, cell)
    }

    panel.addEventListener("submit", (event) => {
      event.preventDefault()
      add()
    })
    panel.querySelector("textarea").addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        add()
      }
    })
    panel.querySelector(".close").addEventListener("click", () => close(true))
    panel.querySelector(".cancel").addEventListener("click", () => close(true))
    root.append(panel)
    place()
    panel.querySelector("textarea").focus({preventScroll: true})
  }

  // Applies a style edit to the element so the page shows it right away.
  function preview(property, from, to) {
    const {el, edits} = editing
    let edit = edits.get(property)
    if (!edit) {
      edit = {from, to: from, original: [el.style.getPropertyValue(property), el.style.getPropertyPriority(property)]}
      edits.set(property, edit)
    }
    edit.to = to
    if (to === from || to === "") restore(el, property, edit)
    else el.style.setProperty(property, to, "important")
  }

  function restore(el, property, {original: [value, priority]}) {
    if (value) el.style.setProperty(property, value, priority)
    else el.style.removeProperty(property)
  }

  function revert({el, edits}) {
    for (const [property, edit] of edits) restore(el, property, edit)
  }

  function close(undo) {
    if (editing && undo) revert(editing)
    panel?.remove()
    panel = null
    editing = null
  }

  function add() {
    const comment = panel.querySelector("textarea").value.trim()
    const styles = [...editing.edits]
      .filter(([, edit]) => edit.to !== "" && edit.to !== edit.from)
      .map(([property, {from, to}]) => ({property, from, to}))
    if (!comment && styles.length === 0) {
      panel.querySelector("textarea").focus()
      return
    }

    const key = Math.random().toString(36).slice(2, 10)
    const {el, html} = editing
    pending.set(key, editing)
    send({type: "annotation", annotation: describe(el, {key, comment, styles, html})})
    // Keep the style edits on the page: they are what the person asked for.
    close(false)
  }

  // Fathom numbers a note once it has it; then its pin shows.
  function mark(key, n) {
    const note = pending.get(key)
    if (!note) return
    pending.delete(key)
    mount()
    const pin = document.createElement("div")
    pin.className = "pin"
    pin.textContent = String(n)
    pins.append(pin)
    marks.set(key, {...note, pin})
    loop()
  }

  function unmark(key) {
    const note = marks.get(key) || pending.get(key)
    if (!note) return
    revert(note)
    note.pin?.remove()
    marks.delete(key)
    pending.delete(key)
  }

  function clear() {
    for (const key of [...marks.keys(), ...pending.keys()]) unmark(key)
  }

  // Overlays follow their elements through scrolling and layout changes.
  function loop() {
    if (frame) return
    const tick = () => {
      frame = null
      draw()
      if (picking || marks.size) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
  }

  function draw() {
    if (!box) return
    const target = editing?.el || (picking ? hovered : null)
    if (target?.isConnected) {
      const r = target.getBoundingClientRect()
      Object.assign(box.style, {left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`})
      tag.textContent = `${short(target)}  ${Math.round(r.width)}×${Math.round(r.height)}`
      Object.assign(tag.style, {left: `${Math.max(r.left, 4)}px`, top: `${r.top > 24 ? r.top - 22 : r.bottom + 4}px`})
      box.hidden = tag.hidden = false
    } else {
      box.hidden = tag.hidden = true
    }
    if (panel) place()
    for (const {el, pin} of marks.values()) {
      const r = el.getBoundingClientRect()
      pin.hidden = !el.isConnected || r.width + r.height === 0
      Object.assign(pin.style, {left: `${r.left}px`, top: `${r.top}px`})
    }
  }

  function place() {
    const r = editing.el.getBoundingClientRect()
    const h = panel.offsetHeight
    const top = r.bottom + 8 + h < innerHeight ? r.bottom + 8 : r.top - 8 - h > 0 ? r.top - 8 - h : innerHeight - h - 8
    panel.style.left = `${Math.min(Math.max(r.left, 8), innerWidth - 308)}px`
    panel.style.top = `${Math.max(top, 8)}px`
  }

  function short(el) {
    const classes = [...el.classList].slice(0, 2).map((c) => `.${c}`).join("")
    return el.tagName.toLowerCase() + (el.id ? `#${el.id}` : "") + classes
  }

  function snippet(el) {
    const html = el.outerHTML
    if (html.length <= 2000) return html
    const shell = el.cloneNode(false).outerHTML
    const end = shell.lastIndexOf("</")
    return end > 0 ? `${shell.slice(0, end)}…${shell.slice(end)}` : shell
  }

  function describe(el, extra) {
    const r = el.getBoundingClientRect()
    return {
      ...extra,
      url: location.href,
      title: document.title,
      selector: selectorOf(el),
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 300),
      rect: {x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height)},
      viewport: {width: innerWidth, height: innerHeight},
      source: sourceOf(el),
    }
  }

  // The shortest chain of simple steps that finds only this element.
  function selectorOf(el) {
    const steps = []
    for (let node = el; node?.nodeType === 1 && node !== document.documentElement; node = node.parentElement) {
      if (node.id && /^[A-Za-z][\w-]*$/.test(node.id) && document.querySelectorAll(`#${node.id}`).length === 1) {
        steps.unshift(`#${node.id}`)
        break
      }
      let step = node.tagName.toLowerCase()
      const classes = [...node.classList].filter((c) => /^[A-Za-z_-][\w-]*$/.test(c)).slice(0, 2)
      if (classes.length) step += `.${classes.join(".")}`
      const siblings = node.parentElement ? [...node.parentElement.children].filter((c) => c.tagName === node.tagName) : []
      if (siblings.length > 1) step += `:nth-of-type(${siblings.indexOf(node) + 1})`
      steps.unshift(step)
      try {
        if (document.querySelectorAll(steps.join(" > ")).length === 1) break
      } catch {}
    }
    return steps.join(" > ")
  }

  // Where the element comes from, when the page's framework says so in
  // development builds.
  function sourceOf(el) {
    // Phoenix with debug_heex_annotations: <!-- <Module.function> lib/file.ex:12 (app) -->
    for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
      for (let prev = node.previousSibling; prev; prev = prev.previousSibling) {
        if (prev.nodeType === 3 && !prev.textContent.trim()) continue
        if (prev.nodeType !== 8) break
        const match = prev.textContent.match(/^\s*(?:<([^>\s/][^>]*)>|@caller)\s+(\S+?):(\d+)/)
        if (match) return {via: "heex", file: match[2], line: Number(match[3]), component: match[1] || null}
      }
    }

    const fiber = Object.keys(el).find((key) => key.startsWith("__reactFiber$"))
    if (fiber) {
      let source = null
      let component = null
      for (let f = el[fiber]; f && !(source && component); f = f.return) {
        source ||= f._debugSource
        if (!component && typeof f.type === "function") component = f.type.displayName || f.type.name
      }
      if (source || component) {
        return {via: "react", file: source?.fileName ?? null, line: source?.lineNumber ?? null, component}
      }
    }

    const svelte = el.__svelte_meta?.loc
    if (svelte) return {via: "svelte", file: svelte.file, line: svelte.line, component: null}

    for (let node = el; node; node = node.parentElement) {
      const vue = node.__vueParentComponent?.type
      if (vue) return {via: "vue", file: vue.__file ?? null, line: null, component: vue.name ?? vue.__name ?? null}
    }
    return null
  }

  Object.defineProperty(window, "__fathomAnnotator", {
    value: Object.freeze({start, stop, mark, unmark, clear}),
  })
})()
