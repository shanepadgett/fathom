import type { Static, TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

export { type Static, type TSchema, Type as T } from "@sinclair/typebox";

/** Clone input, apply schema defaults, and validate. Throws without echoing values. */
export function decode<S extends TSchema>(
  schema: S,
  input: unknown,
): Static<S> {
  const value = Value.Default(schema, structuredClone(input));

  if (!Value.Check(schema, value)) {
    // Do not echo invalid values: this helper also validates credentials.
    throw new Error(
      [...Value.Errors(schema, value)]
        .map((e) => `${e.path || "/"}: ${e.message}`)
        .join("; "),
    );
  }

  return value;
}
