# Desktop development

Build and launch the native app from the repository root:

```sh
script/build_and_run.sh --debug
```

`deno task desktop` in `app/` uses the same build and signing implementation,
without launching the app. Keep verification in the native app. Run simple agent
checks with ChatGPT Luna; use Astra for substantive work through Fathom.

## Keep macOS permissions across builds

The build uses an installed signing certificate and the stable bundle identifier
`dev.fathom.desktop`. When exactly one valid code-signing identity is installed,
the first build selects it. It records the selection in the ignored
`app/.desktop.local.json`, regenerated from the current `app/deno.json` on each
build. No private key is copied into the repository.

To choose an identity explicitly:

```sh
security find-identity -v -p codesigning
FATHOM_CODESIGN_IDENTITY='identity name or certificate hash' script/build_and_run.sh --debug
```

Later builds reuse the recorded identity. If it is unavailable, the build stops
before replacing the running app; it does not silently choose another certificate
or switch to ad-hoc signing. Install a valid development certificate or explicitly
select the replacement identity. A changed identity can require macOS permissions
to be approved again.

`FATHOM_CODESIGN_IDENTITY=-` explicitly requests a disposable ad-hoc build. Avoid
it for normal desktop development: App Management permissions can stop matching
after a rebuild. Do not reset the user's privacy database to work around this.

The certificate-signed bundle uses Hardened Runtime. The main app and CEF helpers
carry Apple's JIT entitlement for their JavaScript engines. Only the main plugin
host permits libraries signed by other teams, because npm native addons and
native plugins can carry different signatures. The bundled PTY library is signed
with the build identity before embedding. Helpers are signed before the final app
signature seals the bundle.

References: [Deno signing](https://docs.deno.com/runtime/desktop/distribution/),
[Apple JIT entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.allow-jit),
[Apple library validation](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.disable-library-validation).

Development signing is not distribution notarization. Publishing still requires
the appropriate distribution identity and a separate notarization workflow.

## Isolated local data

Use a separate Fathom data directory for development when needed:

```sh
FATHOM_HOME=/tmp/fathom-development script/build_and_run.sh --debug
```

The launcher supplies the repository workspace and installed Deno executable.
On macOS, the native app privately records its home, workspace, Deno executable,
and optional auth-file path under `~/Library/Application Support/Fathom/launches/`.
The record is keyed by executable path, keeping separate checkout bundles apart.
Finder and macOS relaunches restore those paths when explicit overrides are absent.
Tokens and other environment variables are not recorded. An explicit change to
`FATHOM_HOME` starts a different profile without importing the previous profile's
workspace or auth path.

With no launch record, the desktop app opens a recent project or the project
picker. It does not automatically open or ask to trust `/` just because macOS
started the process there. Workspace trust still comes from the selected profile.

Background commands and interactive terminals remove the desktop-only
`DENO_SERVE_ADDRESS` before starting their shell, so child development servers
can bind their own ports. Use `bash(background: true)` for servers and `pty` to
inspect or stop them. Stop verification processes when finished.
