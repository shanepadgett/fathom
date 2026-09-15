/** Resolved shared tokens for widgets that cannot use CSS variables directly. */
export function widgetTokens(element: HTMLElement) {
  const styles = getComputedStyle(element);
  const token = (name: string) => styles.getPropertyValue(name).trim();
  const pixels = (name: string) => {
    const value = token(name);
    return parseFloat(value) *
      (value.endsWith("rem")
        ? parseFloat(getComputedStyle(document.documentElement).fontSize)
        : 1);
  };
  return {
    canvas: token("--color-canvas"),
    surface: token("--color-surface"),
    ink: token("--color-ink"),
    muted: token("--color-muted"),
    line: token("--color-line"),
    action: token("--color-action"),
    onAction: token("--color-on-action"),
    success: token("--color-success"),
    warning: token("--color-warning"),
    danger: token("--color-danger"),
    fontFamily: token("--font-mono"),
    fontSize: pixels("--text-sm"),
    lineHeight: parseFloat(token("--leading-relaxed")),
    spacing: pixels("--spacing"),
  };
}

export function widgetTheme(element: HTMLElement) {
  const tokens = widgetTokens(element);
  return {
    background: tokens.canvas,
    foreground: tokens.ink,
    cursor: tokens.action,
    cursorAccent: tokens.onAction,
    fontFamily: tokens.fontFamily,
  };
}
