import { listModels, streamMessages } from "@fathom/llm/protocols";
import type { Credential } from "@fathom/credentials/contract";
import type { Provider } from "@fathom/llm/contract";

function endpoint(credential: Credential) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "anthropic-version": "2023-06-01",
  };

  if (credential.kind === "api-key") {
    headers["x-api-key"] = credential.key;
  } else {
    headers.authorization = `Bearer ${credential.accessToken}`;
    headers["anthropic-beta"] = "oauth-2025-04-20";
  }

  return { baseUrl: "https://api.anthropic.com/v1", headers };
}

export const provider: Provider = {
  id: "anthropic",
  label: "Anthropic",

  models(credential, signal) {
    const { baseUrl, headers } = endpoint(credential);
    const path = "/models";

    return listModels(`${baseUrl}${path}`, headers, "anthropic", signal);
  },

  stream(input, credential, signal) {
    return streamMessages(endpoint(credential), input, signal);
  },
};
