import { html } from "lit";

import { fileAttachments, imageAttachments } from "../../fixtures/message-attachments.ts";
import "./message-attachments.ts";

export const messageAttachmentsExamples = [
  {
    name: "Files",
    markup: html`<message-attachments .attachments=${fileAttachments}></message-attachments>`,
  },
  {
    name: "Images and annotations",
    markup: html`
      <message-attachments
        .attachments=${[...imageAttachments, ...fileAttachments]}
        .annotationCount=${3}
      ></message-attachments>
    `,
  },
];
