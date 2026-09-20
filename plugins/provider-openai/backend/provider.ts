import { listModels, streamResponses } from "@fathom/llm/protocols";
import type { Credential } from "@fathom/credentials/contract";
import type { Provider } from "@fathom/llm/contract";

function endpoint(credential: Credential) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${credential.kind === "api-key" ? credential.key : credential.accessToken}`,
  };

  if (credential.kind === "oauth" && credential.accountId) {
    headers["ChatGPT-Account-Id"] = credential.accountId;
  }

  return {
    baseUrl:
      credential.kind === "oauth"
        ? "https://chatgpt.com/backend-api/codex"
        : "https://api.openai.com/v1",
    headers,
  };
}

export const provider: Provider = {
  id: "openai",
  label: "OpenAI",

  models(credential, signal) {
    const { baseUrl, headers } = endpoint(credential);

    // Codex gates catalog entries by upstream client compatibility version.
    const path =
      credential.kind === "oauth"
        ? "/models?client_version=0.155.1"
        : "/models";

    return listModels(`${baseUrl}${path}`, headers, "openai", signal);
  },

  stream(input, credential, signal) {
    return streamResponses(endpoint(credential), input, signal);
  },
};
