import {
  Api,
  type ApiShape,
  type ApiToken,
  decode,
  defineRegistry,
  type Handlers,
} from "@fathom/sdk";
import type { Kernel } from "@fathom/kernel";

const MAX_REQUEST_TEXT_LENGTH = 150_000;

interface ApiRegistration {
  token: ApiToken;
  handlers: Record<
    string,
    (input: never, req: { signal: AbortSignal }) => unknown
  >;
}

function registration<S extends ApiShape>(
  token: ApiToken<S>,
  handlers: Handlers<S>,
): ApiRegistration {
  // Store mixed contracts together. Dispatch validates each input against the
  // matching operation before invoking its handler.
  return { token, handlers } as ApiRegistration;
}

const registrations = defineRegistry<ApiRegistration>("fathom.host.apis", {
  key: (entry) => entry.token.id,
});

const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });

export function createApiDispatch(
  kernel: Kernel,
  publish: (type: string, payload: unknown) => void,
) {
  const apis = kernel.provideRegistry(registrations);
  const advertised = () => apis.entries().map((e) => e.value.token.id);

  apis.watch(() => publish("contracts", advertised()));

  kernel.provide(Api, (scope) => ({
    serve(token, handlers) {
      const registry = kernel.registry(registrations, scope);

      const remove = registry.add(registration(token, handlers), {
        id: token.id,
      });

      let disposed = false;

      const dispose = () => {
        disposed = true;

        return remove();
      };

      scope.defer(() => {
        disposed = true;
      });

      return {
        dispose,

        emit(name, payload) {
          if (disposed || scope.signal.aborted) {
            return;
          }

          const event = token.operations[String(name)];

          if (!event || event.kind !== "event") {
            throw new Error("Unknown API event");
          }

          publish(`${token.id}.${String(name)}`, decode(event.schema, payload));
        },
      };
    },
  }));

  return {
    advertised,

    async dispatch(request: Request): Promise<Response | undefined> {
      const url = new URL(request.url);
      const match = /^\/api\/x\/([^/]+)\/([^/]+)$/.exec(url.pathname);

      if (!match) {
        return;
      }

      const apiId = decodeURIComponent(match[1]);
      const operationName = decodeURIComponent(match[2]);

      using lease = apis.lease(apiId);

      if (!lease) {
        return json({ error: "API stopping" }, 503);
      }

      const definition = lease.value.token.operations[operationName];

      if (!definition || definition.kind === "event") {
        return json({ error: "Unknown operation" }, 404);
      }

      if (request.method !== "POST") {
        return json({ error: "Use POST" }, 405);
      }

      const text = await request.text();

      if (text.length > MAX_REQUEST_TEXT_LENGTH) {
        return json({ error: "Request too large" }, 413);
      }

      const input = decode(definition.input, JSON.parse(text));
      const handler = lease.value.handlers[operationName];

      if (!handler) {
        return json({ error: "Handler unavailable" }, 503);
      }

      const result = await handler(input as never, {
        signal: AbortSignal.any([request.signal, lease.signal]),
      });

      return json(decode(definition.output, result));
    },
  };
}
