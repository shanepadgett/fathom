import { T } from "./schema.ts";
import type {
  TObject,
  TString,
  TArray,
  TBoolean,
  TUnknown,
} from "@sinclair/typebox";

export const UiArtifactSchema: TObject<{
  id: TString;
  url: TString;
  styles: TArray<TString>;
  externals: TArray<TString>;
  enabled: TBoolean;
  config: TUnknown;
}> = T.Object({
  id: T.String(),
  url: T.String(),
  styles: T.Array(T.String()),
  externals: T.Array(T.String()),
  enabled: T.Boolean(),
  config: T.Unknown(),
});

/** Keep these imports external so plugins share the host's runtime instances. */
export const UI_RUNTIME_IMPORTS = [
  "solid-js",
  "solid-js/web",
  "solid-js/store",
  "@fathom/sdk",
  "@fathom/sdk/ui",
];
