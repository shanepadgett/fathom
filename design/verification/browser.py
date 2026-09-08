"""Opt-in browser verification; requires the local design server."""
import os
from pathlib import Path

from browser_driver import browser
from browser_cases import registration, navigation, edge_reveal, workspaces, catalog, resizing, tokens, overlays, screen_return

output = Path(os.environ.get("FATHOM_VERIFY_OUTPUT", "/tmp/fathom-component-verification"))
output.mkdir(exist_ok=True)
browser("set", "viewport", "1554", "900")
browser("open", "http://127.0.0.1:5175/#/screens/agent-focus")
# Start from the same viewer width rather than a previous run's narrow viewport.
browser("eval", "--stdin", source="localStorage.removeItem('fathom-design-sidebar-width')")
browser("eval", "--stdin", source="document.querySelector('[data-drawer-resizer]').dispatchEvent(new MouseEvent('dblclick', {bubbles: true}))")
print(browser("eval", "--stdin", source="(async () => (await import('/verification/contracts.ts')).verifyContracts())()"))
for case in [registration, navigation, edge_reveal, workspaces, catalog, resizing, tokens, overlays, screen_return]:
    case.run(browser, output)
