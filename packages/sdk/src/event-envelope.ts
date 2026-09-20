import { T, type Static } from "./schema.ts";
import type { TObject, TString, TInteger, TUnknown } from "@sinclair/typebox";

export const EventEnvelopeSchema: TObject<{
  epoch: TString;
  cursor: TInteger;
  type: TString;
  payload: TUnknown;
}> = T.Object({
  /** Identifies one host event history; cursors cannot cross epochs. */
  epoch: T.String(),
  /** Resume after this position. A reset means retained history is unavailable. */
  cursor: T.Integer({ minimum: 0 }),
  type: T.String(),
  payload: T.Unknown(),
});

export type EventEnvelope = Static<typeof EventEnvelopeSchema>;
