import type { AuthEvent, AuthPrompt } from "@earendil-works/pi-ai";

// Distribute over Pi's prompt variants while removing the server-only signal.
type PublicPrompt<T> = T extends unknown ? Omit<T, "signal"> & { id: string } : never;

export type LoginPrompt = PublicPrompt<AuthPrompt>;

export interface LoginFlow {
  id: string;
  providerId: string;
  status: "pending" | "complete" | "error" | "cancelled";
  events: AuthEvent[];
  prompt?: LoginPrompt;
  error?: string;
}
