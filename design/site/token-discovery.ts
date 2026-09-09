export function tokenNames() {
  const names = new Set<string>();
  const collect = (rules: CSSRuleList) => {
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule && rule.selectorText.includes(":root")) {
        for (const name of rule.style) {
          if (name.startsWith("--") && !name.startsWith("--tw-") && !name.includes("-viewer-")) {
            names.add(name);
          }
        }
      }
      if (rule instanceof CSSGroupingRule) collect(rule.cssRules);
    }
  };
  for (const sheet of document.styleSheets) {
    try {
      collect(sheet.cssRules);
    } catch (error) {
      // Google Fonts stylesheets are not readable across origins.
      if (!(error instanceof DOMException && error.name === "SecurityError")) {
        throw error;
      }
    }
  }

  return [...names];
}
