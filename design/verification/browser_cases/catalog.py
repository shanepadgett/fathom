def run(browser, output):
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

