import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

export function mountTerminal(container, command, report) {
  const term = new Terminal({
    fontSize: 12,
    cursorBlink: true,
    scrollback: 2000,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.open(container);
  let previous = "",
    running = false;
  const data = term.onData((data) => command("terminal-write", { data }).catch(report));
  const resize = () => {
    fit.fit();
    if (running) {
      command("terminal-resize", { cols: term.cols, rows: term.rows }).catch(report);
    }
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  return {
    update(state) {
      if (state.running && !running) {
        running = true;
        resize();
      }
      running = state.running;
      if (state.output.startsWith(previous)) {
        term.write(state.output.slice(previous.length));
      } else {
        term.reset();
        term.write(state.output);
      }
      previous = state.output;
    },
    dispose() {
      observer.disconnect();
      data.dispose();
      term.dispose();
    },
  };
}
