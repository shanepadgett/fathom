# Manifest

Fathom reads a `fathom` block beside the normal Deno package fields in a
plugin's `deno.json`.

| Field | Required | Meaning |
| --- | --- | --- |
| `fathom.id` | yes | Plugin id: letters, digits, `_`, `.`, `-`. Names storage, composition, and registry entries. |
| `fathom.backend` | one of | Relative path to the backend entry, run in the Deno process. |
| `fathom.ui` | one of | Relative path to the UI entry, bundled for the page. |
| `fathom.styles` | no | Extra stylesheet paths bundled with the UI entry. |
| `version` | yes | Ordinary package version. |
| `name`, `exports` | when imported | Make a contract importable as `@scope/<id>/contract`. |

The SDK version is the `@fathom/sdk` entry in the plugin's `imports`. There is
no separate compatibility field.

Bundled plugins under `plugins/` are discovered automatically and start
enabled. External directories are registered with `deno task plugin:add` and
start disabled.
