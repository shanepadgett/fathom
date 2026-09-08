import { libName } from "@sigma/pty-ffi/noinit";
const name = libName();
const url = `https://github.com/sigmaSd/deno-pty-ffi/releases/download/0.42.0/${name}`;
const response = await fetch(url);
if (!response.ok) {
  throw new Error(`Native PTY download failed: ${response.status} ${url}`);
}
await Deno.mkdir("native", { recursive: true });
await Deno.writeFile(`native/${name}`, new Uint8Array(await response.arrayBuffer()));
console.log(`Prepared native/${name}`);
