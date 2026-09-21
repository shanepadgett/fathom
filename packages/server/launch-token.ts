/** One secret per process; the page presents it as a bearer token. */
export function mintLaunchToken(): string {
  return crypto.randomUUID() + crypto.randomUUID();
}
