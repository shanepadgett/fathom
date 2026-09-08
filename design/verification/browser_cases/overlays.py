def run(browser, output):
    # Functional demos remain separate from static workspace previews.
    browser("open", "http://127.0.0.1:5175/index.html?preview=modal&example=0")
    browser("click", "[data-open]")
    browser("eval", "--stdin", source="if (!document.querySelector('dialog').open) throw new Error('modal did not open')")
    browser("press", "Escape")
    browser("eval", "--stdin", source="if (document.querySelector('dialog').open) throw new Error('modal did not close')")
    browser("open", "http://127.0.0.1:5175/#/components/accordion")
    browser("eval", "--stdin", source=r"""
    (() => {
     for (const group of document.querySelectorAll('ds-accordion')) {
       const items = group.querySelectorAll('details');
       items[1].querySelector('summary').click();
       if (!items[1].open || items[0].open !== group.hasAttribute('multiple')) throw new Error('accordion grouping changed');
     }
    })()
    """)
    print("Passed modal keyboard close and independent accordion group checks.")
