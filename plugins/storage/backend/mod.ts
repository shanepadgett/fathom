import { AppEnvironment, definePlugin, Storage } from "@fathom/sdk";
import { openSqliteStorage } from "./sqlite-storage.ts";

export default definePlugin({
  id: "storage",
  requires: { environment: AppEnvironment },
  provides: { storage: Storage },
  start({ use, scope }) {
    return { storage: openSqliteStorage(use.environment.home, scope) };
  },
});
