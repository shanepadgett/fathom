import "./PluginManagerPanel.css";
import type { KernelControlApi } from "@fathom/sdk";
import { RuntimeControls } from "./RuntimeControls.tsx";

export function PluginManagerPanel(props: { control: KernelControlApi }) {
  return (
    <section class="plugin-section">
      <details>
        <summary>
          <h2>Plugin runtime</h2>
        </summary>
        <RuntimeControls control={props.control} />
      </details>
    </section>
  );
}
