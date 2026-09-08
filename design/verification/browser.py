"""Opt-in browser verification from the local hook; requires the design server."""
import os
import subprocess
from pathlib import Path

output = Path("/tmp/fathom-component-verification")
output.mkdir(exist_ok=True)
env = dict(os.environ, MISE_NODE_VERSION="24.12.0")

def browser(*args, source=None):
    result = subprocess.run(["agent-browser", *args], input=source, text=True,
                            capture_output=True, env=env, check=True)
    return result.stdout

# Viewer navigation: deep links reveal their group, compact labels fit, and
# independently scrolling navigation keeps the appearance control reachable.
for width in [1554, 390]:
    browser("set", "viewport", str(width), "900")
    for theme in ["light", "dark"]:
        browser("open", "http://127.0.0.1:5175/#/screens/agent-focus")
        browser("eval", "--stdin", source=f"document.documentElement.dataset.theme='{theme}'")
        browser("eval", "--stdin", source=r"""
(async () => {
 await document.fonts.ready;
 const assert = (ok, message) => { if (!ok) throw new Error(message); };
 const drawer = document.querySelector('[data-drawer]');
 if (drawer.hidden) document.querySelector('[data-drawer-open] button').click();
 const nav = drawer.querySelector('nav');
 const selected = nav.querySelector('[aria-current="page"]');
 assert(selected.textContent.trim() === 'Session open', 'screen label repeats family');
 assert(selected.closest('details').open, 'deep link group closed');
 for (const group of nav.querySelectorAll('details')) group.open = true;
 assert(nav.scrollWidth === nav.clientWidth, 'navigation overflow');
 const footer = drawer.querySelector('[data-theme-toggle]');
 assert(footer.getBoundingClientRect().bottom <= innerHeight, 'appearance control offscreen');
 const oldTheme = document.documentElement.dataset.theme;
 footer.click();
 assert(document.documentElement.dataset.theme !== oldTheme, 'theme toggle failed');
 footer.click();
 document.querySelector('[data-brand] button').click();
 assert(drawer.hidden, 'viewer did not close');
 document.querySelector('[data-drawer-open] button').click();
 assert(!drawer.hidden, 'viewer did not reopen');
 for (const group of nav.querySelectorAll('details')) group.open = group.contains(selected) || group.textContent.includes('Editor focus');
 return 'passed';
})()
""")
        browser("screenshot", str(output / f"viewer-navigation-{theme}-{width}.png"))
print("Passed 4 viewer navigation/theme/viewport checks.")

# Hidden navigation edge tab follows the pointer and remains keyboard reachable.
browser("set", "viewport", "1554", "900")
browser("open", "http://127.0.0.1:5175/#/components")
browser("click", "[data-brand] button")
browser("mouse", "move", "600", "400")
browser("eval", "--stdin", source="Promise.all(document.getAnimations().map(a => a.finished))")
browser("eval", "--stdin", source="""
(() => {
 const tab = document.querySelector('[data-drawer-open]');
 if (getComputedStyle(tab).opacity !== '0') throw new Error('edge tab visible away from edge');
})()
""")
for y in [250, 650, 2, 898]:
    browser("mouse", "move", "600", str(y))
    browser("mouse", "move", "8", str(y))
    browser("eval", "--stdin", source="Promise.all(document.getAnimations().map(a => a.finished))")
    browser("eval", "--stdin", source=f"""
(() => {{
 const tab = document.querySelector('[data-drawer-open]');
 const r = tab.getBoundingClientRect();
 if (getComputedStyle(tab).opacity !== '1') throw new Error('edge tab not revealed');
 if (r.top < 0 || r.bottom > innerHeight) throw new Error('edge tab outside viewport');
 if ({y} > r.height && {y} < innerHeight - r.height && Math.abs(r.top + r.height / 2 - {y}) > 1) throw new Error('tab does not follow pointer');
}})()
""")
# Each fresh approach starts at the pointer height, without gliding from the old position.
browser("eval", "--stdin", source="""
(() => {
 const tab = document.querySelector('[data-drawer-open]');
 for (const y of [220, 680]) {
   window.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: 600, clientY: y }));
   window.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: 8, clientY: y }));
   const r = tab.getBoundingClientRect();
   if (Math.abs(r.top + r.height / 2 - y) > 1) throw new Error('fresh reveal glides from previous height');
 }
})()
""")
# Move within the tab itself: it must keep centering, with eased movement.
browser("mouse", "move", "8", "450")
browser("eval", "--stdin", source="Promise.all(document.getAnimations().map(a => a.finished))")
browser("eval", "--stdin", source="""
(async () => {
 const tab = document.querySelector('[data-drawer-open]');
 const button = tab.querySelector('button');
 const start = tab.getBoundingClientRect().top;
 button.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: 8, clientY: 470 }));
 if (parseFloat(tab.style.top) !== 470) throw new Error('pointer inside tab stops tracking');
 if (Math.abs(tab.getBoundingClientRect().top - start) > 1) throw new Error('movement snapped instead of easing');
 await Promise.all(tab.getAnimations().map(a => a.finished));
 const r = tab.getBoundingClientRect();
 if (Math.abs(r.top + r.height / 2 - 470) > 1) throw new Error('eased tab did not center');
 const style = getComputedStyle(button);
 if (parseFloat(style.borderTopLeftRadius) !== 0 || parseFloat(style.borderTopRightRadius) >= r.width / 2) throw new Error('incorrect edge tab corners');
})()
""")
browser("screenshot", str(output / "viewer-edge-tab.png"))
browser("click", "[data-drawer-open] button")
browser("eval", "--stdin", source="if (document.querySelector('[data-drawer]').hidden) throw new Error('edge tab did not open sidebar')")
browser("click", "[data-brand] button")
browser("mouse", "move", "600", "400")
browser("eval", "--stdin", source="document.querySelector('[data-drawer-open] button').focus()")
browser("eval", "--stdin", source="Promise.all(document.getAnimations().map(a => a.finished))")
browser("eval", "--stdin", source="if (getComputedStyle(document.querySelector('[data-drawer-open]')).opacity !== '1') throw new Error('keyboard focus did not reveal tab')")
browser("press", "Enter")
browser("eval", "--stdin", source="if (document.querySelector('[data-drawer]').hidden) throw new Error('keyboard did not open sidebar')")
print("Passed edge reveal, pointer tracking, viewport clamping, and keyboard checks.")

routes = ["agent-focus", "agent-focus-no-session", "agent-focus-drawer", "agent-focus-project-picker",
          "agent-focus-chat-search", "editor-focus", "editor-focus-drawer",
          "editor-focus-changes"]
audit = r'''
(async () => {
 await document.fonts.ready;
 const assert = (ok, message) => { if (!ok) throw new Error(message); };
 const workspace = document.querySelector('[data-workspace]');
 assert(workspace, 'missing workspace');
 const rect = el => el.getBoundingClientRect();
 const same = (a,b) => Math.abs(a-b) < 1;
 const root = getComputedStyle(document.documentElement);
 const unit = parseFloat(root.getPropertyValue('--spacing')) * parseFloat(root.fontSize);
 assert(same(rect(workspace).height, unit * 192), 'preview height token did not compile');
 for (const row of workspace.querySelectorAll('[data-file-row]')) {
   assert(same(rect(row).height, unit * 6), 'file row density changed');
 }
 const crumb = workspace.querySelector('[data-component="breadcrumbs"]');
 if (crumb) assert(same(rect(crumb).height, unit * 9), 'breadcrumb height changed');
 const overlay = workspace.querySelector('[data-workspace-overlay]');
 if (overlay) {
   const a = rect(overlay), b = rect(workspace);
   assert(['x','y','width','height'].every(k => same(a[k],b[k])), 'overlay escaped workspace');
   const prompt = overlay.querySelector('[data-search-prompt]');
   assert(same(rect(prompt.children[0]).right, rect(prompt.children[1]).left), 'caret gap');
   assert(same(rect(overlay.querySelector('[data-component="search-surface"]')).width, unit * 136), 'search width token');
 }
 const drawer = workspace.querySelector('[data-drawer-overlay]');
 if (drawer) {
   const a = rect(drawer), b = rect(workspace);
   assert(['x','y','width','height'].every(k => same(a[k],b[k])), 'drawer escaped workspace');
   assert(drawer.querySelector('header button[aria-label^="Close"] .ph-caret-double-right'), 'drawer header missing reversed close control');
 }
 for (const composer of workspace.querySelectorAll('[data-component="composer"]')) {
   const glass = composer.closest('[data-composer-overlay]').querySelector('.composer-bottom-glass');
   assert(getComputedStyle(glass).backdropFilter === 'blur(4px)', 'composer blur token unresolved');
   assert(parseFloat(getComputedStyle(composer).borderBottomLeftRadius) > 0, 'composer not rounded');
   const a = rect(composer), b = rect(composer.closest('[data-composer-overlay]'));
   assert(a.left > b.left && a.right < b.right && a.bottom < b.bottom, 'composer not floating');
 }
 assert(!workspace.querySelector('dialog,details,input,a'), 'application behavior in static study');
 assert(workspace.querySelector(':scope > header button[aria-label^="Open"]'), 'title bar missing drawer control');
 assert(!workspace.querySelector('[data-component="workspace-status"] button'), 'drawer control still in footer');
 const html = workspace.innerHTML;
 for (const button of workspace.querySelectorAll('button:not([data-sidebar-toggle])')) button.click();
 assert(html === workspace.innerHTML, 'static button changed state');
 assert(!document.querySelector('dialog[open]'), 'global modal opened');
 const toggle = workspace.querySelector('[data-sidebar-toggle]');
 const sidebar = workspace.querySelector('[data-workspace-body] > aside');
 const width = rect(sidebar).width;
 toggle.click();
 assert(getComputedStyle(sidebar).display === 'none' && toggle.getAttribute('aria-expanded') === 'false', 'sidebar did not close');
 toggle.click();
 assert(same(rect(sidebar).width, width) && toggle.getAttribute('aria-expanded') === 'true', 'sidebar did not reopen at original width');
 return 'passed';
})()
'''
if os.environ.get("FATHOM_VERIFY_BROWSER") != "catalog":
    for width in [1554, 851]:
        browser("set", "viewport", str(width), "1080")
        for theme in ["light", "dark"]:
            for route in routes:
                browser("open", "http://127.0.0.1:5175/#/screens/" + route)
                browser("eval", "--stdin", source=f"document.documentElement.dataset.theme='{theme}'")
                browser("eval", "--stdin", source=audit)
                browser("screenshot", str(output / f"{route}-{theme}-{width}.png"))
    print(f"Passed {len(routes) * 4} workspace/theme/viewport checks. Screenshots: {output}")

# Independent composite cases catch regressions hidden by the wide workspaces.
browser("set", "viewport", "1554", "1080")
for component in ["workspace-controls", "status-and-usage", "chat-navigation", "search-surfaces", "file-navigation", "conversation-content", "composer", "editor-pane", "diff-pane", "session-inspector", "workspace-chrome"]:
    browser("open", "http://127.0.0.1:5175/#/components/" + component)
    browser("eval", "--stdin", source=r"""
(async () => {
 await document.fonts.ready;
 const assert = (ok, message) => { if (!ok) throw new Error(message); };
 const content = document.querySelector('[data-content]');
 assert(content && !content.textContent.includes('Not found'), 'missing catalog entry');
 const ids = [...content.querySelectorAll('[id]')].map(el => el.id);
 assert(ids.length === new Set(ids).size, 'duplicate preview IDs');
 for (const title of content.querySelectorAll('[data-chat-item] p[title]')) {
   assert(getComputedStyle(title).textOverflow === 'ellipsis', 'chat title not ellipsized');
   assert(title.getBoundingClientRect().right <= title.parentElement.getBoundingClientRect().right, 'title escaped row');
 }
 for (const composer of content.querySelectorAll('[data-component="composer"]')) {
   for (const button of composer.querySelectorAll('button')) {
     assert(button.getBoundingClientRect().right <= composer.getBoundingClientRect().right, 'composer toolbar overflow');
   }
 }
 return 'passed';
})()
""")
    browser("screenshot", str(output / f"component-{component}.png"))
print("Passed 11 composite/primitive catalog checks.")

# Exercise real pointer capture, direction, bounds, and keyboard reset.
import json
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
