import "./workbench.css";
import { bootBrowser } from "@fathom/host-browser";

// A launch link can navigate an existing tab without re-running this module.
addEventListener("hashchange", () => {
  const nextToken = new URLSearchParams(location.hash.slice(1)).get("token");

  if (!nextToken) {
    return;
  }

  sessionStorage.setItem("fathom-launch-token", nextToken);
  history.replaceState(null, "", location.pathname);
  location.reload();
});

const root = document.getElementById("app");

if (!root) {
  throw new Error("Missing application root #app");
}

const hash = new URLSearchParams(location.hash.slice(1));

const token =
  hash.get("token") ?? sessionStorage.getItem("fathom-launch-token");

if (hash.has("token") && token !== null) {
  history.replaceState(null, "", location.pathname);
  sessionStorage.setItem("fathom-launch-token", token);
}

if (!token) {
  root.textContent =
    "Open the launch link printed by deno task dev to connect to Fathom.";
} else {
  try {
    await bootBrowser(root, token);
  } catch (error) {
    root.textContent = `Fathom could not start: ${
      error instanceof Error ? error.message : "Unknown error"
    }`;
  }
}
