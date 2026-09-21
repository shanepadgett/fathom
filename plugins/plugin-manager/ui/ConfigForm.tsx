import { createMemo, createSignal, For, Show } from "solid-js";
import { T, type TSchema } from "@fathom/sdk";
import { Value } from "@sinclair/typebox/value";
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

interface FormField {
  name: string;
  property: Property;
  kind: Kind;
  required: boolean;
}

function enumOptions(property: Property): string[] {
  return (property.enum ?? property.anyOf?.map((item) => item.const) ?? []).map(
    String,
  );
}

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

// TypeBox's Value functions dispatch on Kind symbols that serialization drops,
// so the wire schema is rebuilt as a live schema from its flat fields.
function fieldSchema(field: FormField): TSchema {
  const property = field.property;

  switch (field.kind) {
    case "string":
      return T.String(property);
    case "number":
      return property.type === "integer"
        ? T.Integer(property)
        : T.Number(property);
    case "boolean":
      return T.Boolean(property);
    case "enum":
      return T.Union(
        enumOptions(property).map((option) => T.Literal(option)),
        property,
      );
  }
}

function formSchema(fields: FormField[]) {
  return T.Object(
    Object.fromEntries(
      fields.map((field) => [
        field.name,
        field.required ? fieldSchema(field) : T.Optional(fieldSchema(field)),
      ]),
    ),
  );
}

export function ConfigForm(props: {
  schema: unknown;
  value: unknown;
  busy: boolean;
  onSubmit(config: unknown): void;
}) {
  // The schema is JSON that crossed the wire; only its flat shape is inspected.
  const schema = () => (props.schema ?? {}) as ObjectSchema;

  const initial = () =>
    (typeof props.value === "object" && props.value !== null
      ? props.value
      : {}) as Record<string, unknown>;

  const fields = createMemo((): FormField[] | undefined => {
    const entries = Object.entries(schema().properties ?? {});

    if (entries.length === 0) {
      return undefined;
    }

    const known: FormField[] = [];

    for (const [name, property] of entries) {
      const kind = fieldKind(property);

      if (!kind) {
        return undefined;
      }

      known.push({
        name,
        property,
        kind,
        required: schema().required?.includes(name) ?? false,
      });
    }

    return known;
  });

  const live = createMemo(() => {
    const list = fields();

    return list && formSchema(list);
  });

  const defaulted = () => {
    const snapshot = { ...initial() };
    const schema = live();

    // Default fills the given object in place.
    if (schema) {
      Value.Default(schema, snapshot);
    }

    return snapshot;
  };

  // The form edits a snapshot; the dialog remounts it for each plugin.
  // oxlint-disable-next-line solid/reactivity
  const [values, setValues] = createSignal(defaulted());
  // oxlint-disable-next-line solid/reactivity
  const [json, setJson] = createSignal(JSON.stringify(props.value, null, 2));
  const [error, setError] = createSignal("");

  const [fieldErrors, setFieldErrors] = createSignal<Record<string, string>>(
    {},
  );

  const set = (name: string, value: unknown) =>
    setValues((current) => ({ ...current, [name]: value }));

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    setError("");
    setFieldErrors({});

    const list = fields();
    const schema = live();

    if (!list || !schema) {
      try {
        props.onSubmit(JSON.parse(json()));
      } catch {
        setError("Configuration must be valid JSON");
      }

      return;
    }

    const draft: Record<string, unknown> = {};

    for (const field of list) {
      const value = values()[field.name];

      if (value !== undefined && value !== "") {
        draft[field.name] = value;
      }
    }

    const config = Value.Convert(schema, draft);

    if (Value.Check(schema, config)) {
      props.onSubmit(config);

      return;
    }

    // Messages carry the path only; values may be secrets.
    const messages: Record<string, string> = {};

    for (const issue of Value.Errors(schema, config)) {
      messages[issue.path.slice(1)] ??= issue.message;
    }

    setFieldErrors(messages);
    setError(messages[""] ?? "");
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
              const current = () => values()[field.name];

              return (
                <Field
                  id={id}
                  label={field.name}
                  description={field.property.description}
                  error={fieldErrors()[field.name]}
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
