import {
  command,
  defineApi,
  defineRegistry,
  defineService,
  event,
  query,
  type ApiToken,
  type Event,
  type Operation,
  type RegistryToken,
  type ServiceToken,
  type Static,
  T,
} from "@fathom/sdk";
import type { Credential } from "@fathom/credentials/contract";
import type {
  TObject,
  TString,
  TArray,
  TUnion,
  TLiteral,
  TOptional,
} from "@sinclair/typebox";

const MAX_CHECK_ID_LENGTH = 100;
const MAX_PROMPT_TEXT_LENGTH = 100_000;

const Empty: TObject<Record<never, never>> = T.Object(
  {},
  { additionalProperties: false },
);

export const ModelSchema: TObject<{
  id: TString;
  name: TString;
  provider: TString;
}> = T.Object({
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

export const Providers: RegistryToken<Provider> = defineRegistry(
  "fathom.llm.providers",
  {
    key: (entry) => entry.id,
  },
);

export const StreamEventSchema: TObject<{
  id: TString;
  type: TUnion<
    [
      TLiteral<"text">,
      TLiteral<"done">,
      TLiteral<"error">,
      TLiteral<"cancelled">,
    ]
  >;
  text: TOptional<TString>;
}> = T.Object({
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
export const Llm: ServiceToken<{
  models(provider: string, signal: AbortSignal): Promise<ModelInfo[]>;
  stream(
    opts: { provider: string; model: string; prompt: string },
    signal: AbortSignal,
  ): AsyncIterable<string>;
}> = defineService("fathom.llm");

/** In-memory workbench checks, not durable conversations. History is bounded. */
export const LlmApi: ApiToken<{
  models: Operation<TObject<{ provider: TString }>, TArray<typeof ModelSchema>>;
  start: Operation<
    TObject<{
      id: TString;
      provider: TString;
      model: TString;
      prompt: TString;
    }>,
    typeof Empty
  >;
  cancel: Operation<TObject<{ id: TString }>, typeof Empty>;
  state: Operation<
    TObject<{ id: TString }>,
    TObject<{ text: TString; state: TString }>
  >;
  progress: Event<typeof StreamEventSchema>;
}> = defineApi("fathom.llm.api", {
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
