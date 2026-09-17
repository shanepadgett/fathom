import { html } from "lit";

import { messageStructure } from "../../fixtures/message-structure.ts";
import "./chat-message.ts";
import { completedToolBatch, toolExecutionFrames } from "../../fixtures/tool-execution.ts";
import "../tools/tool-execution.ts";
import "../tools/tool-execution-demo.ts";

const noChanges = { count: 0, added: 0, removed: 0 };

export const turnGroupingExamples = [
  {
    name: "Messages and file activity",
    markup: html`
      <div class="flex flex-col gap-6">
        <chat-message .item=${messageStructure.user} .changes=${noChanges}></chat-message>
        <chat-message .item=${messageStructure.update} .changes=${noChanges}></chat-message>
        <tool-execution .batch=${completedToolBatch}></tool-execution>
        <chat-message .item=${messageStructure.answer} .changes=${noChanges}></chat-message>
      </div>
    `,
  },
  {
    name: "Agent working",
    markup: html`
      <div class="flex flex-col gap-6">
        <chat-message .item=${messageStructure.user} .changes=${noChanges}></chat-message>
        <chat-message
          .item=${{
            ...messageStructure.update,
            working: true,
          }}
          .changes=${noChanges}
        ></chat-message>
        <tool-execution .batch=${completedToolBatch}></tool-execution>
        <chat-message
          .item=${{
            ...messageStructure.update,
            blocks: [
              {
                kind: "prose",
                text: "Both views read the session record. I’ll update the title there, then run the rename checks.",
              },
            ],
          }}
          .changes=${noChanges}
        ></chat-message>
        <tool-execution-demo .frames=${toolExecutionFrames}></tool-execution-demo>
      </div>
    `,
  },
];

export const messageBoundaryExamples = [
  {
    name: "Consecutive user messages",
    markup: html`
      <div class="flex flex-col gap-6">
        <chat-message .item=${messageStructure.user} .changes=${noChanges}></chat-message>
        <chat-message .item=${messageStructure.followUp} .changes=${noChanges}></chat-message>
      </div>
    `,
  },
  {
    name: "Unread boundary",
    markup: html`
      <div class="flex flex-col gap-6">
        <chat-message .item=${messageStructure.user} .changes=${noChanges}></chat-message>
        <div
          class="flex items-center gap-3 text-sm text-action"
          role="separator"
          aria-label="New messages"
        >
          <span class="h-px flex-1 bg-action/30"></span>New messages<span
            class="h-px flex-1 bg-action/30"
          ></span>
        </div>
        <chat-message .item=${messageStructure.answer} .changes=${noChanges}></chat-message>
      </div>
    `,
  },
  {
    name: "Resumed history",
    markup: html`
      <div class="flex flex-col gap-6">
        <chat-message .item=${messageStructure.answer} .changes=${noChanges}></chat-message>
        <div class="flex items-center gap-3 text-sm text-muted" role="separator" aria-label="Today">
          <span class="h-px flex-1 bg-line"></span>Today<span class="h-px flex-1 bg-line"></span>
        </div>
        <p class="text-center text-sm text-muted">Conversation restored · earlier messages above</p>
        <chat-message .item=${messageStructure.followUp} .changes=${noChanges}></chat-message>
      </div>
    `,
  },
];
