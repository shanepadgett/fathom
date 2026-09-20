import { listModels, streamResponses } from "@fathom/llm/protocols";
import type { Credential } from "@fathom/credentials/contract";
import type { Provider } from "@fathom/llm/contract";

function endpoint(credential: Credential) {
  return {
    baseUrl: "https://api.x.ai/v1",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${credential.kind === "api-key" ? credential.key : credential.accessToken}`,
    },
  };
}

export const provider: Provider = {
  id: "xai",
  label: "xAI",

  models(credential, signal) {
    const { baseUrl, headers } = endpoint(credential);
    const path = "/language-models";

    return listModels(`${baseUrl}${path}`, headers, "xai", signal);
  },

  stream(input, credential, signal) {
    return streamResponses(endpoint(credential), input, signal);
  },
};
