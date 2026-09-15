import type { EntryAttachment } from "./session.ts";

export interface PreparedFeedback {
  count: number;
  text: string;
  attachments: EntryAttachment[];
}

/** Sources own drafts; the coordinator owns admission of the combined message. */
export interface FeedbackSource {
  id: string;
  prepare(sessionId: string): PreparedFeedback | Promise<PreparedFeedback>;
  reconcile(sessionId: string): unknown | Promise<unknown>;
}

export interface FeedbackService {
  register(source: FeedbackSource): () => void;
  isSubmitting(sessionId: string): boolean;
  send(sessionId: string, sources?: string[]): Promise<{ sent: number }>;
}
