export function stringArg(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string") throw new Error(`${key} must be a string`);
  return value;
}
export function schema(fields: Record<string, string>) {
  return {
    type: "object",
    properties: Object.fromEntries(
      Object.entries(fields).map((
        [key, description],
      ) => [key, { type: "string", description }]),
    ),
    required: Object.keys(fields),
    additionalProperties: false,
  };
}
export function bounded(text: string, max = 32_000) {
  return text.length > max
    ? text.slice(0, max) + `\n[truncated: ${text.length - max} more characters]`
    : text;
}
