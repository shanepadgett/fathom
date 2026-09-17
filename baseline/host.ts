import Logbook from "./extensions/logbook.ts";
import toolLogbook from "./extensions/tool-logbook.ts";
import http from "./http.ts";
import Agent from "./plugins/agent.ts";
import Fs from "./plugins/fs.ts";
import Model from "./plugins/model.ts";
import Sessions from "./plugins/sessions.ts";
import Subprocess from "./plugins/subprocess.ts";
import surfaceAgent from "./plugins/surface-agent.ts";
import surfaceChat from "./plugins/surface-chat.ts";
import surfaceEditor from "./plugins/surface-editor.ts";
import Surfaces from "./plugins/surfaces.ts";
import toolBash from "./plugins/tool-bash.ts";
import toolFs from "./plugins/tool-fs.ts";
import toolScript from "./plugins/tool-script.ts";
import Tools from "./plugins/tools.ts";
import Workspace from "./plugins/workspace.ts";
import { compose } from "./sdk.ts";

export interface HostConfig {
  workspace: string;
  home: string;
  authPath: string;
  port: number;
  publicDir: string;
}

/** Compose the Cordis tree. Leave a row out to turn that piece off. */
export function start(config: HostConfig) {
  return compose()
    .use(Workspace, { root: config.workspace, home: config.home })
    .use(Sessions)
    .use(Model, { authPath: config.authPath })
    .use(Tools)
    .use(Fs)
    .use(Subprocess)
    .use(toolFs)
    .use(toolBash)
    .use(toolScript)
    .use(Logbook)
    .use(toolLogbook)
    .use(Agent)
    .use(Surfaces)
    .use(surfaceEditor)
    .use(surfaceAgent)
    .use(surfaceChat)
    .use(http, { port: config.port, publicDir: config.publicDir })
    .start();
}
