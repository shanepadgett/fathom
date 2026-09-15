import { libName } from "@sigma/pty-ffi/noinit";

const name = libName();
const destination = new URL(`../native/${name}`, import.meta.url);
try {
  await Deno.stat(destination);
} catch (error) {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
  const response = await fetch(
    `https://github.com/sigmaSd/deno-pty-ffi/releases/download/0.42.0/${name}`,
  );
  if (!response.ok) {
    throw new Error(`Native terminal download failed: ${response.status}`);
  }
  await Deno.mkdir(new URL("../native/", import.meta.url), { recursive: true });
  await Deno.writeFile(
    destination,
    new Uint8Array(await response.arrayBuffer()),
  );
}
console.log(`Prepared native/${name}`);
