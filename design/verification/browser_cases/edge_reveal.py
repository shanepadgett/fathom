def run(browser, output):
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

