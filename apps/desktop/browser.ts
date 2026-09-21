import { boot, mintLaunchToken, openInBrowser } from "@fathom/server";

/** Development fallback under `deno run`: serve on a fixed port and open a tab. */
export async function openBrowserTab(options: {
  home: string;
  resources: string;
  port: number;
  open: boolean;
}): Promise<void> {
  // The development harness passes a token so it can call the API on our behalf.
  const launchToken = Deno.env.get("FATHOM_LAUNCH_TOKEN") ?? mintLaunchToken();

  const host = await boot({
    home: options.home,
    resources: options.resources,
    launchToken,
    shell: "browser",
    port: options.port,
  });

  const url = `${host.origin}/#token=${launchToken}`;

  console.log(
    `Fathom is running.\n${url}\nCredentials: ${options.home}/auth.json`,
  );

  let stopping = false;

  const shutdown = async () => {
    if (stopping) {
      return;
    }

    stopping = true;

    try {
      await host.close();
      Deno.exit(0);
    } catch (error) {
      console.error(String(error));
      Deno.exit(1);
    }
  };

  Deno.addSignalListener("SIGINT", shutdown);
  Deno.addSignalListener("SIGTERM", shutdown);

  if (options.open) {
    await openInBrowser(url);
  }
}
