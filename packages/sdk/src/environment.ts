import { defineService, type ServiceToken } from "./service.ts";

export const AppEnvironment: ServiceToken<{
  home: string;
  resources: string;
  platform: string;
  port: number;
  launchToken: string;
}> = defineService("fathom.environment");
