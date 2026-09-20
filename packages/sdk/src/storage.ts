import { defineService, type ServiceToken } from "./service.ts";

/** Persistent JSON values isolated by consuming plugin ID. Not a secret store. */
export interface StorageNamespace {
  /** Missing keys return undefined. */
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

export const Storage: ServiceToken<StorageNamespace> =
  defineService("fathom.storage");
