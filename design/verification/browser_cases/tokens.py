def run(browser, output):
    # Token templates keep category focus while compiled theme values change.
    for width in [1554, 390]:
        browser("set", "viewport", str(width), "900")
        browser("open", "http://127.0.0.1:5175/#/tokens")
        for theme in ["light", "dark"]:
            browser("eval", "--stdin", source=f"document.documentElement.dataset.theme='{theme}'")
            browser("eval", "--stdin", source=r"""
    (async () => {
     const view = document.querySelector('tokens-view');
     await view.updateComplete;
     const assert = (ok, message) => { if (!ok) throw new Error(message); };
     for (const button of view.querySelectorAll('nav button')) {
       button.focus();
       button.click();
       await view.updateComplete;
       assert(button.getAttribute('aria-pressed') === 'true', 'token category selection');
       const panel = view.querySelector('#' + button.getAttribute('aria-controls'));
       assert(!panel.hidden && panel.querySelector('dt'), 'token category empty or hidden');
       const theme = document.documentElement.dataset.theme;
       document.documentElement.dataset.theme = theme === 'dark' ? 'light' : 'dark';
       await new Promise(requestAnimationFrame);
       assert(document.activeElement === button, 'theme update lost category focus');
       document.documentElement.dataset.theme = theme;
       await new Promise(requestAnimationFrame);
     }
     view.querySelector('nav button').click();
     await view.updateComplete;
     const role = [...view.querySelectorAll('dt')].find(el => el.textContent.trim() === '--color-action');
     assert(role && getComputedStyle(role.parentElement).backgroundColor !== 'rgba(0, 0, 0, 0)', 'token color missing');
     return 'passed';
    })()
    """)
            browser("screenshot", str(output / f"tokens-{theme}-{width}.png"))
    browser("set", "media", "light", "reduced-motion")
    browser("eval", "--stdin", source=r"""
    (async () => {
     const view = document.querySelector('tokens-view');
     await new Promise(requestAnimationFrame);
     await view.updateComplete;
     if (view.getAnimations({subtree: true}).length) throw new Error('token motion ignores reduced motion');
    })()
    """)
    browser("set", "media", "light")
    print("Passed token categories, theme updates, focus retention, and reduced motion checks.")

