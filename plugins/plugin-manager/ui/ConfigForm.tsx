import { createMemo, createSignal, For, Show } from "solid-js";
import {
  Button,
  Checkbox,
  Field,
  InlineNotice,
  Input,
  Select,
  Textarea,
} from "@fathom/sdk/ui";

interface Property {
  type?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  anyOf?: { const?: unknown }[];
  minimum?: number;
  maximum?: number;
}

interface ObjectSchema {
  type?: string;
  properties?: Record<string, Property>;
  required?: string[];
}

type Kind = "string" | "number" | "boolean" | "enum";

/** Flat schemas render as fields; anything else falls back to JSON. */
function fieldKind(property: Property): Kind | undefined {
  const options = property.enum ?? property.anyOf?.map((item) => item.const);

  if (options && options.every((option) => typeof option === "string")) {
    return "enum";
  }

  if (property.type === "string") {
    return "string";
  }

  if (property.type === "number" || property.type === "integer") {
    return "number";
  }

  if (property.type === "boolean") {
    return "boolean";
  }

  return undefined;
}

function enumOptions(property: Property): string[] {
  return (property.enum ?? property.anyOf?.map((item) => item.const) ?? []).map(
    String,
  );
}

export function ConfigForm(props: {
  schema: unknown;
  value: unknown;
  busy: boolean;
  onSubmit(config: unknown): void;
}) {
  const schema = () => (props.schema ?? {}) as ObjectSchema;

  const initial = () =>
    (typeof props.value === "object" && props.value !== null
      ? props.value
      : {}) as Record<string, unknown>;

  const fields = createMemo(() => {
    const entries = Object.entries(schema().properties ?? {});

    if (entries.length === 0) {
      return undefined;
    }

    const kinds = entries.map(([name, property]) => ({
      name,
      property,
      kind: fieldKind(property),
      required: schema().required?.includes(name) ?? false,
    }));

    return kinds.every((field) => field.kind) ? kinds : undefined;
  });

  // The form edits a snapshot; the dialog remounts it for each plugin.
  // oxlint-disable-next-line solid/reactivity
  const [values, setValues] = createSignal<Record<string, unknown>>(initial());
  // oxlint-disable-next-line solid/reactivity
  const [json, setJson] = createSignal(JSON.stringify(props.value, null, 2));
  const [error, setError] = createSignal("");

  const set = (name: string, value: unknown) =>
    setValues((current) => ({ ...current, [name]: value }));

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    setError("");

    if (fields()) {
      const config: Record<string, unknown> = {};

      for (const field of fields()!) {
        const value = values()[field.name];

        if (value === undefined || value === "") {
          continue;
        }

        config[field.name] = field.kind === "number" ? Number(value) : value;
      }

      props.onSubmit(config);

      return;
    }

    try {
      props.onSubmit(JSON.parse(json()));
    } catch {
      setError("Configuration must be valid JSON");
    }
  };

  return (
    <form class="grid gap-4" onSubmit={submit}>
      <Show
        when={fields()}
        fallback={
          <Field id="plugin-config" label="Configuration (JSON)">
            <Textarea
              id="plugin-config"
              class="w-full font-mono"
              rows={10}
              value={json()}
              onInput={(event) => setJson(event.currentTarget.value)}
            />
          </Field>
        }
      >
        {(list) => (
          <For each={list()}>
            {(field) => {
              const id = `plugin-config-${field.name}`;

              const current = () =>
                values()[field.name] ?? field.property.default;

              return (
                <Field
                  id={id}
                  label={field.name}
                  description={field.property.description}
                >
                  <Show when={field.kind === "string"}>
                    <Input
                      id={id}
                      class="w-full"
                      required={field.required}
                      value={String(current() ?? "")}
                      onInput={(event) =>
                        set(field.name, event.currentTarget.value)
                      }
                    />
                  </Show>
                  <Show when={field.kind === "number"}>
                    <Input
                      id={id}
                      type="number"
                      class="w-full"
                      required={field.required}
                      min={field.property.minimum}
                      max={field.property.maximum}
                      value={current() === undefined ? "" : String(current())}
                      onInput={(event) =>
                        set(field.name, event.currentTarget.value)
                      }
                    />
                  </Show>
                  <Show when={field.kind === "boolean"}>
                    <Checkbox
                      id={id}
                      checked={Boolean(current())}
                      onChange={(event) =>
                        set(field.name, event.currentTarget.checked)
                      }
                    />
                  </Show>
                  <Show when={field.kind === "enum"}>
                    <Select
                      id={id}
                      class="w-full"
                      value={String(current() ?? "")}
                      onChange={(event) =>
                        set(field.name, event.currentTarget.value)
                      }
                    >
                      <Show when={!field.required}>
                        <option value="">(default)</option>
                      </Show>
                      <For each={enumOptions(field.property)}>
                        {(option) => <option value={option}>{option}</option>}
                      </For>
                    </Select>
                  </Show>
                </Field>
              );
            }}
          </For>
        )}
      </Show>
      <Show when={error()}>
        <InlineNotice error>{error()}</InlineNotice>
      </Show>
      <div>
        <Button type="submit" variant="primary" disabled={props.busy}>
          Apply configuration
        </Button>
      </div>
    </form>
  );
}
