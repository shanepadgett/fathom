import {
  command,
  defineApi,
  defineRegistry,
  defineService,
  event,
  query,
  type Static,
  T,
} from "@fathom/sdk";
import type { Credential } from "@fathom/credentials/contract";

const MAX_CHECK_ID_LENGTH = 100;
const MAX_PROMPT_TEXT_LENGTH = 100_000;

const Empty = T.Object({}, { additionalProperties: false });

export const ModelSchema = T.Object({
  id: T.String(),
  name: T.String(),
  provider: T.String(),
});

export type ModelInfo = Static<typeof ModelSchema>;

/** Provider-owned endpoints and authentication. Honor the supplied signal. */
export interface Provider {
  id: string;
  label: string;
  models(credential: Credential, signal: AbortSignal): Promise<ModelInfo[]>;
  /** Yield text fragments, not accumulated text. Reject if completion fails. */
  stream(
    input: { model: string; prompt: string },
    credential: Credential,
    signal: AbortSignal,
  ): AsyncIterable<string>;
}

export const Providers = defineRegistry<Provider>("fathom.llm.providers", {
  key: (entry) => entry.id,
});

export const StreamEventSchema = T.Object({
  id: T.String(),
  type: T.Union([
    T.Literal("text"),
    T.Literal("done"),
    T.Literal("error"),
    T.Literal("cancelled"),
  ]),
  text: T.Optional(T.String()),
});

export type StreamEvent = Static<typeof StreamEventSchema>;

/**
 * Resolve credentials and hold the provider lease until the call or stream ends.
 * Calls can fail on missing credentials, provider shutdown, or timeout.
 * Finish or close stream iteration to release its lease.
 */
export const Llm = defineService<{
  models(provider: string, signal: AbortSignal): Promise<ModelInfo[]>;
  stream(
    opts: { provider: string; model: string; prompt: string },
    signal: AbortSignal,
  ): AsyncIterable<string>;
}>("fathom.llm");

/** In-memory workbench checks, not durable conversations. History is bounded. */
export const LlmApi = defineApi("fathom.llm.api", {
  models: query({
    input: T.Object({ provider: T.String() }),
    output: T.Array(ModelSchema),
  }),
  /** Return after starting; follow `progress` or query `state` for completion. */
  start: command({
    input: T.Object(
      {
        id: T.String({ minLength: 1, maxLength: MAX_CHECK_ID_LENGTH }),
        provider: T.String(),
        model: T.String({ minLength: 1 }),
        prompt: T.String({ minLength: 1, maxLength: MAX_PROMPT_TEXT_LENGTH }),
      },
      { additionalProperties: false },
    ),
    output: Empty,
  }),
  cancel: command({ input: T.Object({ id: T.String() }), output: Empty }),
  state: query({
    input: T.Object({ id: T.String() }),
    output: T.Object({ text: T.String(), state: T.String() }),
  }),
  /** Text events carry fragments; error events carry an explanation in `text`. */
  progress: event(StreamEventSchema),
});
