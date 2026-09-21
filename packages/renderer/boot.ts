import { openBrowserComposition } from "./composition.ts";
import { createApiAvailability } from "./api-availability.ts";
import { createControl } from "./control.ts";
import { Kernel } from "@fathom/kernel";
import { decode, KernelControl, T, UiArtifactSchema } from "@fathom/sdk";
import { Client, Slots } from "@fathom/sdk/ui";
import { BrowserClient } from "./client.ts";
import { mountRecovery } from "./mount-recovery.tsx";
import { BrowserLoader } from "./loader.ts";
import {
  AppShell,
  Pages,
  SettingsSections,
  HeaderActions,
  StatusItems,
  LeftSidebar,
  RightSidebar,
  Appearance,
} from "@fathom/sdk/ui";
import { createAppearance } from "./appearance.ts";
import { createRenderer } from "./renderer.tsx";
import { ApplicationRoot } from "./ApplicationRoot.tsx";
import { createComponent } from "solid-js";
import "./app.css";

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
  const renderer = createRenderer(root, slots);
  const appearance = createAppearance();
  kernel.provide(Appearance, appearance);
  const shells = kernel.provideRegistry(AppShell);
  kernel.provideRegistry(Pages);
  kernel.provideRegistry(SettingsSections);
  kernel.provideRegistry(HeaderActions);
  kernel.provideRegistry(StatusItems);
  kernel.provideRegistry(LeftSidebar);
  kernel.provideRegistry(RightSidebar);

  const recovery = mountRecovery(root, client, control);
  root.replaceChildren();

  const unmount = renderer.mount(() =>
    createComponent(ApplicationRoot, { shells }),
  );

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

  client.subscribe("ui-plugins", (payload) => {
    for (const artifact of decode(T.Array(UiArtifactSchema), payload)) {
      const loaded = loader.urls.get(artifact.id);

      if (loaded && loaded !== artifact.url) {
        kernel.submit({ id: artifact.id, host: "ui", action: "reload" });
      }
    }
  });

  void client.connect();

  return {
    kernel,
    client,
    async stop() {
      client.close();
      await kernel.shutdown();
      await unmount();
      appearance.dispose();
      recovery.dispose();
    },
  };
}
