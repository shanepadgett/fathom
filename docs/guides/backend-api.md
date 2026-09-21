# Expose a backend API

## Declare

`defineApi(id, shape)` in the plugin's contract. Shape members are `query`,
`command`, or `event`, each with TypeBox schemas. The id namespaces events as
`<id>.<name>`.

## Serve

Require `Api` and call `api.serve(Token, handlers)` in `start`. One handler per
query and command, `(input, { signal }) => output`. Inputs are validated before
the handler runs; outputs are validated before they leave. Throwing rejects the
call with the error message.

`serve` returns a publication. `publication.emit(name, payload)` validates and
broadcasts an event. Registration is released with the plugin; call
`publication.dispose()` only to withdraw the API early.

## Consume

List the same token in the UI plugin's `requires`. The start context carries an
`ApiClient` for it: `await client.read({})` for queries and commands,
`client.changed.subscribe(fn)` for events, which returns a disposer.

Availability follows the backend. When the serving plugin stops, the UI plugin
is blocked and its contributions disappear. When it starts again, the UI plugin
starts again. Nothing in the UI polls for this.

## Limits

Requests are JSON and capped at 150 KB. Events replay only a bounded recent
window after a reconnect; on a `reset`, refetch authoritative state through
`Client.onReset`.
