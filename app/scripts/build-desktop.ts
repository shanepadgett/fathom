import { fileURLToPath } from "node:url";

type DesktopConfig = {
  desktop?: {
    app?: { identifier?: string };
    macos?: { codesignIdentity?: string; [key: string]: unknown };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

const root = fileURLToPath(new URL("../", import.meta.url));
const localConfig = new URL("../.desktop.local.json", import.meta.url);
const bundle = `${root}dist/Fathom.app`;

async function run(args: string[]) {
  const result = await new Deno.Command(Deno.execPath(), {
    args,
    cwd: root,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  }).spawn().status;
  if (!result.success) throw new Error(`Desktop build failed (${result.code})`);
}

async function sign(path: string, identity: string, entitlements?: string) {
  const result = await new Deno.Command("/usr/bin/codesign", {
    args: [
      "--force",
      "--sign",
      identity,
      "--timestamp",
      ...(entitlements
        ? [
          "--options",
          "runtime",
          "--entitlements",
          `${root}scripts/${entitlements}`,
        ]
        : []),
      path,
    ],
    stdout: "inherit",
    stderr: "inherit",
  }).spawn().status;
  if (!result.success) throw new Error(`Signing failed: ${path}`);
}

async function signingIdentity(): Promise<string> {
  const override = Deno.env.get("FATHOM_CODESIGN_IDENTITY");
  if (override === "-") return override;
  let saved: string | undefined;
  try {
    const previous: DesktopConfig = JSON.parse(
      await Deno.readTextFile(localConfig),
    );
    saved = previous.desktop?.macos?.codesignIdentity;
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  const result = await new Deno.Command("/usr/bin/security", {
    args: ["find-identity", "-v", "-p", "codesigning"],
  }).output();
  if (!result.success) {
    throw new Error("Unable to inspect macOS signing identities");
  }
  const identities = [
    ...new TextDecoder().decode(result.stdout).matchAll(
      /^\s*\d+\) ([A-Fa-f0-9]{40}) "([^"]+)"/gm,
    ),
  ].map((match) => ({ hash: match[1], name: match[2] }));
  const requested = override || (saved !== "-" ? saved : undefined);
  if (requested) {
    const identity = identities.find((item) =>
      item.hash === requested || item.name === requested
    );
    if (!identity) {
      throw new Error(
        "The saved signing identity is unavailable. Set FATHOM_CODESIGN_IDENTITY to an installed identity; refusing to change the app identity silently.",
      );
    }
    return identity.hash;
  }
  if (identities.length !== 1) {
    throw new Error(
      "Choose an installed macOS signing identity with FATHOM_CODESIGN_IDENTITY. For disposable builds only, explicitly use FATHOM_CODESIGN_IDENTITY=- (permissions may reset).",
    );
  }
  return identities[0].hash;
}

const config: DesktopConfig = JSON.parse(
  await Deno.readTextFile(new URL("../deno.json", import.meta.url)),
);
const identity = Deno.build.os === "darwin"
  ? await signingIdentity()
  : undefined;
if (identity) {
  config.desktop = {
    ...config.desktop,
    macos: { ...config.desktop?.macos, codesignIdentity: identity },
  };
  // Keep the config beside deno.json so relative imports and lockfile discovery agree.
  await Deno.writeTextFile(
    localConfig,
    `${JSON.stringify(config, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(
    identity === "-"
      ? "Explicit disposable ad-hoc signing"
      : `Using persistent signing identity ${identity}`,
  );
}
await run(["task", "build"]);
await run(["run", "-A", "scripts/prepare-native.ts"]);
if (identity && identity !== "-") {
  // Native FFI libraries must carry the same team identity as the hardened host.
  for await (const entry of Deno.readDir(`${root}native`)) {
    if (entry.isFile && entry.name.endsWith(".dylib")) {
      await sign(`${root}native/${entry.name}`, identity);
    }
  }
}
if (Deno.build.os === "darwin") {
  const pattern = `${bundle}/Contents/MacOS/laufey`.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  const stopped = await new Deno.Command("/usr/bin/pkill", {
    args: ["-f", `${pattern}$`],
  }).output();
  if (!stopped.success && stopped.code !== 1) {
    throw new Error("Could not stop the previous desktop build");
  }
}
await run([
  "desktop",
  "-A",
  "--backend",
  "cef",
  "--include",
  "public",
  "--include",
  "native",
  ...(Deno.build.os === "darwin"
    ? ["--config", fileURLToPath(localConfig)]
    : []),
  ...Deno.args,
  "--output",
  `${root}dist/Fathom`,
  "main.ts",
]);
if (identity && identity !== "-") {
  // Deno's packager signs nested code but does not supply V8/CEF JIT entitlements.
  // Sign helper bundles first, then seal their updated signatures in the main app.
  for await (const entry of Deno.readDir(`${bundle}/Contents/Frameworks`)) {
    if (entry.isDirectory && entry.name.endsWith(".app")) {
      await sign(
        `${bundle}/Contents/Frameworks/${entry.name}`,
        identity,
        "desktop-helper-entitlements.plist",
      );
    }
  }
  await sign(bundle, identity, "desktop-entitlements.plist");
}
