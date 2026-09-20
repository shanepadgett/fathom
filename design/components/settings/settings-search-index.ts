export interface SettingSearchResult {
  label: string;
  group: string;
  section: "general" | "providers";
  provider?: string;
}

export const settingSearchResults: SettingSearchResult[] = [
  {
    label: "Device flow",
    group: "Providers / Device code, API key",
    section: "providers",
    provider: "device-demo",
  },
  ...["Theme", "Interface density", "Reduce motion"].map((label) => ({
    label,
    group: "General / Appearance",
    section: "general" as const,
  })),
  ...["Display name", "Default view", "Restore last session"].map((label) => ({
    label,
    group: "General / Workspace",
    section: "general" as const,
  })),
  ...["Desktop notifications", "Notification sounds"].map((label) => ({
    label,
    group: "General / Notifications",
    section: "general" as const,
  })),
  {
    label: "OpenAI",
    group: "Providers / ChatGPT sign-in, API key",
    section: "providers",
    provider: "openai",
  },
  {
    label: "Anthropic",
    group: "Providers / Claude sign-in, API key",
    section: "providers",
    provider: "anthropic",
  },
  {
    label: "xAI",
    group: "Providers / API key",
    section: "providers",
    provider: "xai",
  },
];
