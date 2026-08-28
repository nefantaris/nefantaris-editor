# nefantaris-editor

## Mission

The product's face: a desktop app where a non-technical person creates, edits, and publishes their site without ever seeing git, a terminal, or a config file. Editing should feel like Obsidian; publishing should feel like saving.

## v1 scope

- Guided setup: GitHub sign-in, create or connect a site repo, walk through connecting Cloudflare Pages (the connection itself is a guided browser walkthrough; the editor confirms success by polling the site's `pages.dev` URL)
- Markdown editing in CodeMirror 6 with live-preview decorations; frontmatter presented as form fields; directives insertable as block widgets from a palette
- Git without git vocabulary: isomorphic-git bundled behind an abstracted git layer, autosave writes to disk, Publish runs commit → pull → push, history is "versions"
- Conflict handling: merge conflicts intercepted via a custom merge driver and resolved in a friendly side-by-side markdown UI
- Local preview: spawn `nef dev` from the bundled nefantaris-core as a child process on a dynamically allocated port, shown in an embedded webview
- File/page management: create, rename, organize content; pasted images land in `assets/` and insert their markdown reference
- One window per site (VS Code model); a welcome window lists known sites and offers create, clone, and open

## Main window

Left sidebar lists pages and posts; center is the CodeMirror editor with a collapsible frontmatter form above it; a Preview toggle opens the running site as a right split. A status bar carries sync state (synced / offline / newer version online) and the Publish action.

## Decisions

The choices that used to be open questions here are settled and recorded ADR-style in the workspace `DECISIONS.md` (all dated 2026-08-26): CodeMirror 6 over ProseMirror-style WYSIWYG, isomorphic-git over nodegit/dugite, OAuth device flow with tokens in Electron `safeStorage`, autosave with Publish = commit → pull → push, `nef inspect --json` as the editor's source of theme knowledge, and one window per site. Read those entries before revisiting any of it.

Sync policy: opening a site fetches, pulls silently when the working tree is clean, and shows a "newer version online — update?" banner when it isn't. Publish always pulls before pushing. "Publish" strictly means putting the site live; a page's `draft` flag is a separate toggle and is never called publishing.

## Depends on core

Two commands land in nefantaris-core (owned by the core work stream, not this repo):

- `nef inspect [siteDir] --json` — emits the resolved site shape: site config, resolved template names, resolved directive names, enabled plugins. The editor never parses `theme.json` itself. Until this ships, the editor builds against a checked-in fixture JSON of the same shape and swaps to the real call when it lands.
- `nef init <dir>` — scaffolds a content-only site (`nefantaris.json`, starter page, `assets/`, `.gitignore`). The editor's "new site" wraps it.

## Non-goals (v1)

- Layout or visual design editing (distant stretch goal)
- Git hosts beyond GitHub (keep the git layer abstracted, though)
- Collaboration/multiplayer

## Layout

`src/` is the renderer (create-react-adam stack). `electron/` holds main process and preload — window management, the git layer, the `nef dev` process supervisor, and safeStorage all live main-side and reach the renderer over typed IPC.
