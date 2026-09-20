import { Api, definePlugin, type ApiPublication } from "@fathom/sdk";
import { Credentials } from "@fathom/credentials/contract";
import { Llm, LlmApi, Providers } from "@fathom/llm/contract";
import { createLlmService } from "./llm-service.ts";
import { createModelChecks } from "./model-checks.ts";

export default definePlugin({
  id: "llm",
  requires: { credentials: Credentials, api: Api },
  provides: { llm: Llm, providers: Providers },
  start({ use, scope }) {
    const llm = createLlmService(use.providers, use.credentials, scope);

    const handlers = createModelChecks(llm, scope, (event) =>
      publication.emit("progress", event),
    );

    const publication: ApiPublication<typeof LlmApi.operations> = use.api.serve(
      LlmApi,
      handlers,
    );

    return { llm };
  },
});
