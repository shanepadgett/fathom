# Publish a contract

Other plugins import your contract by package name, never by relative path,
because the backend loader copies each plugin directory before importing it.

## Inside this repository

Add the plugin directory to the root `deno.json` workspace. Its `name` and
`exports` make `@scope/<id>/contract` resolvable.

## Outside this repository

Publish the plugin to JSR, or add the contract path to the active import map:

```json
{ "imports": { "@you/thing/contract": "file:///absolute/path/to/thing/contract.ts" } }
```

## Fast check

JSR's default publish requires explicit types on exported values. Fathom's own
SDK carries those annotations. Plugins do not have to: this repository excludes
the `no-slow-types` rule for plugin packages, and `deno publish
--allow-slow-types` publishes a contract without them. Add annotations only when
you want JSR's fast type-check for your consumers.

## Versioning

A token's identity is its string id. Changing an id, or changing a schema in a
way that rejects previously valid payloads, is a breaking change for every
consumer. Add optional fields; do not rename.
