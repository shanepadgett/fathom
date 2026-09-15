import * as monaco from "monaco-editor/editor/editor.api.js";

import { widgetTokens } from "../theme.ts";

const definitions = new Map<string, string>();

/** Keep Monaco's painted surfaces and syntax aligned with the approved code preview. */
export function editorTheme(element: HTMLElement, mode: string) {
  const tokens = widgetTokens(element);
  const name = `fathom-${mode === "dark" ? "dark" : "light"}`;
  const foreground = (value: string) => value.replace(/^#/, "");
  const signature = JSON.stringify(tokens);
  if (definitions.get(name) !== signature) {
    monaco.editor.defineTheme(name, {
      base: mode === "dark" ? "vs-dark" : "vs",
      inherit: false,
      rules: [
        { token: "", foreground: foreground(tokens.ink) },
        { token: "comment", foreground: foreground(tokens.muted) },
        { token: "keyword", foreground: foreground(tokens.action) },
        { token: "string", foreground: foreground(tokens.success) },
        { token: "number", foreground: foreground(tokens.warning) },
        { token: "regexp", foreground: foreground(tokens.success) },
        { token: "invalid", foreground: foreground(tokens.danger) },
      ],
      colors: {
        "editor.background": tokens.canvas,
        "editor.foreground": tokens.ink,
        "editorGutter.background": tokens.canvas,
        "editorLineNumber.foreground": tokens.muted,
        "editorLineNumber.activeForeground": tokens.ink,
        "editorCursor.foreground": tokens.action,
        "editor.selectionBackground": tokens.action + "33",
        "editor.inactiveSelectionBackground": tokens.action + "1a",
        "editor.lineHighlightBorder": tokens.line,
        "editorIndentGuide.background1": tokens.line,
        "editorIndentGuide.activeBackground1": tokens.muted,
        "editorError.foreground": tokens.danger,
        "editorWarning.foreground": tokens.warning,
        "editorInfo.foreground": tokens.action,
        "editorHint.foreground": tokens.muted,
        "editorWidget.background": tokens.surface,
        "editorWidget.foreground": tokens.ink,
        "editorWidget.border": tokens.line,
        "editorSuggestWidget.background": tokens.surface,
        "editorSuggestWidget.foreground": tokens.ink,
        "editorSuggestWidget.border": tokens.line,
        "editorSuggestWidget.selectedBackground": tokens.line,
        "editorSuggestWidget.selectedForeground": tokens.ink,
        "editorSuggestWidget.highlightForeground": tokens.action,
        "editorSuggestWidget.focusHighlightForeground": tokens.action,
        "symbolIcon.methodForeground": tokens.action,
        "symbolIcon.functionForeground": tokens.action,
        "symbolIcon.constructorForeground": tokens.action,
        "symbolIcon.classForeground": tokens.action,
        "symbolIcon.interfaceForeground": tokens.action,
        "symbolIcon.variableForeground": tokens.ink,
        "symbolIcon.propertyForeground": tokens.ink,
        "symbolIcon.fieldForeground": tokens.ink,
        "symbolIcon.stringForeground": tokens.success,
        "symbolIcon.numberForeground": tokens.warning,
        "symbolIcon.keywordForeground": tokens.action,
        "focusBorder": tokens.action,
        "diffEditor.insertedTextBackground": tokens.success + "26",
        "diffEditor.removedTextBackground": tokens.danger + "26",
        "diffEditor.insertedLineBackground": tokens.success + "1a",
        "diffEditor.removedLineBackground": tokens.danger + "1a",
        "diffEditor.border": tokens.line,
        "diffEditor.diagonalFill": tokens.line,
      },
    });
    definitions.set(name, signature);
  }
  return {
    theme: name,
    fontFamily: tokens.fontFamily,
    fontSize: tokens.fontSize,
    lineHeight: tokens.fontSize * tokens.lineHeight,
    padding: { top: tokens.spacing * 4, bottom: tokens.spacing * 4 },
  };
}
