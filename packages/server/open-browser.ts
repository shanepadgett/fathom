/** Open a URL with the desktop's default browser; failure is not an error because the printed link also works. */
export async function openInBrowser(url: string): Promise<void> {
  let command = ["xdg-open", url];

  if (Deno.build.os === "darwin") {
    command = ["open", url];
  } else if (Deno.build.os === "windows") {
    command = ["cmd", "/c", "start", "", url];
  }

  try {
    await new Deno.Command(command[0], {
      args: command.slice(1),
      stdout: "null",
      stderr: "null",
    }).output();
  } catch {
    // No desktop opener available.
  }
}
