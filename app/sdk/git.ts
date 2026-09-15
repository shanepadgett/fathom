export interface CommitGroup {
  title: string;
  body: string;
  files: string[];
}

export interface FileDiff {
  path: string;
  original: string;
  modified: string;
  patch: string;
}

export interface CommitPlan {
  version: string;
  commits: CommitGroup[];
}

export interface GitState {
  available: boolean;
  branch: string;
  files: { path: string; code: string; previousPath?: string }[];
}
