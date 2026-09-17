import type { EditorLanguageContribution } from "../../sdk/frontend.ts";

import * as monaco from "monaco-editor/editor/editor.api.js";

interface Registration {
  definition: EditorLanguageContribution;
  languageId: string;
}

const registrations = new Map<string, Map<string, Registration>>();
const registeredIds = new Set<string>();
const listeners = new Set<() => void>();

function changed() {
  for (const listener of listeners) listener();
}

export function registerLanguage(projectId: string, value: EditorLanguageContribution) {
  if (
    !value ||
    !/^[a-zA-Z][\w.-]*$/.test(value.id) ||
    !Array.isArray(value.extensions) ||
    !value.extensions.length ||
    value.extensions.some((extension) => !/^\.[a-z0-9][a-z0-9._-]*$/.test(extension)) ||
    !value.monarch?.tokenizer ||
    (value.priority !== undefined && !Number.isSafeInteger(value.priority))
  ) {
    throw new Error("Invalid editor language contribution");
  }
  const scope = registrations.get(projectId) ?? new Map<string, Registration>();
  const id = value.id;
  if (scope.has(id)) {
    throw new Error(`Editor language already registered: ${value.id}`);
  }
  const languageId = `fathom:${encodeURIComponent(projectId)}:${value.id}`;
  if (!registeredIds.has(languageId)) {
    monaco.languages.register({ id: languageId });
    registeredIds.add(languageId);
  }
  const tokens = monaco.languages.setMonarchTokensProvider(languageId, value.monarch);
  let configuration: monaco.IDisposable | undefined;
  try {
    if (value.configuration) {
      configuration = monaco.languages.setLanguageConfiguration(languageId, value.configuration);
    }
  } catch (error) {
    tokens.dispose();
    throw error;
  }
  const entry = {
    definition: { ...value, extensions: [...value.extensions] },
    languageId,
  };
  scope.set(id, entry);
  registrations.set(projectId, scope);
  changed();
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    if (scope.get(id) === entry) scope.delete(id);
    if (!scope.size) registrations.delete(projectId);
    changed();
    configuration?.dispose();
    tokens.dispose();
  };
}

export function bindEditorLanguage(
  model: monaco.editor.ITextModel,
  projectId: string,
  path: string,
  fallback: string,
) {
  const update = () => {
    if (model.isDisposed()) return;
    const candidates = [...(registrations.get(projectId)?.values() ?? [])]
      .filter(({ definition }) =>
        definition.extensions.some((extension) => path.toLowerCase().endsWith(extension)),
      )
      .sort(
        (a, b) =>
          (b.definition.priority ?? 0) - (a.definition.priority ?? 0) ||
          (a.definition.id < b.definition.id ? -1 : a.definition.id > b.definition.id ? 1 : 0),
      );
    const language = candidates[0]?.languageId ?? fallback;
    if (model.getLanguageId() !== language) {
      monaco.editor.setModelLanguage(model, language);
    }
  };
  listeners.add(update);
  const dispose = model.onWillDispose(() => {
    listeners.delete(update);
    dispose.dispose();
  });
  update();
}

export function editorLanguageName(id: string) {
  return id.startsWith("fathom:") ? id.slice(id.lastIndexOf(":") + 1) : id;
}
