/** Browser-safe model selection data returned by models.list. */
export interface ModelChoice {
  id: string;
  provider: string;
  name: string;
  contextWindow: number;
  thinkingLevels?: string[];
  reasoning?: boolean;
}
