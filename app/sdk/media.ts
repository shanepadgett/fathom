/** Binary content lives outside SQLite; timeline entries retain this reference. */
export interface MediaAsset {
  id: string;
  sessionId: string;
  name: string;
  mime: string;
  bytes: number;
  createdAt: number;
}

export interface MediaService {
  /** Store binary content without publishing it; the caller persists the returned reference. */
  cache(
    sessionId: string,
    input: { name: string; mime: string; data: Uint8Array },
  ): Promise<MediaAsset>;
  stage(
    sessionId: string,
    input: { name: string; mime: string; data: Uint8Array },
  ): Promise<MediaAsset>;
  draft(sessionId: string): MediaAsset[];
  releaseDraft(sessionId: string, ids: string[]): void;
  readDraft(
    sessionId: string,
    id: string,
  ): Promise<{ asset: MediaAsset; data: Uint8Array }>;
  /** Persist up to 64 MiB and append a media entry to the session's active branch. */
  save(
    sessionId: string,
    input: { name: string; mime: string; data: Uint8Array },
  ): Promise<MediaAsset>;
  list(sessionId: string): MediaAsset[];
  /** Copy a branch-visible asset to a new workspace path; never overwrite. */
  materialize(
    sessionId: string,
    id: string,
    path: string,
  ): Promise<{ path: string }>;
  /** Reject assets that are not visible on the session's active branch. */
  read(
    sessionId: string,
    id: string,
  ): Promise<{ asset: MediaAsset; data: Uint8Array }>;
}
