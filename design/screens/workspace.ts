import { scenario } from "../fixtures/workspace-scenario.ts";
import { codeLines, diffLines } from "../fixtures/code.ts";
import { agentWorkspace, editorWorkspace } from "../layouts/workspaces.ts";

export const agentFocusExamples = [{
  name: "Agent workspace",
  markup: agentWorkspace(scenario, "base", diffLines),
}];
export const agentNoSessionExamples = [{
  name: "Agent workspace",
  markup: agentWorkspace(scenario, "no-session", diffLines),
}];
export const agentDrawerExamples = [{
  name: "Agent workspace",
  markup: agentWorkspace(scenario, "diff", diffLines),
}];
export const agentProjectPickerExamples = [{
  name: "Agent workspace",
  markup: agentWorkspace(scenario, "projects", diffLines),
}];
export const agentChatSearchExamples = [{
  name: "Agent workspace",
  markup: agentWorkspace(scenario, "chat-search", diffLines),
}];
export const editorFocusExamples = [{
  name: "Editor workspace",
  markup: editorWorkspace(scenario, "files", codeLines),
}];
export const editorDrawerExamples = [{
  name: "Editor workspace",
  markup: editorWorkspace(scenario, "agent", codeLines),
}];
export const editorChangesExamples = [{
  name: "Editor workspace",
  markup: editorWorkspace(scenario, "changes", codeLines),
}];
