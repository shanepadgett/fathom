import { instantiate, libName, Pty } from "@sigma/pty-ffi/noinit";
import { fileURLToPath } from "node:url";

export class TerminalService {
  private pty?: Pty;
  private timer?: ReturnType<typeof setInterval>;
  private decoder = new TextDecoder();
  output = "";
  exitCode?: number;
  async start(cwd: string, cols = 80, rows = 24) {
    this.stop();
    await instantiate(
      Deno.env.get("FATHOM_PTY_LIBRARY") ??
        (Deno.build.standalone
          ? fileURLToPath(new URL(`../../native/${libName()}`, import.meta.url))
          : undefined),
    );
    this.output = "";
    this.exitCode = undefined;
    this.decoder = new TextDecoder();
    this.pty = new Pty(Deno.env.get("SHELL") ?? "/bin/bash", {
      cwd,
      env: { ...Deno.env.toObject(), TERM: "xterm-256color" },
      size: { cols, rows, pixel_width: 0, pixel_height: 0 },
    });
    this.timer = setInterval(() => {
      try {
        const result = this.pty!.readBytes();
        this.output = (this.output +
          this.decoder.decode(result.data, { stream: !result.done })).slice(
            -128_000,
          );
        if (result.done) {
          this.exitCode = this.pty!.exitCode;
          this.stop();
        }
      } catch (error) {
        this.output += `\r\n${error}`;
        this.stop();
      }
    }, 16);
  }
  write(data: string) {
    if (!this.pty) throw new Error("Terminal is not running");
    this.pty.write(data);
  }
  resize(cols: number, rows: number) {
    if (![cols, rows].every((n) => Number.isInteger(n) && n > 0 && n <= 1000)) {
      throw new Error("Invalid terminal size");
    }
    this.pty?.resize({ cols, rows, pixel_width: 0, pixel_height: 0 });
  }
  snapshot() {
    return {
      output: this.output,
      running: !!this.pty,
      exitCode: this.exitCode,
    };
  }
  stop() {
    clearInterval(this.timer);
    this.pty?.close();
    this.pty = undefined;
  }
}
