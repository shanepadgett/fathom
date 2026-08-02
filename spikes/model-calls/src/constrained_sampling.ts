import { asJsonObject } from "./json.ts";
import { ModelError } from "./types.ts";
import type { ModelToolCapabilities, ToolDefinition } from "./types.ts";

export interface GrammarTool {
  format: "lark" | "regex";
  definition: string;
  inputProperty: string;
}

export function resolveStrictSampling(
  tool: ToolDefinition,
  support: ModelToolCapabilities,
): boolean {
  const sampling = tool.constrainedSampling;
  if (!sampling || sampling.type !== "json-schema") return false;
  if (support.strictJsonSchema) return true;
  if (sampling.strict === "require") {
    throw new ModelError(
      "invalid-request",
      `Tool ${JSON.stringify(tool.name)} requires strict JSON-schema sampling`,
    );
  }
  return false;
}

export function resolveGrammarSampling(
  tool: ToolDefinition,
  support: ModelToolCapabilities,
): GrammarTool | undefined {
  const sampling = tool.constrainedSampling;
  if (!sampling || sampling.type !== "grammar" || !support.grammar) return undefined;
  const definition = sampling.lark?.trim() || sampling.regex?.trim();
  if (!definition) {
    throw new ModelError(
      "invalid-request",
      `Tool ${JSON.stringify(tool.name)} has no grammar definition`,
    );
  }
  return {
    format: sampling.lark?.trim() ? "lark" : "regex",
    definition,
    inputProperty: grammarInputProperty(tool),
  };
}

export function resolveGrammarTools(
  tools: ToolDefinition[] | undefined,
  support: ModelToolCapabilities,
): ReadonlyMap<string, GrammarTool> {
  const result = new Map<string, GrammarTool>();
  for (const tool of tools ?? []) {
    const grammar = resolveGrammarSampling(tool, support);
    if (grammar) result.set(tool.name, grammar);
  }
  return result;
}

function grammarInputProperty(tool: ToolDefinition): string {
  const schema = tool.inputSchema;
  const required = schema.required;
  if (
    schema.type !== "object" || !Array.isArray(required) || required.length !== 1 ||
    typeof required[0] !== "string"
  ) {
    throw new ModelError(
      "invalid-request",
      `Grammar tool ${JSON.stringify(tool.name)} requires one required string property`,
    );
  }
  const properties = asJsonObject(schema.properties);
  if (asJsonObject(properties[required[0]]).type !== "string") {
    throw new ModelError(
      "invalid-request",
      `Grammar tool ${JSON.stringify(tool.name)} requires one required string property`,
    );
  }
  return required[0];
}
