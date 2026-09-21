import {
  bootBrowser,
  readLaunchToken,
  watchLaunchLink,
} from "@fathom/renderer";

watchLaunchLink();

const root = document.getElementById("app");

if (!root) {
  throw new Error("Missing application root #app");
}

const token = await readLaunchToken();

if (!token) {
  root.textContent =
    "Open the launch link printed by deno task dev:browser to connect to Fathom.";
} else {
  try {
    await bootBrowser(root, token);
  } catch (error) {
    root.textContent = `Fathom could not start: ${
      error instanceof Error ? error.message : "Unknown error"
    }`;
  }
}
