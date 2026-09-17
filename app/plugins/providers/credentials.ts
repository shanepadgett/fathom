import type { AuthOperationOptions, Credential, CredentialStore } from "@earendil-works/pi-ai";

import { dirname } from "node:path";

// @deno-types="@types/proper-lockfile"
import lockfile from "proper-lockfile";

import { atomicWrite, readJson } from "../../kernel/files.ts";

/** Pi-compatible locking also serializes rotating OAuth refreshes across processes. */
export class Credentials implements CredentialStore {
  constructor(readonly path: string) {}

  private async load() {
    const data = await readJson<Record<string, Credential>>(this.path, {});
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Invalid credential store");
    }
    return data;
  }

  async read(id: string, options?: AuthOperationOptions) {
    options?.signal?.throwIfAborted();
    return (await this.load())[id];
  }

  async list(options?: AuthOperationOptions) {
    options?.signal?.throwIfAborted();
    return Object.entries(await this.load()).map(([providerId, credential]) => ({
      providerId,
      type: credential.type,
    }));
  }

  private async locked<T>(
    operation: (data: Record<string, Credential>) => Promise<T>,
    options?: AuthOperationOptions,
  ): Promise<T> {
    options?.signal?.throwIfAborted();
    await Deno.mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    let compromised: Error | undefined;
    const release = await lockfile.lock(this.path, {
      realpath: false,
      stale: 30_000,
      retries: { retries: 10, minTimeout: 100, maxTimeout: 1000 },
      onCompromised: (error) => {
        compromised = error;
      },
    });
    try {
      const data = await this.load();
      const before = JSON.stringify(data);
      const result = await operation(data);
      options?.signal?.throwIfAborted();
      if (compromised) throw compromised;
      if (before !== JSON.stringify(data)) {
        await atomicWrite(this.path, JSON.stringify(data, null, 2) + "\n");
      }
      return result;
    } finally {
      await release();
    }
  }

  modify(
    id: string,
    fn: (current: Credential | undefined) => Promise<Credential | undefined>,
    options?: AuthOperationOptions,
  ) {
    return this.locked(async (data) => {
      const next = await fn(data[id]);
      if (next !== undefined) data[id] = next;
      return data[id];
    }, options);
  }

  delete(id: string, options?: AuthOperationOptions) {
    return this.locked((data) => {
      delete data[id];
      return Promise.resolve();
    }, options);
  }
}
