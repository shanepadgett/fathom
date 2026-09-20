/** The browser transport belongs to the host, independent of plugin composition. */
export function listen(
  port: number,
  handle: (request: Request) => Promise<Response>,
) {
  const server = Deno.serve(
    { hostname: "127.0.0.1", port, onListen() {} },
    handle,
  );

  return { close: () => server.shutdown() };
}
