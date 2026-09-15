export type ResourceKind =
  | "snapshots"
  | "artifacts"
  | "media"
  | "databases"
  | "other";

export interface ResourceUsage {
  kind: ResourceKind;
  bytes: number;
  files: number;
}

export interface ResourceReport {
  resources: ResourceUsage[];
  totalBytes: number;
  scannedAt: number;
  partial: boolean;
  skipped: number;
}

export interface ResourceService {
  scan(): Promise<ResourceReport>;
  open(kind: ResourceKind): Promise<void>;
}
