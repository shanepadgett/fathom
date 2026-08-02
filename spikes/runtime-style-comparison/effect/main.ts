import { eventLine, liveDependencies } from "../shared.ts";
import { makeEffectRuntime } from "./runtime.ts";

const workspace = Deno.args[0] ?? Deno.cwd();
const prompt = Deno.args[1] ?? "Inspect README.md and summarize it in one sentence.";
const controller = new AbortController();
Deno.addSignalListener("SIGINT", () => controller.abort(new Error("Interrupted")));
const runtime = makeEffectRuntime(await liveDependencies(workspace));
const encoder = new TextEncoder();

try {
  await runtime.run(
    prompt,
    (event) => Deno.stdout.write(encoder.encode(eventLine(event))).then(() => undefined),
    controller.signal,
  );
} finally {
  await runtime.dispose();
}
