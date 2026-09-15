import "monaco-editor/languages/definitions/typescript/register.js";
import "monaco-editor/languages/definitions/markdown/register.js";
import "monaco-editor/languages/definitions/python/register.js";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";

(self as typeof self & { MonacoEnvironment: unknown }).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

const language: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".json": "json",
  ".md": "markdown",
  ".py": "python",
  ".css": "css",
  ".html": "html",
  ".sh": "shell",
};

export function editorLanguage(extension: string) {
  return language[extension] ?? "plaintext";
}
