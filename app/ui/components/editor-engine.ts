import type { Diagnostic, FileRange } from "../../sdk/editor.ts";
import type { EditorPosition } from "./editor-status.tsx";

import * as monaco from "monaco-editor/editor/editor.api.js";

import { type CompleteDocument, registerEditorCompletion } from "./editor-completion.ts";
import { bindEditorLanguage, editorLanguageName } from "./editor-languages.ts";
import { editorLanguage } from "./editor-runtime.ts";
import { editorTheme } from "./editor-theme.ts";

export interface EditorDocument {
  path: string;
  uri: string;
  text: string;
  version: string;
  extension: string;
  diagnostics: Diagnostic[];
}

export function mountEditor(
  container: HTMLElement,
  changed: (text: string) => void,
  theme: string,
  positionChanged: (position: EditorPosition | undefined) => void,
  complete: CompleteDocument,
  initialViews?: Map<string, monaco.editor.ICodeEditorViewState>,
  projectId = "",
) {
  const editor = monaco.editor.create(container, {
    ...editorTheme(container, theme),
    automaticLayout: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
  });
  const highlight = editor.createDecorationsCollection();
  let highlightTimer: ReturnType<typeof setTimeout> | undefined;
  let model: monaco.editor.ITextModel | undefined;
  const models = new Map<string, monaco.editor.ITextModel>();
  const paths = new Map<string, string>();
  const completion = registerEditorCompletion((candidate) => {
    const uri = candidate.uri.toString();
    return models.get(uri) === candidate ? paths.get(uri) : undefined;
  }, complete);
  const views = new Map<string, monaco.editor.ICodeEditorViewState>(initialViews);
  const rememberView = () => {
    const view = editor.saveViewState();
    if (model && view) views.set(model.uri.toString(), view);
  };
  let updating = false;
  const listener = editor.onDidChangeModelContent(() => {
    if (!updating && model) changed(model.getValue());
  });
  const publishPosition = () => {
    const position = editor.getPosition();
    positionChanged(
      model && position
        ? {
            line: position.lineNumber,
            column: position.column,
            language: editorLanguageName(model.getLanguageId()),
          }
        : undefined,
    );
  };
  const cursorListener = editor.onDidChangeCursorPosition(publishPosition);
  const languageListener = editor.onDidChangeModelLanguage(publishPosition);
  return {
    update(document: EditorDocument, sync = true) {
      paths.set(document.uri, document.path);
      updating = true;
      try {
        if (!model || model.uri.toString() !== document.uri) {
          rememberView();
          model = models.get(document.uri);
          if (!model) {
            model = monaco.editor.createModel(
              document.text,
              editorLanguage(document.extension),
              monaco.Uri.parse(document.uri),
            );
            models.set(document.uri, model);
            bindEditorLanguage(model, projectId, document.path, editorLanguage(document.extension));
          }
          editor.setModel(model);
          editor.restoreViewState(views.get(document.uri) ?? null);
        }
        if (sync && model.getValue() !== document.text) {
          model.setValue(document.text);
        }
        monaco.editor.setModelMarkers(
          model,
          "fathom-lsp",
          document.diagnostics.map((diagnostic) => ({
            message: diagnostic.message,
            severity:
              diagnostic.severity === 2
                ? monaco.MarkerSeverity.Warning
                : diagnostic.severity === 3
                  ? monaco.MarkerSeverity.Info
                  : diagnostic.severity === 4
                    ? monaco.MarkerSeverity.Hint
                    : monaco.MarkerSeverity.Error,
            startLineNumber: diagnostic.range.start.line + 1,
            startColumn: diagnostic.range.start.character + 1,
            endLineNumber: diagnostic.range.end.line + 1,
            endColumn: diagnostic.range.end.character + 1,
          })),
        );
      } finally {
        updating = false;
        publishPosition();
      }
    },
    saveViews() {
      rememberView();
      return new Map(views);
    },
    close(uri: string) {
      const closing = models.get(uri);
      if (closing === model) {
        editor.setModel(null);
        model = undefined;
      }
      closing?.dispose();
      models.delete(uri);
      paths.delete(uri);
      views.delete(uri);
      publishPosition();
    },
    clear() {
      rememberView();
      editor.setModel(null);
      model = undefined;
      positionChanged(undefined);
    },
    reveal(range: FileRange) {
      if (!model || !Number.isSafeInteger(range.startLine) || !Number.isSafeInteger(range.endLine))
        return;
      const start = Math.max(1, Math.min(range.startLine, model.getLineCount()));
      const end = Math.max(start, Math.min(range.endLine, model.getLineCount()));
      editor.setPosition({ lineNumber: start, column: 1 });
      editor.revealLinesInCenter(start, end, monaco.editor.ScrollType.Smooth);
      highlight.set([
        {
          range: new monaco.Range(start, 1, end, 1),
          options: {
            isWholeLine: true,
            className: "fathom-file-highlight",
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        },
      ]);
      clearTimeout(highlightTimer);
      highlightTimer = setTimeout(() => highlight.clear(), 4000);
    },
    focus() {
      editor.focus();
    },
    setTheme(value: string) {
      editor.updateOptions(editorTheme(container, value));
    },
    dispose() {
      clearTimeout(highlightTimer);
      highlight.clear();
      completion.dispose();
      cursorListener.dispose();
      languageListener.dispose();
      listener.dispose();
      editor.dispose();
      for (const item of models.values()) item.dispose();
      models.clear();
      paths.clear();
      views.clear();
    },
  };
}
