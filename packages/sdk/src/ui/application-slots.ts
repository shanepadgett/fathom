import type { IconName } from "./controls/Icon.tsx";
import { defineRegistry, type RegistryToken } from "../registry.ts";
import { defineSlot, type Contribution } from "./slot-contract.ts";

export type ApplicationContext = Record<string, never>;

export interface NamedContribution extends Contribution<ApplicationContext> {
  label: string;
  icon?: IconName;
}

/** Host-owned contracts survive replacement of the shell. IDs are plugin/local. */
export const AppShell: RegistryToken<Contribution<ApplicationContext>> =
  defineSlot("fathom.ui.shell");

export const Pages: RegistryToken<NamedContribution> =
  defineRegistry("fathom.ui.pages");

export const SettingsSections: RegistryToken<NamedContribution> =
  defineRegistry("fathom.ui.settings");

export const HeaderActions: RegistryToken<Contribution<ApplicationContext>> =
  defineSlot("fathom.ui.header");

export const StatusItems: RegistryToken<Contribution<ApplicationContext>> =
  defineSlot("fathom.ui.status");

export const LeftSidebar: RegistryToken<Contribution<ApplicationContext>> =
  defineSlot("fathom.ui.left");

export const RightSidebar: RegistryToken<Contribution<ApplicationContext>> =
  defineSlot("fathom.ui.right");
