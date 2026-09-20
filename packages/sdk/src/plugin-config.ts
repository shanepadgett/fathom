import { T } from "./schema.ts";
import type {
  TObject,
  TString,
  TLiteral,
  TOptional,
  TArray,
} from "@sinclair/typebox";

/** Fathom metadata inside deno.json; Deno owns the other package fields. */
export const PluginConfigSchema: TObject<{
  version: TString;
  fathom: TObject<{
    id: TString;
    sdk: TLiteral<"^0.1">;
    backend: TOptional<TString>;
    ui: TOptional<TString>;
    styles: TOptional<TArray<TString>>;
  }>;
}> = T.Object({
  version: T.String({ minLength: 1 }),
  fathom: T.Object(
    {
      id: T.String({ pattern: "^[a-zA-Z0-9][a-zA-Z0-9_.-]*$" }),
      sdk: T.Literal("^0.1"),
      backend: T.Optional(T.String()),
      ui: T.Optional(T.String()),
      styles: T.Optional(T.Array(T.String())),
    },
    { additionalProperties: false },
  ),
});
