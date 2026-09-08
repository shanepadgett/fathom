import type { AssistantMessage, Message } from "@earendil-works/pi-ai";

import type { ModelMessage } from "../../contracts/model.ts";
export function toPiMessages(messages: ModelMessage[]): Message[] {
  return messages.map((message): Message => {
    const timestamp = Date.now();
    if (message.role === "user") {
      return { role: "user", content: message.text, timestamp };
    }
    if (message.role === "tool") {
      return {
        role: "toolResult",
        toolCallId: message.call.id,
        toolName: message.call.name,
        content: [{ type: "text", text: message.text }],
        isError: message.isError,
        timestamp,
      };
    }
    if (message.reply.continuation?.adapter !== "pi-ai") {
      throw new Error("This history belongs to another model adapter. Start a new session.");
    }
    return message.reply.continuation.value as AssistantMessage;
  });
}
