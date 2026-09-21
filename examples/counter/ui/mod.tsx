import { definePlugin } from "@fathom/sdk";
import { SettingsSections } from "@fathom/sdk/ui";
import { CounterApi } from "../contract.ts";
import { CounterSettings } from "./CounterSettings.tsx";

export default definePlugin({
  id: "counter",
  requires: { counter: CounterApi, settings: SettingsSections },
  start({ counter, settings }) {
    settings.add(
      {
        label: "Counter",
        icon: "plus",
        component: () => <CounterSettings api={counter} />,
      },
      { id: "counter", order: 50 },
    );
  },
});
