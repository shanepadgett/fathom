export interface ContextSegment {
  label: string;
  value: number;
  kind: "system" | "tools" | "user" | "assistant" | "calls" | "results";
}

/** Context values are expressed in thousands of tokens. */
export interface ContextUsage {
  value: number;
  maximum: number;
  segments?: ContextSegment[];
}
