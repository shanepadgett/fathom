import { T } from "./schema.ts";
import type { TObject, TString, TOptional, TArray } from "@sinclair/typebox";

/** Fathom metadata inside deno.json; Deno owns the other package fields. */
export const PluginConfigSchema: TObject<{
  version: TString;
  fathom: TObject<{
    id: TString;
    backend: TOptional<TString>;
    ui: TOptional<TString>;
    styles: TOptional<TArray<TString>>;
  }>;
}> = T.Object({
  version: T.String({ minLength: 1 }),
  fathom: T.Object(
    {
      id: T.String({ pattern: "^[a-zA-Z0-9][a-zA-Z0-9_.-]*$" }),
      backend: T.Optional(T.String()),
      ui: T.Optional(T.String()),
      styles: T.Optional(T.Array(T.String())),
    },
    { additionalProperties: false },
  ),
});
