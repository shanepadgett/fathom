import { html } from "lit";

import { messageStructure } from "../../fixtures/message-structure.ts";
import { scenario } from "../../fixtures/workspace-scenario.ts";
import { button } from "../../primitives/button.ts";
import {
  fileAttachments,
  imageAttachments,
} from "../../fixtures/message-attachments.ts";
import "./chat-message.ts";
import "./message-header.ts";
import "./streaming-response.ts";

const noChanges = { count: 0, added: 0, removed: 0 };

export const chatMessageExamples = [
  {
    name: "Message",
    markup: html`
      <chat-message .item=${scenario.messages[1]} .changes=${scenario
        .changes}></chat-message>
    `,
  },
];

export const userMessageExamples = [
  {
    name: "Short prompt",
    markup:
      html`<chat-message .item=${messageStructure.user} .changes=${noChanges}></chat-message>`,
  },
  {
    name: "Long prompt · collapsed",
    markup:
      html`<chat-message .item=${messageStructure.longUser} .changes=${noChanges}></chat-message>`,
  },
  {
    name: "File attachments",
    markup: html`<chat-message .item=${{
      ...messageStructure.user,
      attachments: fileAttachments,
    }} .changes=${noChanges}></chat-message>`,
  },
  {
    name: "Image attachments",
    markup: html`<chat-message .item=${{
      ...messageStructure.user,
      attachments: imageAttachments,
      blocks: [{
        kind: "prose",
        text: "Use these as references for the light and dark themes.",
      }],
    }} .changes=${noChanges}></chat-message>`,
  },
  {
    name: "Images, files, and annotations",
    markup: html`<chat-message .item=${{
      ...messageStructure.user,
      attachments: [...imageAttachments, ...fileAttachments],
      annotationCount: 3,
      blocks: [{
        kind: "prose",
        text:
          "Use this visual reference and the attached notes to update the conversation.",
      }],
    }} .changes=${noChanges}></chat-message>`,
  },
  {
    name: "Attachment only",
    markup: html`<chat-message .item=${{
      ...messageStructure.user,
      attachments: [imageAttachments[1], fileAttachments[1]],
      blocks: [],
    }} .changes=${noChanges}></chat-message>`,
  },
];

export const agentMessageExamples = [
  {
    name: "Progress update",
    markup:
      html`<chat-message .item=${messageStructure.update} .changes=${noChanges}></chat-message>`,
  },
  {
    name: "Streaming response",
    markup: html`
      <article>
        <message-header .message=${{
          ...messageStructure.update,
          working: true,
        }}></message-header>
        <streaming-response
          text="The sidebar now reads the shared session title."></streaming-response>
      </article>
    `,
  },
  {
    name: "Final answer",
    markup:
      html`<chat-message .item=${messageStructure.answer} .changes=${noChanges}></chat-message>`,
  },
  {
    name: "Mixed content",
    markup: html`<chat-message .item=${
      scenario.messages[1]
    } .changes=${scenario.changes}></chat-message>`,
  },
];

export const messageRevisionExamples = [
  {
    name: "Edited prompt",
    markup: html`
      <div>
        <chat-message .item=${{
          ...messageStructure.followUp,
          edited: true,
        }} .changes=${noChanges}></chat-message>
        <div class="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted"
          role="group" aria-label="Prompt revisions">
            ${button({
              label: "Previous prompt revision",
              content: "←",
              variant: "quiet",
            })}<span>Revision 2 of 2</span>${button({
              label: "Next prompt revision",
              content: "→",
              variant: "quiet",
              disabled: true,
            })}
            <span>Current branch</span>
          </div>
      </div>
    `,
  },
  {
    name: "Alternate answer",
    markup: html`
      <div>
        <chat-message .item=${messageStructure
          .answer} .changes=${noChanges}></chat-message>
        <div class="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted"
          role="group" aria-label="Answer versions">
            ${button({
              label: "Previous answer",
              content: "←",
              variant: "quiet",
              disabled: true,
            })}<span>Answer 1 of 2</span>${button({
              label: "Next answer",
              content: "→",
              variant: "quiet",
            })}<span>Earlier version</span>
          </div>
      </div>
    `,
  },
  {
    name: "Editing a prompt",
    markup: html`
      <div class="rounded-lg border border-action p-4">
        <label for="revision-prompt"
          class="mb-3 block text-sm font-medium">Edit message</label>
        <textarea id="revision-prompt"
          class="min-h-24 w-full resize-y rounded-control border border-line bg-canvas p-3 text-ink"
          readonly>Also keep the full title visible in the conversation header.</textarea>
        <p
          class="mt-3 text-sm text-muted">Resending starts a new branch from this message.</p>
        <div class="mt-4 flex flex-wrap gap-2">${button({
          label: "Save and resend",
          variant: "primary",
        })}${button({ label: "Cancel", variant: "quiet" })}</div>
      </div>
    `,
  },
];

export const referencedMessageExamples = [
  {
    name: "Quoted message",
    markup: html`
      <article>
        <message-header .message=${messageStructure.followUp}></message-header>
        <blockquote class="mb-4 border-l-2 border-action pl-4">
          <p class="mb-1 text-sm text-muted">Replying to Fathom · 10:44</p>
          <p>The header and sidebar now read the title from the same session record.</p>
          <div class="mt-2">${button({
            label: "Jump to original message",
            variant: "quiet",
          })}</div>
        </blockquote>
        <p>Does that also cover conversations running in the background?</p>
      </article>
    `,
  },
  {
    name: "Source unavailable",
    markup: html`
      <article>
        <message-header .message=${messageStructure.followUp}></message-header>
        <blockquote class="mb-4 border-l-2 border-line pl-4 text-muted">
          <p>Original message is unavailable.</p>
          <p
            class="mt-1 text-sm">The saved excerpt is still available: “Both views share the session record.”</p>
        </blockquote>
        <p>Does that also cover conversations running in the background?</p>
      </article>
    `,
  },
];

export const messageDeliveryExamples = [
  {
    name: "Sending",
    markup: html`
      <div>
        <chat-message .item=${messageStructure
          .user} .changes=${noChanges}></chat-message>
        <p class="mt-3 text-sm"><span class="text-muted">Sending…</span></p>
      </div>
    `,
  },
  {
    name: "Queued follow-up",
    markup: html`
      <div>
        <chat-message .item=${messageStructure
          .followUp} .changes=${noChanges}></chat-message>
        <p
          class="mt-3 text-sm"><span class="text-muted">Queued · sends after the current run</span></p>
        <div class="mt-3 flex gap-2">${button({
          label: "Edit queued message",
          variant: "quiet",
        })}${button({ label: "Remove from queue", variant: "quiet" })}</div>
      </div>
    `,
  },
  {
    name: "Accepted",
    markup: html`
      <div>
        <chat-message .item=${messageStructure
          .user} .changes=${noChanges}></chat-message>
        <p class="mt-3 text-sm"><span class="text-muted">Received</span></p>
      </div>
    `,
  },
  {
    name: "Failed to send",
    markup: html`
      <div>
        <chat-message .item=${messageStructure
          .user} .changes=${noChanges}></chat-message>
        <p
          class="mt-3 text-sm"><span class="text-danger">Couldn’t send · connection lost</span></p>
        <div class="mt-3">${button({ label: "Retry sending" })}</div>
      </div>
    `,
  },
  {
    name: "Retrying",
    markup: html`
      <div>
        <chat-message .item=${messageStructure
          .user} .changes=${noChanges}></chat-message>
        <p
          class="mt-3 text-sm"><span class="text-muted">Retrying · message retained</span></p>
        <div class="mt-3">${button({
          label: "Retry sending",
          disabled: true,
        })}</div>
      </div>
    `,
  },
];
