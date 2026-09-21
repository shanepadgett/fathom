import { definePlugin } from "@fathom/sdk";
import {
  AppShell,
  Appearance,
  Client,
  HeaderActions,
  LeftSidebar,
  Pages,
  RightSidebar,
  SettingsSections,
  Slots,
  StatusItems,
} from "@fathom/sdk/ui";
import { WorkspaceShell } from "./WorkspaceShell.tsx";
import { GeneralSettings } from "./GeneralSettings.tsx";

export default definePlugin({
  id: "workspace",
  requires: {
    shells: AppShell,
    appearance: Appearance,
    client: Client,
    pages: Pages,
    settings: SettingsSections,
    header: HeaderActions,
    left: LeftSidebar,
    right: RightSidebar,
    status: StatusItems,
    slots: Slots,
  },
  start({
    shells,
    client,
    pages,
    settings,
    header,
    left,
    right,
    status,
    slots,
    appearance,
  }) {
    shells.add(
      {
        component: () => (
          <WorkspaceShell
            client={client}
            pages={pages}
            settings={settings}
            header={header}
            left={left}
            right={right}
            status={status}
            slots={slots}
          />
        ),
      },
      { id: "shell" },
    );

    settings.add(
      {
        label: "General",
        icon: "sliders-horizontal",
        component: () => <GeneralSettings appearance={appearance} />,
      },
      { id: "general", order: 0 },
    );
  },
});
