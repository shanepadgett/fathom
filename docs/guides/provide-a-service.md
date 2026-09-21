# Provide a service, or replace one

## Declare

`defineService<T>("id")` in a contract. `T` is the value consumers receive.

## Provide

List the token in `provides` and return the value from `start` under the same
key. To give each consumer its own view, return a factory:
`{ storage: (consumer) => namespaceFor(consumer.id) }`. The kernel calls it
once per consumer with that consumer's scope.

## Replace a bundled plugin

The bundled `storage` plugin provides `Storage` from `@fathom/sdk`. To replace
it:

1. Write a plugin whose `provides` includes `Storage` and whose `start` returns
   an implementation of `StorageNamespace`.
2. Register it with `deno task plugin:add` and enable it.
3. Disable `storage` in **Settings → Plugins**.

While both are enabled the kernel refuses the second provider and reports the
duplicate. Once the original is disabled, consumers restart against yours.

The same applies to any bundled plugin: `credentials`, `llm`, each provider,
the `workspace` shell, and the `plugin-manager`. Provide the same tokens or
contribute to the same slots, then disable the original.

## Registries

When many plugins contribute to one owner, use `defineRegistry<E>("id", { key })`.
The owner lists it in `provides` and receives it on the start context;
contributors list it in `requires` and call `add(value, { id, order })`.
`get(key)` looks up; `lease(key)` also pins the contributor until the lease is
released, so long-running work is not cut off by a reload.
