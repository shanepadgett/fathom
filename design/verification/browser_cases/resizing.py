import json

def run(browser, output):
    # Exercise real pointer capture, direction, bounds, and keyboard reset.
    browser("set", "viewport", "1727", "1080")
    for route, label in [
        ("viewer", "Design navigation"),
        ("agent-focus", "Project sessions"),
        ("agent-focus", "Session inspector"),
        ("editor-focus", "Workspace files"),
        ("agent-focus-drawer", "File diff overlay"),
        ("editor-focus-drawer", "Agent overlay"),
        ("preview=drawer&example=0", "demo"),
        ("preview=drawer&example=1", "demo"),
        ("preview=drawer&example=2", "demo"),
    ]:
        query = route if label == "demo" else "screen=" + route
        browser("open", "http://127.0.0.1:5175/#/screens/agent-focus" if route == "viewer" else "http://127.0.0.1:5175/index.html?" + query)
        if route == "viewer":
            # Previous viewport cases can resize this same viewer instance.
            browser("eval", "--stdin", source="document.querySelector('[data-drawer-resizer]').dispatchEvent(new MouseEvent('dblclick', {bubbles: true}))")
        if label == "demo":
            browser("click", "[data-open]")
            browser("wait", "--fn", "document.querySelector('edge-resizer').getBoundingClientRect().width > 0")
            browser("eval", "--stdin", source="Promise.all(document.getAnimations().map(a => a.finished))")
        selector = '[aria-label="' + label + '"] > edge-resizer'
        if label == "demo":
            selector = "edge-resizer"
        setup = """(() => {
          const h = document.querySelector(SELECTOR);
          const r = h.getBoundingClientRect();
          const panel = h.parentElement;
          const p = panel.getBoundingClientRect();
          const left = h.getAttribute('edge') === 'left';
          const border = parseFloat(getComputedStyle(panel)[left ? 'borderLeftWidth' : 'borderRightWidth']);
          const edge = left ? p.left + border / 2 : p.right - border / 2;
          const center = r.x + r.width / 2;
          if (Math.abs(center - edge) > 0.1) throw new Error('handle not centered on border');
          for (const x of [center - 2, center + 2]) {
            if (document.elementFromPoint(x, r.y + 100) !== h) throw new Error('resize handle clipped or covered across border');
          }
          globalThis.resizeHandle = h;
          globalThis.resizeStart = h.parentElement.getBoundingClientRect().width;
          return { x: r.x + r.width / 2, y: r.y + 100,
            delta: h.getAttribute('edge') === 'left' ? -60 : 60 };
        })()""".replace("SELECTOR", json.dumps(selector))
        point = json.loads(browser("eval", "--stdin", source=setup))
        browser("mouse", "move", str(round(point["x"])), str(round(point["y"])))
        browser("eval", "--stdin", source="Promise.all(document.getAnimations().map(a => a.finished))")
        browser("eval", "--stdin", source="""(() => {
          const style = getComputedStyle(globalThis.resizeHandle, '::after');
          if (parseFloat(style.width) !== 1 || style.opacity !== '1' || style.boxShadow === 'none') throw new Error('resize line or glow missing');
        })()""")
        browser("screenshot", str(output / f"resize-glow-{route.replace('&', '-')}.png"))
        browser("mouse", "down", "left")
        browser("mouse", "move", str(round(point["x"] + point["delta"])), str(round(point["y"])))
        browser("mouse", "up", "left")
        browser("eval", "--stdin", source="""(() => {
          const h = globalThis.resizeHandle, p = h.parentElement;
          const assert = (ok, message) => { if (!ok) throw new Error(message); };
          const width = () => p.getBoundingClientRect().width;
          assert(Math.abs(width() - globalThis.resizeStart - 60) < 2, 'drag width/direction');
          assert(!h.hasAttribute('dragging') && document.body.style.userSelect !== 'none', 'drag cleanup');
          for (const [key, attr] of [['Home','aria-valuemin'], ['End','aria-valuemax']]) {
            h.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true}));
            assert(Math.abs(width() - Number(h.getAttribute(attr))) < 2, 'width bound');
          }
          h.dispatchEvent(new MouseEvent('dblclick', {bubbles: true}));
          assert(Math.abs(width() - globalThis.resizeStart) < 2, 'reset default width');
          return 'passed';
        })()""")
    print("Passed 9 pointer resize, bounds, cleanup, and reset checks.")

