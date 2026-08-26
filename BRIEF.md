# nefantaris-editor

## Mission

The product's face: a desktop app where a non-technical person creates, edits, and publishes their site without ever seeing git, a terminal, or a config file. Editing should feel like Obsidian; publishing should feel like saving.

## v1 scope

- Guided setup: GitHub sign-in, create or connect a site repo, walk through connecting Cloudflare Pages
- Markdown editing with live preview; frontmatter presented as form fields; directives insertable as blocks from a palette
- Git without git vocabulary: bundled git implementation (no system git), save maps to commit, publish maps to push, history is "versions"
- Conflict handling: friendly side-by-side markdown resolution when a pull conflicts
- Local preview: embed `nef dev` from nefantaris-core
- File/page management: create, rename, organize content

## Non-goals (v1)

- Layout or visual design editing (distant stretch goal)
- Git hosts beyond GitHub (keep the git layer abstracted, though)
- Collaboration/multiplayer

## Open questions

- Editing engine: do NOT hand-roll one. Research how Obsidian (CodeMirror 6 with live-preview decorations), Zettlr, MarkText, and Milkdown/ProseMirror-based editors achieve their feel; pick the engine that gets Obsidian-like quality without their bloat
- Git library: isomorphic-git vs bundling a git binary vs nodegit — evaluate against conflict handling and GitHub auth needs
- Where credentials live (OS keychain) and which GitHub auth flow (device flow vs OAuth app)
- How the embedded preview process is managed (spawn vs in-process)

## Layout

`src/` is the renderer (create-react-adam stack). `electron/` holds main process and preload — wiring only until the editor work starts in earnest.
