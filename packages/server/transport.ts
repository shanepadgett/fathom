/**
 * Loopback listener. Under `deno desktop` the runtime chooses the port and
 * ignores `port`; under `deno run` an omitted port lets the OS choose.
 */
export function listen(
  handle: (request: Request) => Promise<Response>,
  port?: number,
): { origin: string; close(): Promise<void> } {
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: port ?? 0, onListen() {} },
    handle,
  );

  const address = server.addr as Deno.NetAddr;

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => server.shutdown(),
  };
}
