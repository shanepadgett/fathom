import os

def run(browser, output):
    routes = ["agent-focus", "agent-focus-no-session", "agent-focus-drawer", "agent-focus-project-picker",
              "agent-focus-chat-search", "editor-focus", "editor-focus-drawer",
              "editor-focus-changes"]
    audit = r'''
    (async () => {
     await document.fonts.ready;
     const assert = (ok, message) => { if (!ok) throw new Error(message); };
     const workspace = document.querySelector('workspace-layout');
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
     const overlay = workspace.querySelector('workspace-overlay');
     if (overlay) {
       const a = rect(overlay), b = rect(workspace);
       assert(['x','y','width','height'].every(k => same(a[k],b[k])), 'overlay escaped workspace');
       const prompt = overlay.querySelector('[data-search-prompt]');
       assert(same(rect(prompt.children[0]).right, rect(prompt.children[1]).left), 'caret gap');
       assert(same(rect(overlay.querySelector('[data-component="search-surface"]')).width, unit * 136), 'search width token');
     }
     const drawer = workspace.querySelector('workspace-scrim');
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
     assert(workspace.querySelector(':scope > workspace-header header button[aria-label^="Open"]'), 'title bar missing drawer control');
     assert(!workspace.querySelector('[data-component="workspace-status"] button'), 'drawer control still in footer');
     const html = workspace.innerHTML;
     for (const button of workspace.querySelectorAll('button:not([data-sidebar-toggle])')) button.click();
     assert(html === workspace.innerHTML, 'static button changed state');
     assert(!document.querySelector('dialog[open]'), 'global modal opened');
     const toggle = workspace.querySelector('[data-sidebar-toggle]');
     const sidebar = workspace.querySelector('workspace-body > workspace-sidebar');
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

