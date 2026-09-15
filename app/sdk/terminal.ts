export interface TerminalInfo {
  id: string;
  sessionId: string;
  title: string;
  output: string;
  startedAt: number;
  exitCode?: number;
  running: boolean;
}

export interface TerminalService {
  list(): TerminalInfo[];
  start(sessionId: string, command?: string): Promise<TerminalInfo>;
  stop(id: string): void;
}
