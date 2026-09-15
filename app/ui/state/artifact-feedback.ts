import type { ArtifactFeedback } from "../../sdk/artifact-feedback.ts";
import type { Transport } from "../transport.ts";

import { sessionDraft } from "./session-draft.ts";

/** Both the viewer and composer follow the persisted session feedback. */
export function artifactFeedback(
  transport: Transport,
  sessionId: () => string,
) {
  return sessionDraft<ArtifactFeedback>(
    transport,
    sessionId,
    "artifact.feedback.list",
  );
}
