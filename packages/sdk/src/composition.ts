import { T } from "./schema.ts";
import type {
  TObject,
  TBoolean,
  TUnknown,
  TInteger,
  TRecord,
  TString,
  TArray,
} from "@sinclair/typebox";

export const DesiredSchema: TObject<{ enabled: TBoolean; config: TUnknown }> =
  T.Object({
    enabled: T.Boolean(),
    config: T.Unknown(),
  });

export const CompositionSchema: TObject<{
  revision: TInteger;
  backend: TRecord<TString, typeof DesiredSchema>;
  ui: TRecord<TString, typeof DesiredSchema>;
  slots: TObject<{
    order: TRecord<TString, TArray<TString>>;
    hidden: TArray<TString>;
  }>;
}> = T.Object({
  revision: T.Integer({ minimum: 0 }),
  backend: T.Record(T.String(), DesiredSchema),
  ui: T.Record(T.String(), DesiredSchema),
  slots: T.Object({
    /** Registry IDs mapped to full contribution IDs, not plugin IDs. */
    order: T.Record(T.String(), T.Array(T.String())),
    /** Full contribution IDs to omit from rendering. */
    hidden: T.Array(T.String()),
  }),
});
