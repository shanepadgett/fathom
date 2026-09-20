import { openBrowserComposition } from "./composition.ts";
import { createApiAvailability } from "./api-availability.ts";
import { createControl } from "./control.ts";
import { Kernel } from "@fathom/kernel";
import { decode, KernelControl, T } from "@fathom/sdk";
import { Client, createRenderer, Renderer, Slots } from "@fathom/sdk/ui";
import { BrowserClient } from "./client.ts";
import { mountRecovery } from "./mount-recovery.tsx";
import { BrowserLoader } from "./loader.ts";

export async function bootBrowser(
  root: HTMLElement,
  token: string,
): Promise<{
  kernel: Kernel;
  client: BrowserClient;
  stop(): Promise<void>;
}> {
  const client = new BrowserClient(token, (ids) => availability.reconcile(ids));

  const loader = new BrowserLoader(client, (definition) =>
    availability.register(definition),
  );

  const composition = await openBrowserComposition(client);
  const kernel = new Kernel("ui", loader, composition.save);
  const availability = createApiAvailability(kernel, client);
  const slots = composition.slots;

  const control = createControl(client, kernel, async () => {
    await availability.reconcile(
      decode(T.Array(T.String()), await client.request("/api/contracts")),
    );
  });

  kernel.provide(KernelControl, control);
  kernel.provide(Client, client);
  kernel.provide(Slots, () => slots);
  kernel.provide(Renderer, createRenderer(root, slots));

  const recovery = mountRecovery(root, client, kernel, control);
  root.replaceChildren();

  client.onReset(() => {
    void composition.refresh().catch((error) => {
      console.error("Could not refresh UI composition", error);
    });
  });

  for (const artifact of await loader.catalog()) {
    kernel.add({
      id: artifact.id,
      source: artifact.id,
      config: artifact.config,
      enabled: artifact.enabled,
    });
  }

  await kernel.start();
  void client.connect();

  return {
    kernel,
    client,
    async stop() {
      client.close();
      await kernel.shutdown();
      recovery.dispose();
    },
  };
}
