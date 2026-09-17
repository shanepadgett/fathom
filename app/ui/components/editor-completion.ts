import type { CompletionPosition, CompletionRange, CompletionResult } from "../../sdk/editor.ts";

import * as monaco from "monaco-editor/editor/editor.api.js";
import "monaco-editor/editor/contrib/suggest/browser/suggestController.js";

export type CompleteDocument = (
  path: string,
  text: string,
  position: CompletionPosition,
) => Promise<CompletionResult>;

const kind = monaco.languages.CompletionItemKind;
// LSP and Monaco use different numeric values, including different ordering.
const kinds = [
  kind.Text,
  kind.Text,
  kind.Method,
  kind.Function,
  kind.Constructor,
  kind.Field,
  kind.Variable,
  kind.Class,
  kind.Interface,
  kind.Module,
  kind.Property,
  kind.Unit,
  kind.Value,
  kind.Enum,
  kind.Keyword,
  kind.Snippet,
  kind.Color,
  kind.File,
  kind.Reference,
  kind.Folder,
  kind.EnumMember,
  kind.Constant,
  kind.Struct,
  kind.Event,
  kind.Operator,
  kind.TypeParameter,
];

function range(value: CompletionRange, model: monaco.editor.ITextModel) {
  if (!value?.start || !value?.end) return;
  const valid = (position: CompletionPosition) =>
    Number.isInteger(position.line) &&
    Number.isInteger(position.character) &&
    position.line >= 0 &&
    position.line < model.getLineCount() &&
    position.character >= 0 &&
    position.character < model.getLineMaxColumn(position.line + 1);
  if (!valid(value.start) || !valid(value.end)) return;
  if (
    value.start.line > value.end.line ||
    (value.start.line === value.end.line && value.start.character > value.end.character)
  )
    return;
  return new monaco.Range(
    value.start.line + 1,
    value.start.character + 1,
    value.end.line + 1,
    value.end.character + 1,
  );
}

export function registerEditorCompletion(
  pathFor: (model: monaco.editor.ITextModel) => string | undefined,
  complete: CompleteDocument,
) {
  let disposed = false;
  const registration = monaco.languages.registerCompletionItemProvider(
    ["typescript", "javascript"],
    {
      triggerCharacters: [".", '"', "'", "/"],
      async provideCompletionItems(model, position, _context, token) {
        const path = pathFor(model);
        if (!path || disposed || token.isCancellationRequested) return;
        const version = model.getVersionId();
        let result: CompletionResult;
        try {
          result = await complete(path, model.getValue(), {
            line: position.lineNumber - 1,
            character: position.column - 1,
          });
        } catch {
          // Completion is optional; transport/server status owns availability UI.
          return;
        }
        if (
          disposed ||
          token.isCancellationRequested ||
          model.isDisposed() ||
          model.getVersionId() !== version ||
          pathFor(model) !== path
        )
          return;
        const word = model.getWordUntilPosition(position);
        const fallback = new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn,
        );
        const suggestions: monaco.languages.CompletionItem[] = [];
        for (const item of result.items) {
          const edit = item.textEdit;
          const insert = edit ? range("range" in edit ? edit.range : edit.insert, model) : fallback;
          const replace = edit
            ? range("range" in edit ? edit.range : edit.replace, model)
            : fallback;
          if (
            !insert ||
            !replace ||
            !insert.isSingleLine() ||
            !replace.isSingleLine() ||
            !insert.containsPosition(position) ||
            !replace.containsPosition(position) ||
            !insert.getStartPosition().equals(replace.getStartPosition()) ||
            !replace.containsRange(insert)
          )
            continue;
          const edits = (item.additionalTextEdits ?? []).map((edit) => ({
            range: range(edit.range, model),
            text: edit.newText,
          }));
          if (edits.some((edit) => !edit.range)) continue;
          const additionalTextEdits = edits as monaco.editor.ISingleEditOperation[];
          const ranges = [replace, ...additionalTextEdits.map((edit) => edit.range)];
          if (
            ranges.some((current, index) =>
              ranges.slice(index + 1).some((other) => monaco.Range.areIntersecting(current, other)),
            )
          )
            continue;
          const documentation = item.documentation;
          suggestions.push({
            label: item.label,
            kind: kinds[item.kind ?? 1] ?? kind.Text,
            detail: item.detail,
            documentation:
              typeof documentation === "string"
                ? documentation
                : documentation?.kind === "markdown"
                  ? {
                      value: documentation.value,
                      isTrusted: false,
                      supportHtml: false,
                    }
                  : documentation?.value,
            insertText: item.textEdit?.newText ?? item.insertText ?? item.label,
            insertTextRules:
              item.insertTextFormat === 2
                ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                : undefined,
            sortText: item.sortText,
            filterText: item.filterText,
            range: { insert, replace },
            additionalTextEdits,
          });
        }
        return { suggestions, incomplete: result.isIncomplete };
      },
    },
  );
  return {
    dispose() {
      disposed = true;
      registration.dispose();
    },
  };
}
