import type { Static, TSchema } from "./schema.ts";
import { defineService, type ServiceToken } from "./service.ts";
import type { Dispose } from "./scope.ts";

export interface Operation<
  I extends TSchema = TSchema,
  O extends TSchema = TSchema,
> {
  kind: "query" | "command";
  input: I;
  output: O;
}

export interface Event<S extends TSchema = TSchema> {
  kind: "event";
  schema: S;
  id?: string;
}

export const query = <I extends TSchema, O extends TSchema>(s: {
  input: I;
  output: O;
}): Operation<I, O> => ({ kind: "query", ...s });

export const command = <I extends TSchema, O extends TSchema>(s: {
  input: I;
  output: O;
}): Operation<I, O> => ({ kind: "command", ...s });

export const event = <S extends TSchema>(schema: S): Event<S> => ({
  kind: "event",
  schema,
});

export type ApiShape = Record<string, Operation | Event>;

/** Schema-checked calls and events. Dispose subscriptions when no longer needed. */
export type ApiClient<S extends ApiShape> = {
  [K in keyof S]: S[K] extends Operation<infer I, infer O>
    ? (input: Static<I>, signal?: AbortSignal) => Promise<Static<O>>
    : S[K] extends Event<infer E>
      ? { subscribe(fn: (value: Static<E>) => void): Dispose }
      : never;
};

export interface ApiToken<S extends ApiShape = ApiShape> extends ServiceToken<
  ApiClient<S>
> {
  operations: S;
}

/** Declare an API contract; this does not publish handlers. Event IDs use `id.name`. */
export function defineApi<S extends ApiShape>(
  id: string,
  shape: S,
): ApiToken<S> {
  // Keep each operation's schema type; Object.fromEntries loses the key mapping.
  const operations = Object.fromEntries(
    Object.entries(shape).map(([key, op]) => [
      key,
      op.kind === "event" ? { ...op, id: `${id}.${key}` } : op,
    ]),
  ) as S;

  return { ...defineService<ApiClient<S>>(id), operations };
}

export type Handlers<S extends ApiShape> = {
  [K in keyof S as S[K] extends Operation ? K : never]: S[K] extends Operation<
    infer I,
    infer O
  >
    ? (
        input: Static<I>,
        req: { signal: AbortSignal },
      ) => Static<O> | Promise<Static<O>>
    : never;
};

export interface ApiPublication<S extends ApiShape> {
  /** Validate and publish an event. Ignored after disposal or scope cancellation. */
  emit<K extends keyof S>(
    name: K,
    payload: S[K] extends Event<infer E> ? Static<E> : never,
  ): void;
  dispose: Dispose;
}

/** Publish handlers until disposal or plugin shutdown. Payloads must be JSON-safe. */
export const Api: ServiceToken<{
  serve<S extends ApiShape>(
    token: ApiToken<S>,
    handlers: Handlers<S>,
  ): ApiPublication<S>;
}> = defineService("fathom.api");
