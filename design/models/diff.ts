export interface DiffLine {
  kind: "context" | "added" | "removed";
  text: string;
}
