import { settingsScreens } from "../screens/settings-screen.examples.ts";
import { agentScreens } from "../screens/agent-screen.examples.ts";
import { chatScreens } from "../screens/chat-screen.examples.ts";
import { editorScreens } from "../screens/editor-screen.examples.ts";
import { workspaceScreens } from "../screens/workspace-screen.examples.ts";
import { workspaceSetupScreens } from "../screens/workspace-setup-screen.examples.ts";

export const screens = [
  ...workspaceScreens,
  ...workspaceSetupScreens,
  ...agentScreens,
  ...editorScreens,
  ...chatScreens,
  ...settingsScreens,
];
