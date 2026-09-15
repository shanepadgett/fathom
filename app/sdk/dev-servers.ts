export interface DevServer {
  id: string;
  terminalId: string;
  sessionId: string;
  url: string;
}

/** Full, revisioned project snapshot; filter by session before pairing. */
export interface DevServersSnapshot {
  revision: number;
  servers: DevServer[];
}

export interface DevServerService {
  snapshot(): DevServersSnapshot;
  subscribe(listener: (snapshot: DevServersSnapshot) => void): () => void;
}
