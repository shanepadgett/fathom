export interface ServiceToken<V> {
  kind: "service";
  id: string;
  readonly _type?: V;
}

/** Declare a dependency token. IDs, not object identity, select providers. */
export const defineService = <V>(id: string): ServiceToken<V> => ({
  kind: "service",
  id,
});
