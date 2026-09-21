/** Write JSON through a temp file and rename so readers never see a partial file. */
export async function writeJsonAtomic(path: string, value: unknown) {
  const temp = `${path}.${crypto.randomUUID()}.tmp`;

  try {
    await Deno.writeTextFile(temp, JSON.stringify(value, null, 2), {
      mode: 0o600,
    });

    await Deno.rename(temp, path);
  } catch (error) {
    await Deno.remove(temp).catch((e) => {
      if (!(e instanceof Deno.errors.NotFound)) {
        throw new AggregateError(
          [error, e],
          "Write and temporary file cleanup failed",
        );
      }
    });

    throw error;
  }
}
