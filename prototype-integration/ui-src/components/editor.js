import * as monaco from "monaco-editor/editor/editor.api.js";
import "monaco-editor/languages/definitions/typescript/register.js";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };

export function mountEditor(container, changed) {
  const editor = monaco.editor.create(container, {
    theme: "vs-dark",
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
    scrollBeyondLastLine: false,
  });
  let model,
    updating = false;
  const subscription = editor.onDidChangeModelContent(() => {
    if (!updating) changed(model.getValue());
  });
  return {
    update(doc, syncText = true) {
      updating = true;
      try {
        if (!model || model.uri.toString() !== doc.uri) {
          model?.dispose();
          model = monaco.editor.createModel(doc.text, "typescript", monaco.Uri.parse(doc.uri));
          editor.setModel(model);
        } else if (syncText && model.getValue() !== doc.text) {
          model.setValue(doc.text);
        }
        monaco.editor.setModelMarkers(
          model,
          "deno-lsp",
          doc.diagnostics.map((d) => ({
            message: d.message,
            source: d.source,
            code: d.code === undefined ? undefined : String(d.code),
            severity: { 1: 8, 2: 4, 3: 2, 4: 1 }[d.severity] ?? 8,
            startLineNumber: d.range.start.line + 1,
            startColumn: d.range.start.character + 1,
            endLineNumber: d.range.end.line + 1,
            endColumn: d.range.end.character + 1,
          })),
        );
        container.dataset.markerCount = String(doc.diagnostics.length);
      } finally {
        updating = false;
      }
    },
    dispose() {
      subscription.dispose();
      editor.dispose();
      model?.dispose();
    },
  };
}
