import { eventLine, liveDependencies } from "../shared.ts";
import { runPlain } from "./runtime.ts";

const workspace = Deno.args[0] ?? Deno.cwd();
const prompt = Deno.args[1] ?? "Inspect README.md and summarize it in one sentence.";
const controller = new AbortController();
Deno.addSignalListener("SIGINT", () => controller.abort(new Error("Interrupted")));

for await (const event of runPlain(prompt, await liveDependencies(workspace), controller.signal)) {
  await Deno.stdout.write(new TextEncoder().encode(eventLine(event)));
}
