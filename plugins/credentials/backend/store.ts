import { decode, T } from "@fathom/sdk";
import {
  type Credential,
  CredentialSchema,
} from "@fathom/credentials/contract";

/** One process owns this store. Writes are serialized; tokens never go through APIs. */
export async function openCredentialStore(home: string) {
  await Deno.mkdir(home, { recursive: true, mode: 0o700 });

  const lock = await Deno.open(`${home}/auth.lock`, {
    create: true,
    read: true,
    write: true,
    mode: 0o600,
  });

  try {
    if (!(await lock.tryLock(true))) {
      throw new Error("Credential store is locked");
    }
  } catch {
    lock.close();
    throw new Error("Another Fathom process owns this credential store");
  }

  const schema = T.Record(T.String(), CredentialSchema);
  let data: Record<string, Credential>;

  try {
    data = decode(
      schema,
      JSON.parse(await Deno.readTextFile(`${home}/auth.json`)),
    );

    await Deno.chmod(`${home}/auth.json`, 0o600);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      data = {};
    } else {
      lock.close();
      throw new Error(
        "Cannot read auth.json; the existing file was left intact",
      );
    }
  }

  let queue = Promise.resolve();

  const write = (provider: string, value: Credential | undefined) => {
    const work = queue.then(async () => {
      const next = { ...data };

      if (value) {
        next[provider] = decode(CredentialSchema, value);
      } else {
        delete next[provider];
      }

      const temp = await Deno.makeTempFile({ dir: home, prefix: ".auth-" });

      try {
        await Deno.chmod(temp, 0o600);

        const file = await Deno.open(temp, { write: true, truncate: true });

        try {
          const bytes = new TextEncoder().encode(
            JSON.stringify(next, null, 2) + "\n",
          );

          let offset = 0;

          while (offset < bytes.length) {
            offset += await file.write(bytes.subarray(offset));
          }

          await file.sync();
        } finally {
          file.close();
        }

        await Deno.rename(temp, `${home}/auth.json`);
        data = next;
      } finally {
        await Deno.remove(temp).catch((e) => {
          if (!(e instanceof Deno.errors.NotFound)) {
            throw e;
          }
        });
      }
    });

    // Keep later writes runnable; this caller still receives the original failure.
    queue = work.catch(() => {});

    return work;
  };

  return {
    get: (provider: string) =>
      data[provider] ? structuredClone(data[provider]) : undefined,
    write,

    async close() {
      await queue;
      lock.close();
    },
  };
}

export type CredentialStore = Awaited<ReturnType<typeof openCredentialStore>>;
