import type { BrowserAnnotation } from "../../sdk/browser.ts";
import type { Transport } from "../transport.ts";

import { sessionDraft } from "./session-draft.ts";

export function browserFeedback(transport: Transport, sessionId: () => string) {
  return sessionDraft<BrowserAnnotation>(
    transport,
    sessionId,
    "annotations.list",
  );
}
