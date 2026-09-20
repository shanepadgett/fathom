import type { RegistryToken } from "@fathom/sdk";
import { defineSlot, type Contribution } from "@fathom/sdk/ui";

export const WorkspacePanels: RegistryToken<
  Contribution<Record<string, never>>
> = defineSlot<Record<string, never>>("fathom.workspace.panels");
