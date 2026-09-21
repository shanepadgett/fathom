import { Api, definePlugin, type ApiPublication } from "@fathom/sdk";
import { Credentials } from "@fathom/credentials/contract";
import { Llm, LlmApi, Providers } from "@fathom/llm/contract";
import { createLlmService } from "./llm-service.ts";
import { createModelChecks } from "./model-checks.ts";

export default definePlugin({
  id: "llm",
  requires: { credentials: Credentials, api: Api },
  provides: { llm: Llm, providers: Providers },
  start({ providers, credentials, api, scope }) {
    const llm = createLlmService(providers, credentials, scope);

    const handlers = createModelChecks(llm, scope, (event) =>
      publication.emit("progress", event),
    );

    const publication: ApiPublication<typeof LlmApi.operations> = api.serve(
      LlmApi,
      handlers,
    );

    return { llm };
  },
});
