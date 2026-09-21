import { command, defineApi, event, query, T } from "@fathom/sdk";

/** What the page may ask the backend; the schemas are checked on both sides. */
export const CounterApi = defineApi("counter", {
  read: query({ input: T.Object({}), output: T.Object({ count: T.Number() }) }),
  increment: command({ input: T.Object({}), output: T.Object({}) }),
  changed: event(T.Object({ count: T.Number() })),
});
