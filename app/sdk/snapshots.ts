export interface SnapshotPrunePlan {
  trees: string[];
  retained: number;
  cutoff: number;
}

export interface SnapshotService {
  capture(): Promise<string>;
  /** Existing files added or modified since this snapshot; uses the isolated snapshot index. */
  changedSince(tree: string, signal?: AbortSignal): Promise<string[]>;
  restore(tree: string): Promise<void>;
  exists(tree: string): Promise<boolean>;
  planPrune(): Promise<SnapshotPrunePlan>;
  prune(trees: string[]): Promise<{ removed: number }>;
}
