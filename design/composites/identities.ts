import { icon, text } from "../primitives/content.ts";
export const projectIdentity = (name: string) =>
  `<span class="flex min-w-0 items-center gap-1.5">${
    icon("folder")
  }<span class="truncate">${text(name)}</span></span>`;
export const branchIdentity = (branch: string) =>
  `<span class="flex min-w-0 items-center gap-1.5">${
    icon("git-branch")
  }<span class="truncate">${text(branch)}</span></span>`;
export const chatMetadata = (project: string, branch: string) =>
  `<span class="flex min-w-0 items-center gap-1.5">${
    projectIdentity(project)
  }<span>·</span>${branchIdentity(branch)}</span>`;
