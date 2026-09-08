import json
import re
from pathlib import Path


def run(browser, output):
    root = Path(__file__).resolve().parents[2]
    modules = []
    for folder in ["components", "composites", "layouts", "screens"]:
        for path in sorted((root / folder).glob("*.ts")):
            for tag in re.findall(r'customElements\.define\("([\w-]+)"', path.read_text()):
                modules.append([str(path.relative_to(root)), tag])
    source = r"""
(async () => {
  for (const [path, tag] of MODULES) {
    const frame = document.createElement('iframe');
    frame.style.visibility = 'hidden';
    try {
      const loaded = new Promise(resolve => frame.addEventListener('load', resolve, {once: true}));
      frame.src = 'about:blank';
      document.body.append(frame);
      await loaded;
      const win = frame.contentWindow;
      const errors = [];
      win.addEventListener('error', event => errors.push(event.message));
      win.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
      await win.eval('import(' + JSON.stringify(new URL('/' + path, location.href).href) + ')');
      if (!win.customElements.get(tag)) throw new Error(path + ': own tag not registered');
      const element = win.document.createElement(tag);
      win.document.body.append(element);
      await new Promise(resolve => win.requestAnimationFrame(resolve));
      for (const child of element.querySelectorAll('*')) {
        if (child.localName.includes('-') && !win.customElements.get(child.localName)) {
          throw new Error(path + ': unregistered child ' + child.localName);
        }
      }
      if (errors.length) throw new Error(path + ': ' + errors.join('; '));
    } finally {
      frame.remove();
    }
  }
  return 'passed';
})()
""".replace("MODULES", json.dumps(modules))
    browser("eval", "--stdin", source=source)
    print(f"Passed {len(modules)} isolated module registration checks.")
