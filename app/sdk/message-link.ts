/** Stable, machine-local message identity, independent of the desktop HTTP port. */
export interface MessageTarget {
  projectId: string;
  sessionId: string;
  entryId: string;
}

export function messageLink(target: MessageTarget): string {
  return `fathom://message/${[target.projectId, target.sessionId, target.entryId]
    .map(encodeURIComponent)
    .join("/")}`;
}

export function parseMessageLink(value: string): MessageTarget {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Enter a Fathom message link.");
  }
  const ids = url.pathname.slice(1).split("/");
  if (
    url.protocol !== "fathom:" ||
    url.hostname !== "message" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    ids.length !== 3 ||
    ids.some((id) => !/^[a-zA-Z0-9_-]{1,128}$/.test(id))
  ) {
    throw new Error("Enter a valid Fathom message link.");
  }
  return { projectId: ids[0], sessionId: ids[1], entryId: ids[2] };
}
