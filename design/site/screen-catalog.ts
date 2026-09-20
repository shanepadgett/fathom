import { settingsScreens } from "../screens/settings-screen.examples.ts";
import { agentScreens } from "../screens/agent-screen.examples.ts";
import { chatScreens } from "../screens/chat-screen.examples.ts";
import { editorScreens } from "../screens/editor-screen.examples.ts";

export const screens = [
  ...agentScreens,
  ...editorScreens,
  ...chatScreens,
  ...settingsScreens,
];
