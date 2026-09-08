import json


def run(browser, output):
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
            # Match the baseline's hovered resize edge rather than the last scenario's pointer.
            edge = json.loads(browser("eval", "--stdin", source="(() => { const r = document.querySelector('[data-drawer-resizer]').getBoundingClientRect(); return {x: r.x + r.width / 2, y: 100}; })()"))
            browser("mouse", "move", str(round(edge["x"])), str(round(edge["y"])))
            browser("eval", "--stdin", source="Promise.all(document.getAnimations().map(a => a.finished))")
            browser("screenshot", str(output / f"viewer-navigation-{theme}-{width}.png"))
    print("Passed 4 viewer navigation/theme/viewport checks.")

