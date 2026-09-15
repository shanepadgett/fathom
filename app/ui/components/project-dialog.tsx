import { SearchDialog } from "./search-dialog.tsx";
import type { Project } from "../../sdk/session.ts";

import { createSignal, Show } from "solid-js";

import { Icon } from "./icon.tsx";
import { Button, Field } from "./primitives.tsx";
import { SearchList } from "./search-list.tsx";

export function ProjectDialog(props: {
  projects: Project[];
  open(path: string): Promise<void>;
  close(): void;
}) {
  const [path, setPath] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  let pathInput!: HTMLInputElement;
  async function open(path: string) {
    if (busy() || !path.trim()) return;
    setBusy(true);
    setError("");
    try {
      await props.open(path.trim());
      props.close();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
      if (error() && pathInput.isConnected) pathInput.focus();
    }
  }
  return (
    <SearchDialog
      label="Open a project"
      close={() => {
        if (!busy()) props.close();
      }}
    >
      <SearchList
        items={props.projects}
        label="Search projects"
        placeholder="Search projects…"
        empty="No matching projects. Open a folder below."
        disabled={busy()}
        searchText={(project) => `${project.name} ${project.path}`}
        select={(project) => open(project.path)}
      >
        {(project) => (
          <>
            <span class="mt-0.5 text-muted">
              <Icon name="folder" />
            </span>
            <span class="min-w-0 flex-1">
              <p class="truncate" title={project.name}>{project.name}</p>
              <p
                class="mt-0.5 truncate text-micro text-muted"
                title={project.path}
              >
                {project.path}
              </p>
            </span>
          </>
        )}
      </SearchList>
      <form
        class="border-t border-line p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void open(path());
        }}
      >
        <Field label="Local folder path">
          <input
            ref={pathInput}
            value={path()}
            readOnly={busy()}
            onInput={(event) => setPath(event.currentTarget.value)}
            placeholder="/Users/you/projects/my-app"
          />
        </Field>
        <Show when={error()}>
          <p role="alert" class="my-3 text-sm text-danger">{error()}</p>
        </Show>
        <Button
          class="mt-3"
          variant="primary"
          type="submit"
          disabled={busy() || !path().trim()}
        >
          {busy() ? "Opening…" : "Open folder"}
        </Button>
      </form>
    </SearchDialog>
  );
}
