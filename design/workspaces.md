# Workspaces: agents across several folders

Exploration for running Fathom agents across several folders at once, such as
an API, a web client, shared contracts, and infrastructure. Screens are under
**Screens → Workspaces** in the viewer.

## The idea

A **workspace** is a named set of folders that agents read, edit, run, and test
together. Every tab holds one workspace. One folder opened on its own is a
workspace with one folder, so there is a single kind of thing rather than
"projects" plus "multi-projects". A one-folder workspace grows by adding
folders and becomes shareable when it is saved to a file.

A workspace holds:

| Part         | What it is                                                      |
| ------------ | --------------------------------------------------------------- |
| Folders      | Paths anywhere on disk, each with a short name (`api`, `web`)   |
| Access       | Per folder: agents can edit it or only read it                  |
| Services     | Processes to start for testing, their ports, and what they need |
| Connections  | Values one service gets from another (`VITE_API_URL` from api)  |
| Checks       | Commands that prove a change works, and which services they need |
| Instructions | Instruction files that apply across the workspace               |
| Sessions     | Agent sessions belong to the workspace, not to one folder       |

Services and checks are what make this more than a multi-root file tree: they
let an agent change `api` and `web` and then prove the change with both
running.

## Naming

The screens use **Workspace**. Alternatives considered:

| Name      | For                                                           | Against                                               |
| --------- | ------------------------------------------------------------- | ----------------------------------------------------- |
| Workspace | Plain; matches VS Code multi-root, Go `go.work`, pnpm, Cargo  | Generic; the design code also uses it for the shell   |
| Stack     | Short; suggests front end plus back end                       | Confused with tech stack and call stack; implies layers |
| Chart     | Nautical, fits Fathom                                         | Needs explaining; nobody would guess what it holds    |
| Space     | Short; Arc uses it for grouped tabs                           | Says nothing about folders or running things          |

Recommendation: Workspace. The overlap with the shell's code names is internal
and harmless, since the shell is the view of one workspace.

## The file

A workspace is saved as `<name>.fathom`, a TOML file with paths relative to
itself. Double-clicking it opens Fathom. Where it lives is the user's choice
(setup step 3): beside the folders, inside one repository so the team gets it,
or only in Fathom's settings.

```toml
name = "Harbor"

[folders]
api       = "./harbor-api"
web       = "./harbor-web"
contracts = "./harbor-contracts"
infra     = "../platform/harbor-infra"
read_only = ["infra"]

[services.api]
folder = "api"
run    = "mix phx.server"
port   = 4000
needs  = ["db"]

[checks.e2e]
folder = "web"
run    = "pnpm test:e2e uploads"
needs  = ["db", "api", "web"]
```

The full example is in `fixtures/workspaces.ts`.

## Tabs: two options

**Option A: title-bar tabs** (`workspace-tabs`). Open workspaces are tabs in
the header, replacing the wordmark; the focus switch moves right. A spinner and
count mark running agents, a speech bubble marks one that needs input.
`⌘T` opens a new tab, `⌘1`–`⌘9` switch, `⌘O` opens the switcher.

**Option B: workspace rail** (`workspace-rail`). A narrow column of monogram
tiles left of the sessions sidebar, with running counts and a needs-input dot.
The sidebar names the current workspace.

Recommendation: Option A. Workspace names are words people recognise, and
monograms are ambiguous (Atlas and Archive are both "A"). Tabs also carry
familiar open, close, and reorder behavior. The rail is better if people keep
more than six or seven workspaces open, which can be revisited later.

Not drawn: a workspace dropdown in the sidebar with no tabs. It is the smallest
change but hides background agents in other workspaces, which is the main
reason to want tabs.

## Getting a workspace into a tab

A new tab shows four ways in (`workspace-new-tab`): new workspace, open a
`.fathom` file, open a folder, clone repositories. Below them are recent
workspaces with their folders and agent state. `⌘O` shows the same list as an
overlay on any tab (`workspace-switcher`); choosing an open workspace switches
to its tab instead of opening a second one.

Two ways to set up a new workspace, both writing the same file:

1. **Guided steps** (`workspace-setup-*`): folders, then "run together", then
   save. In step 2 Fathom reads the folders and proposes services,
   connections, checks, and instruction files, each traced to the file it came
   from. The user checks what goes in. The file preview on the right updates as
   choices are made.
2. **By conversation** (`workspace-setup-agent`): describe the folders and the
   agent drafts the file, asking only what it cannot read from the folders.

Recommendation: ship guided steps first, with the agent doing the reading in
step 2. Conversation setup can follow, because it needs the same reading and
the same file.

## Inside a workspace

- **Sessions sidebar.** The project filter becomes a folder filter
  (**All folders**). Each session shows the folders it changed instead of a
  project name.
- **Session inspector.** Adds **Folders** (branch and edits per folder, or read
  only) and **Services** (running, starting, stopped) above usage.
- **Changes.** Paths start with the folder name (`api/lib/…`), so one change
  summary covers every folder.
- **New session** (`workspace-new-session`). No project choice. The session
  picks which folders it may edit and where edits go: separate worktrees
  (default, so sessions can run in parallel), a new branch in the user's
  checkouts, or current branches.
- **Editor** (`workspace-editor`). One tree per folder, each showing its own
  branch.

## Open questions

1. **Name.** Workspace, or one of the alternatives?
2. **Tabs.** Option A or B?
3. **Worktrees across folders.** A session in separate worktrees needs its own
   ports for every service, or two sessions' `api` servers collide. Should
   Fathom assign ports per session, or run one shared set of services that
   sessions take turns using?
4. **Folders without git.** Worktrees and branches assume every folder is a
   repository. Does a plain folder fall back to "current files only"?
5. **File location default.** Beside the folders assumes they share a parent
   directory. If they do not, should the default become "only in Fathom"?
6. **Same folder in two workspaces.** Allowed? If so, sessions from both could
   edit the same checkout unless worktrees are required.
