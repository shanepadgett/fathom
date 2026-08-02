import {
  anthropicModel,
  Authorizer,
  Completion,
  Model,
  ModelError,
  ModelEvent,
  ModelRequest,
  ModelSession,
  ModelToolCapabilities,
  NativeRequestOptions,
  openAICodexModel,
  openAICodexWebSocketModel,
  ToolDefinition,
  xaiModel,
} from "./src/mod.ts";
import { piAnthropicModelOptions, piOpenAICodexAuthorizer, piXaiAuthorizer } from "./demo_auth.ts";

const RED_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAF0lEQVR4nGP4z8BAEiJN9aiGUQ1DSgMAkPn/Afnh+ngAAAAASUVORK5CYII=";
const xaiApiKey = Deno.env.get("XAI_API_KEY");
const xaiAuth: Authorizer = xaiApiKey
  ? {
    requestAuth: () =>
      Promise.resolve({
        headers: { Authorization: `Bearer ${xaiApiKey}` },
      }),
  }
  : piXaiAuthorizer();
const OPENAI_TOOLS = {
  strictJsonSchema: true,
  grammar: true,
  eagerInput: false,
} satisfies ModelToolCapabilities;
const ANTHROPIC_TOOLS = {
  strictJsonSchema: true,
  grammar: false,
  eagerInput: true,
} satisfies ModelToolCapabilities;
const XAI_TOOLS = {
  strictJsonSchema: true,
  grammar: false,
  eagerInput: false,
} satisfies ModelToolCapabilities;

const echoTool = {
  name: "echo",
  description: "Return the supplied text.",
  inputSchema: {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
    additionalProperties: false,
  },
};

const strictEchoTool: ToolDefinition = {
  ...echoTool,
  constrainedSampling: { type: "json-schema", strict: "require" },
};

const grammarTool: ToolDefinition = {
  name: "run_command",
  description: "Run one constrained print command.",
  inputSchema: {
    type: "object",
    properties: { command: { type: "string" } },
    required: ["command"],
    additionalProperties: false,
  },
  constrainedSampling: { type: "grammar", regex: "print [a-z]+" },
};

const inspectImageTool: ToolDefinition = {
  name: "inspect_image",
  description: "Return an image to inspect.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
};

interface Factory {
  label: string;
  create(): Model<NativeRequestOptions>;
}

const factories: Factory[] = [
  {
    label: "OpenAI Codex WebSocket",
    create: () =>
      openAICodexWebSocketModel({
        id: "gpt-5.6-sol",
        auth: piOpenAICodexAuthorizer(),
        toolCapabilities: OPENAI_TOOLS,
      }),
  },
  {
    label: "OpenAI Codex SSE",
    create: () =>
      openAICodexModel({
        id: "gpt-5.6-sol",
        auth: piOpenAICodexAuthorizer(),
        toolCapabilities: OPENAI_TOOLS,
      }),
  },
  {
    label: "Anthropic Messages SSE",
    create: () =>
      anthropicModel({
        id: "claude-sonnet-4-6",
        ...piAnthropicModelOptions(),
        toolCapabilities: ANTHROPIC_TOOLS,
      }),
  },
  {
    label: `xAI Responses SSE (${xaiApiKey ? "API key" : "Pi OAuth"})`,
    create: () =>
      xaiModel({
        id: "grok-4.5",
        auth: xaiAuth,
        toolCapabilities: XAI_TOOLS,
      }),
  },
];

async function collect<Options>(
  session: ModelSession<Options>,
  request: ModelRequest<Options>,
  printText = false,
): Promise<ModelEvent[]> {
  const events: ModelEvent[] = [];
  for await (const event of session.stream(request)) {
    events.push(event);
    if (printText && event.type === "text-delta") {
      await Deno.stdout.write(new TextEncoder().encode(event.text));
    }
  }
  return events;
}

function completion(events: ModelEvent[]): Completion {
  const terminal = events.findLast((event) => event.type === "completion");
  if (terminal?.type !== "completion") throw new Error("Request did not complete");
  return terminal.completion;
}

function text(result: Completion): string {
  return result.message.content
    .filter((block) => block.type === "text")
    .map((block) => block.type === "text" ? block.text : "")
    .join("");
}

async function invoke<Options>(
  model: Model<Options>,
  request: ModelRequest<Options>,
): Promise<Completion> {
  const session = model.createSession();
  try {
    return completion(await collect(session, request));
  } finally {
    session.close();
  }
}

function xaiOAuthToolDeclaration(model: Model<NativeRequestOptions>): {
  tools?: typeof echoTool[];
  toolChoice?: "none";
} {
  return !xaiApiKey && model.provider === "xai-responses"
    ? { tools: [echoTool], toolChoice: "none" }
    : {};
}

async function runRoundTrip(model: Model<NativeRequestOptions>): Promise<void> {
  const session = model.createSession();
  try {
    const cacheKey = crypto.randomUUID();
    const prompt = "Call echo with text hello.";
    const first = await collect(session, {
      system: "Follow the user's tool instruction exactly.",
      transcript: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      tools: [echoTool],
      toolChoice: "required",
      reasoning: "low",
      cache: { retention: "short", key: cacheKey },
    });
    const firstCompletion = completion(first);
    const callEvent = first.find((event) => event.type === "tool-call");
    if (callEvent?.type !== "tool-call") throw new Error("First turn emitted no client tool call");

    const input = callEvent.call.input;
    const value = typeof input === "object" && input !== null && "text" in input
      ? String(input.text)
      : "hello";
    const second = await collect(session, {
      system: "Follow the user's tool instruction exactly.",
      transcript: [
        { role: "user", content: [{ type: "text", text: prompt }] },
        firstCompletion.message,
        {
          role: "tool",
          callId: callEvent.call.id,
          name: callEvent.call.name,
          content: [{ type: "text", text: value }],
          isError: false,
        },
      ],
      tools: [echoTool],
      toolChoice: "none",
      reasoning: "low",
      cache: { retention: "short", key: cacheKey },
    }, true);
    const final = completion(second);
    if (!text(final)) throw new Error("Second turn completed without text");
    console.log(`\n  tool continuation: ${firstCompletion.stopReason} -> ${final.stopReason}`);
  } finally {
    session.close();
  }
}

async function runStructured(model: Model<NativeRequestOptions>): Promise<void> {
  const result = await invoke(model, {
    transcript: [{
      role: "user",
      content: [{ type: "text", text: "Return the word hello in the requested schema." }],
    }],
    responseFormat: {
      type: "json-schema",
      name: "greeting",
      schema: {
        type: "object",
        properties: { answer: { type: "string" } },
        required: ["answer"],
        additionalProperties: false,
      },
      strict: true,
    },
    ...xaiOAuthToolDeclaration(model),
  });
  const value = JSON.parse(text(result)) as unknown;
  if (typeof value !== "object" || value === null || !("answer" in value)) {
    throw new Error("Structured output did not match schema");
  }
  console.log(`  structured output: ${JSON.stringify(value)}`);
}

async function runImage(model: Model<NativeRequestOptions>): Promise<void> {
  const source = model.provider === "xai-responses"
    ? {
      type: "url" as const,
      url: "https://science.nasa.gov/wp-content/uploads/2023/09/web-first-images-release.png",
    }
    : { type: "base64" as const, mediaType: "image/png", data: RED_PNG };
  const result = await invoke(model, {
    transcript: [{
      role: "user",
      content: [
        { type: "text", text: "Name the dominant color in this image in one word." },
        {
          type: "image",
          source,
          detail: "low",
        },
      ],
    }],
    ...xaiOAuthToolDeclaration(model),
  });
  if (!text(result)) throw new Error("Image request completed without text");
  console.log(`  image input: ${text(result).trim()}`);
}

async function runFile(model: Model<NativeRequestOptions>): Promise<void> {
  const source = model.provider === "xai-responses"
    ? {
      type: "url" as const,
      url: "https://docs.x.ai/assets/api-examples/documents/product-specs.txt",
    }
    : {
      type: "text" as const,
      text: "Prototype notes\nProject codename: FATHOM\n",
      filename: "prototype.txt",
    };
  const result = await invoke(model, {
    transcript: [{
      role: "user",
      content: [
        {
          type: "text",
          text: model.provider === "xai-responses"
            ? "Return only the product name from the attached document."
            : "Return only the project codename from the attached document.",
        },
        {
          type: "file",
          source,
          providerData: {
            "anthropic-messages": {
              title: "Prototype notes",
              context: "A tiny text fixture.",
            },
          },
        },
      ],
    }],
    maxOutputTokens: 128,
    ...xaiOAuthToolDeclaration(model),
  });
  if (!text(result)) throw new Error("File request completed without text");
  console.log(`  file input: ${text(result).trim()}`);
}

async function runHostedTool(model: Model<NativeRequestOptions>): Promise<void> {
  const tools = model.provider === "anthropic-messages"
    ? [
      {
        label: "web search",
        definition: { type: "web_search_20250305", name: "web_search", max_uses: 1 },
        prompt: "Use web search once. In one sentence, state the title of https://example.com/.",
      },
      {
        label: "web fetch",
        definition: { type: "web_fetch_20250910", name: "web_fetch", max_uses: 1 },
        prompt: "Fetch https://example.com/ and return only its page title.",
      },
      {
        label: "code execution",
        definition: { type: "code_execution_20250825", name: "code_execution" },
        prompt: "Use code execution to calculate 17 * 23, then return only the number.",
      },
    ]
    : model.provider === "xai-responses"
    ? [
      {
        label: "web search",
        definition: { type: "web_search" },
        prompt: "Use web search once. In one sentence, state the title of https://example.com/.",
      },
      {
        label: "X search",
        definition: { type: "x_search" },
        prompt:
          "Use X search once to find one recent post by the xAI account. Summarize it briefly.",
      },
      {
        label: "code interpreter",
        definition: { type: "code_interpreter" },
        prompt: "Use code interpreter to calculate 17 * 23, then return only the number.",
      },
    ]
    : [{
      label: "web search",
      definition: { type: "web_search" },
      prompt: "Use web search once. In one sentence, state the title of https://example.com/.",
    }];

  for (const tool of tools) await runOneHostedTool(model, tool);
}

async function runOneHostedTool(
  model: Model<NativeRequestOptions>,
  tool: { label: string; definition: Record<string, unknown>; prompt: string },
): Promise<void> {
  const result = await invoke(model, {
    transcript: [{
      role: "user",
      content: [{ type: "text", text: tool.prompt }],
    }],
    nativeTools: [{ provider: model.provider, definition: tool.definition }],
    maxOutputTokens: 512,
  });
  const native = result.message.content.filter((block) => block.type === "provider-content");
  const annotations = result.message.content
    .filter((block) => block.type === "text")
    .flatMap((block) => block.type === "text" ? block.annotations ?? [] : []);
  if (!native.length) throw new Error(`${tool.label} produced no preserved native output item`);
  console.log(
    `  hosted ${tool.label}: ${native.length} native block(s), ${annotations.length} citation(s)`,
  );
}

async function runReasoning(model: Model<NativeRequestOptions>): Promise<void> {
  const session = model.createSession();
  try {
    const events = await collect(session, {
      transcript: [{
        role: "user",
        content: [{
          type: "text",
          text:
            "Find every integer n from 1 through 1000 for which n² + n + 41 is divisible by 41. Explain briefly.",
        }],
      }],
      reasoning: "high",
      ...xaiOAuthToolDeclaration(model),
    });
    const result = completion(events);
    const reasoning = result.message.content
      .filter((block) => block.type === "reasoning")
      .map((block) => block.type === "reasoning" ? block.text : "")
      .join("");
    if (!text(result)) throw new Error("Reasoning request completed without text");
    console.log(`  reasoning: ${reasoning.length} visible character(s), stop=${result.stopReason}`);
  } finally {
    session.close();
  }
}

async function runConstrainedTool(model: Model<NativeRequestOptions>): Promise<void> {
  const session = model.createSession();
  const tool = model.capabilities.grammar ? grammarTool : strictEchoTool;
  const interleaved = model.provider === "anthropic-messages";
  const expected = tool === grammarTool ? "print fathom" : interleaved ? "challenge" : "fathom";
  const prompt = tool === grammarTool
    ? "Call run_command with exactly: print fathom"
    : interleaved
    ? "Call echo with text challenge. It will return an integer; then factor that returned integer into primes and explain the verification."
    : "Call echo with text fathom.";
  try {
    const first = await collect(session, {
      system: "Call the requested tool exactly once.",
      transcript: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      tools: [grammarTool, strictEchoTool],
      toolChoice: { name: tool.name },
      reasoning: model.provider === "anthropic-messages" ? "high" : "low",
    });
    const callEvent = first.find((event) => event.type === "tool-call");
    if (callEvent?.type !== "tool-call") throw new Error("No constrained tool call emitted");
    const key = tool === grammarTool ? "command" : "text";
    const input = callEvent.call.input;
    const value = typeof input === "object" && input !== null && key in input
      ? String(input[key as keyof typeof input])
      : "";
    if (value !== expected) throw new Error(`Constrained value was ${JSON.stringify(value)}`);

    const usedCustomProtocol = first.some((event) =>
      event.type === "provider-event" && event.event.type === "response.custom_tool_call_input.done"
    );
    if (model.capabilities.grammar && !usedCustomProtocol) {
      throw new Error("Grammar tool did not use Responses custom-tool protocol");
    }

    const firstCompletion = completion(first);
    const second = await collect(session, {
      system: "Call the requested tool exactly once.",
      transcript: [
        { role: "user", content: [{ type: "text", text: prompt }] },
        firstCompletion.message,
        {
          role: "tool",
          callId: callEvent.call.id,
          name: callEvent.call.name,
          content: [{
            type: "text",
            text: interleaved ? "12345" : `${value}: ok`,
          }],
          isError: false,
        },
      ],
      tools: [grammarTool, strictEchoTool],
      toolChoice: "none",
      reasoning: model.provider === "anthropic-messages" ? "high" : "low",
    });
    const final = completion(second);
    if (!text(final)) throw new Error("Constrained tool result produced no final text");
    const reasoningBlocks = [...first, ...second].filter((event) =>
      event.type === "reasoning-delta"
    ).length;
    if (interleaved && !reasoningBlocks) {
      throw new Error("Anthropic emitted no reasoning around the tool loop");
    }
    console.log(
      `  constrained ${tool === grammarTool ? "grammar" : "strict JSON"}: ` +
        `${firstCompletion.stopReason} -> ${final.stopReason}, reasoning events=${reasoningBlocks}`,
    );
  } finally {
    session.close();
  }
}

async function runCache(model: Model<NativeRequestOptions>): Promise<void> {
  const stable = Array.from(
    { length: 1600 },
    (_, index) => `stable${index % 20}`,
  ).join(" ");
  const key = `fathom-${crypto.randomUUID()}`;
  const request = (word: string): ModelRequest<NativeRequestOptions> => ({
    system: `Treat this stable reference as authoritative:\n${stable}`,
    transcript: [{
      role: "user",
      content: [{ type: "text", text: `Reply with only ${word}.` }],
    }],
    maxOutputTokens: 32,
    cache: { retention: "short", key },
    ...xaiOAuthToolDeclaration(model),
  });
  const first = await invoke(model, request("alpha"));
  const second = await invoke(model, request("beta"));
  const wrote = first.usage?.cacheWrite ?? 0;
  const read = second.usage?.cacheRead ?? 0;
  if (!wrote && !read) throw new Error("Provider reported no prompt-cache activity");
  console.log(`  prompt cache: write=${wrote}, read=${read}`);
}

async function runHandoff(model: Model<NativeRequestOptions>): Promise<void> {
  const source: Model<NativeRequestOptions> = model.provider === "anthropic-messages"
    ? xaiModel({
      id: "grok-4.5",
      auth: xaiAuth,
      toolCapabilities: XAI_TOOLS,
    })
    : anthropicModel({
      id: "claude-sonnet-4-6",
      ...piAnthropicModelOptions(),
      toolCapabilities: ANTHROPIC_TOOLS,
    });
  const sourceSession = source.createSession();
  const targetSession = model.createSession();
  const prompt = "Call echo with text handoff.";
  try {
    const first = await collect(sourceSession, {
      transcript: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      tools: [echoTool],
      toolChoice: "required",
      reasoning: "high",
    });
    const firstCompletion = completion(first);
    const callEvent = first.find((event) => event.type === "tool-call");
    if (callEvent?.type !== "tool-call") throw new Error("Handoff source emitted no tool call");

    const second = await collect(targetSession, {
      transcript: [
        { role: "user", content: [{ type: "text", text: prompt }] },
        firstCompletion.message,
        {
          role: "tool",
          callId: callEvent.call.id,
          name: callEvent.call.name,
          content: [{ type: "text", text: "handoff" }],
          isError: false,
        },
      ],
      tools: [echoTool],
      toolChoice: "none",
    });
    const final = completion(second);
    if (!text(final)) throw new Error("Handoff target produced no final text");
    console.log(`  handoff: ${source.provider} -> ${model.provider}, stop=${final.stopReason}`);
  } finally {
    sourceSession.close();
    targetSession.close();
  }
}

async function runToolImage(model: Model<NativeRequestOptions>): Promise<void> {
  const session = model.createSession();
  const prompt = "Call inspect_image, then name the image's dominant color.";
  try {
    const first = await collect(session, {
      transcript: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      tools: [inspectImageTool],
      toolChoice: "required",
    });
    const firstCompletion = completion(first);
    const callEvent = first.find((event) => event.type === "tool-call");
    if (callEvent?.type !== "tool-call") throw new Error("Image flow emitted no tool call");
    const image = model.provider === "xai-responses"
      ? {
        type: "image" as const,
        source: {
          type: "url" as const,
          url: "https://science.nasa.gov/wp-content/uploads/2023/09/web-first-images-release.png",
        },
      }
      : {
        type: "image" as const,
        source: { type: "base64" as const, mediaType: "image/png", data: RED_PNG },
      };
    const second = await collect(session, {
      transcript: [
        { role: "user", content: [{ type: "text", text: prompt }] },
        firstCompletion.message,
        {
          role: "tool",
          callId: callEvent.call.id,
          name: callEvent.call.name,
          content: [{ type: "text", text: "Image returned." }, image],
          isError: false,
        },
      ],
      tools: [inspectImageTool],
      toolChoice: "none",
    });
    const final = completion(second);
    if (!text(final)) throw new Error("Image tool result produced no final text");
    console.log(`  image tool result: ${text(final).trim()}`);
  } finally {
    session.close();
  }
}

async function runAbort(model: Model<NativeRequestOptions>): Promise<void> {
  const controller = new AbortController();
  controller.abort();
  try {
    await invoke(model, {
      transcript: [{ role: "user", content: [{ type: "text", text: "Do not run." }] }],
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof ModelError && error.kind === "aborted") {
      console.log("  cancellation: aborted before output");
      return;
    }
    throw error;
  }
  throw new Error("Aborted request unexpectedly completed");
}

const scenarioNames = [
  "round-trip",
  "structured",
  "image",
  "file",
  "hosted-tool",
  "reasoning",
  "constrained-tool",
  "cache",
  "handoff",
  "tool-image",
  "abort",
] as const;
type Scenario = typeof scenarioNames[number];
const [scenarioArgument = "round-trip", providerArgument] = Deno.args;
const requested = new Set([scenarioArgument]);
const selected = requested.has("all")
  ? scenarioNames
  : scenarioNames.filter((name) => requested.has(name));
if (!selected.length) {
  console.error(`Choose ${scenarioNames.join(", ")}, or all.`);
  Deno.exit(2);
}

const runners: Record<Scenario, (model: Model<NativeRequestOptions>) => Promise<void>> = {
  "round-trip": runRoundTrip,
  structured: runStructured,
  image: runImage,
  file: runFile,
  "hosted-tool": runHostedTool,
  reasoning: runReasoning,
  "constrained-tool": runConstrainedTool,
  cache: runCache,
  handoff: runHandoff,
  "tool-image": runToolImage,
  abort: runAbort,
};

let failures = 0;
for (const scenario of selected) {
  console.log(`\n=== ${scenario} ===`);
  const selectedFactories = providerArgument
    ? factories.filter((factory) =>
      factory.label.toLowerCase().includes(providerArgument.toLowerCase())
    )
    : factories;
  if (!selectedFactories.length) {
    console.error(`No provider label contains ${JSON.stringify(providerArgument)}.`);
    Deno.exit(2);
  }
  for (const factory of selectedFactories) {
    console.log(`\n[${factory.label}]`);
    try {
      await runners[scenario](factory.create());
    } catch (error) {
      failures++;
      if (error instanceof ModelError) console.error(`  ${error.kind}: ${error.message}`);
      else console.error(`  ${error instanceof Error ? error.message : "unknown failure"}`);
    }
  }
}

if (failures) {
  console.error(`\n${failures} demo invocation(s) failed.`);
  Deno.exitCode = 1;
} else {
  console.log("\nAll selected demo invocations passed.");
}
