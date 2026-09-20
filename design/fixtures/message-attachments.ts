import type { MessageAttachment } from "../models/conversation.ts";

export const fileAttachments: MessageAttachment[] = [
  { kind: "file", name: "session-store.ts", detail: "TypeScript · 8 KB" },
  { kind: "file", name: "rename-notes.md", detail: "Markdown · 4 KB" },
];

export const imageAttachments: MessageAttachment[] = [
  {
    kind: "image",
    name: "depth-dark.jpg",
    detail: "JPEG · Dark reference",
    src: new URL("../site/assets/home-depth.jpg", import.meta.url).href,
    alt: "Dark depth study for the Fathom visual theme",
  },
  {
    kind: "image",
    name: "depth-light.jpg",
    detail: "JPEG · Light reference",
    src: new URL("../site/assets/home-depth-light.jpg", import.meta.url).href,
    alt: "Light depth study for the Fathom visual theme",
  },
];
