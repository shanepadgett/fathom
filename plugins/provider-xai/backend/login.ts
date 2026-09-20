import type { LoginFlow } from "@fathom/credentials/contract";
import {
  type DeviceCodeConfig,
  loginDeviceCode,
  refreshDeviceCode,
} from "@fathom/credentials/oauth";

const oauth: DeviceCodeConfig = {
  clientId: "b1a00492-073a-47ea-816f-4c329264a828",
  scope: "openid profile email offline_access grok-cli:access api:access",
  deviceCodeUrl: "https://auth.x.ai/oauth2/device/code",
  tokenUrl: "https://auth.x.ai/oauth2/token",
  referrer: "fathom",
  refreshSkewMs: 5 * 60 * 1000,
};

export const loginFlow: LoginFlow = {
  provider: "xai",
  label: "xAI",
  methods: [
    { id: "device", label: "Sign in with SuperGrok or X Premium" },
    { id: "api-key", label: "Use API key" },
  ],

  async login(method, ui, signal) {
    if (method === "device") {
      return await loginDeviceCode(oauth, ui, signal);
    }

    if (method !== "api-key") {
      throw new Error("Unknown login method");
    }

    return {
      kind: "api-key",
      key: (await ui.prompt("xAI API key")).trim(),
    };
  },

  refresh: (credential, signal) => refreshDeviceCode(oauth, credential, signal),
};
