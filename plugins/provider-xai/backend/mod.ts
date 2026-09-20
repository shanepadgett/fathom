import { definePlugin } from "@fathom/sdk";
import { Logins } from "@fathom/credentials/contract";
import { Providers } from "@fathom/llm/contract";
import { provider } from "./provider.ts";
import { loginFlow } from "./login.ts";

export default definePlugin({
  id: "provider-xai",
  requires: { providers: Providers, logins: Logins },
  start({ use }) {
    use.providers.add(provider, { id: "provider" });
    use.logins.add(loginFlow, { id: "login" });
  },
});
