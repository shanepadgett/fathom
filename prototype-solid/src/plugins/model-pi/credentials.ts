import type {
  AuthOperationOptions,
  Credential,
  CredentialStore,
} from "@earendil-works/pi-ai";
// @deno-types="@types/proper-lockfile"
import lockfile from "proper-lockfile";

/** Shares pi's lock protocol. Refresh writes preserve other provider entries. */
export class PiCredentialStore implements CredentialStore {
  constructor(private path: string) {}
  private async load(): Promise<Record<string, Credential>> {
    const data = JSON.parse(await Deno.readTextFile(this.path));
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Invalid pi auth file");
    }
    return data;
  }
  async read(id: string, options?: AuthOperationOptions) {
    options?.signal?.throwIfAborted();
    return (await this.load())[id];
  }
  async list(options?: AuthOperationOptions) {
    options?.signal?.throwIfAborted();
    return Object.entries(await this.load()).map((
      [providerId, credential],
    ) => ({ providerId, type: credential.type }));
  }
  private async locked<T>(
    operation: (data: Record<string, Credential>) => Promise<T>,
    options?: AuthOperationOptions,
  ) {
    options?.signal?.throwIfAborted();
    let compromised: Error | undefined;
    const release = await lockfile.lock(this.path, {
      realpath: false,
      stale: 30_000,
      retries: { retries: 8, minTimeout: 50, maxTimeout: 1000 },
      onCompromised: (error) => {
        compromised = error;
      },
    });
    try {
      options?.signal?.throwIfAborted();
      const data = await this.load();
      const before = JSON.stringify(data);
      const result = await operation(data);
      if (compromised) throw compromised;
      options?.signal?.throwIfAborted();
      if (before !== JSON.stringify(data)) {
        await Deno.writeTextFile(
          this.path,
          JSON.stringify(data, null, 2) + "\n",
          { mode: 0o600 },
        );
      }
      return result;
    } finally {
      await release();
    }
  }
  modify(
    id: string,
    fn: (value: Credential | undefined) => Promise<Credential | undefined>,
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
