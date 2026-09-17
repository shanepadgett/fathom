import type { FileDiff } from "../../sdk/git.ts";

import * as monaco from "monaco-editor/editor/editor.api.js";

import { bindEditorLanguage } from "./editor-languages.ts";
import { editorLanguage } from "./editor-runtime.ts";
import { editorTheme } from "./editor-theme.ts";

export function mountDiff(element: HTMLElement, document: FileDiff, theme: string, projectId = "") {
  const language = editorLanguage(document.path.slice(document.path.lastIndexOf(".")));
  const original = monaco.editor.createModel(document.original, language);
  const modified = monaco.editor.createModel(document.modified, language);
  bindEditorLanguage(original, projectId, document.path, language);
  bindEditorLanguage(modified, projectId, document.path, language);
  const editor = monaco.editor.createDiffEditor(element, {
    ...editorTheme(element, theme),
    automaticLayout: true,
    readOnly: true,
    originalEditable: false,
    renderSideBySide: false,
    useInlineViewWhenSpaceIsLimited: false,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
  });
  editor.setModel({ original, modified });
  let positioned = false;
  const changes = editor.onDidUpdateDiff(() => {
    if (positioned) return;
    const first = editor.getLineChanges()?.[0];
    if (!first) return;
    positioned = true;
    const lineNumber = Math.max(1, first.modifiedStartLineNumber);
    editor.getModifiedEditor().setPosition({ lineNumber, column: 1 });
    editor.getModifiedEditor().revealLineInCenter(lineNumber);
  });
  return {
    navigate(direction: "next" | "previous") {
      editor.goToDiff(direction);
    },
    update(theme: string, sideBySide: boolean) {
      editor.updateOptions({
        ...editorTheme(element, theme),
        renderSideBySide: sideBySide,
      });
    },
    dispose() {
      changes.dispose();
      editor.dispose();
      original.dispose();
      modified.dispose();
    },
  };
}
