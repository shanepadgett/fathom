import type { ApiClient, ApiShape, ApiToken } from "../api.ts";
import type { Dispose } from "../scope.ts";
import { defineService, type ServiceToken } from "../service.ts";

export interface ClientApi {
  connection: () => string;
  api<S extends ApiShape>(token: ApiToken<S>): ApiClient<S>;
  /** Refetch state when event history cannot be replayed. Dispose to unsubscribe. */
  onReset(fn: () => void): Dispose;
}

export const Client: ServiceToken<ClientApi> = defineService("fathom.client");
