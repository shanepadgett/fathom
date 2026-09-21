import type { Registry } from "@fathom/sdk";
import {
  Slot,
  type ApplicationContext,
  type Contribution,
} from "@fathom/sdk/ui";
import { EmptyState } from "@fathom/sdk/ui";

export function ApplicationRoot(props: {
  shells: Registry<Contribution<ApplicationContext>>;
}) {
  return (
    <Slot
      registry={props.shells}
      context={{}}
      mode="single"
      defaultId="workspace/shell"
      fallback={
        <EmptyState>
          No application shell is active. Use Plugin recovery to enable the
          workspace, or select another shell in your composition.
        </EmptyState>
      }
    />
  );
}
