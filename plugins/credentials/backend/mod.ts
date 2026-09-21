import {
  Api,
  AppEnvironment,
  definePlugin,
  type ApiPublication,
} from "@fathom/sdk";
import {
  Credentials,
  CredentialsApi,
  Logins,
} from "@fathom/credentials/contract";
import { openCredentialStore } from "./store.ts";
import { createCredentialAccess } from "./credential-access.ts";
import { createLoginSessions } from "./login-sessions.ts";
import { createCredentialHandlers } from "./api-handlers.ts";

export default definePlugin({
  id: "credentials",
  requires: { environment: AppEnvironment, api: Api },
  provides: { credentials: Credentials, logins: Logins },
  async start({ environment, logins, api, scope }) {
    const store = await openCredentialStore(environment.home);
    scope.defer(() => store.close());

    const changed = () => publication.emit("changed", {});
    const access = createCredentialAccess(store, logins, scope, changed);

    const sessions = createLoginSessions(
      logins,
      scope,
      access,
      (state) => publication.emit("loginChanged", state),
      changed,
    );

    const publication: ApiPublication<typeof CredentialsApi.operations> =
      api.serve(
        CredentialsApi,
        createCredentialHandlers(store, logins, access, sessions),
      );

    logins.watch(changed);

    return { credentials: { get: access.get } };
  },
});
