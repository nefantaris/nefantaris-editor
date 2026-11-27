# Nefantaris Editor

Desktop editor for Nefantaris sites.

See [BRIEF.md](./BRIEF.md) for the mission and product direction.

## Setup wizard

"Create site" on the welcome window walks through three steps: name and place
the site (scaffolded through the bundled core's `nef init`, then put under
version control), put it online (a private GitHub repo plus the first
publish), and go live (a guided Cloudflare Pages walkthrough with a liveness
check against the site's address). Leaving the wizard any time after the
first step always leaves a fully working local site in the recent list. The
wizard does not persist its progress: reopening it starts a fresh flow for a
new site rather than resuming an earlier one.

## Style panel

The Style rail destination edits the site's `custom.css` visually, beside the
preview. A target is picked on the page (the preview bridge's suggested
selectors, shown in plain words), chosen from element types scoped to
`[data-part="content"]`, or chosen from the theme's declared parts. Each change
is one declaration, written by `electron/styleRules.cts` with postcss: it finds
or creates the rule for that exact selector in the right scope and leaves every
other byte of the file alone.

Screen sizes come from the theme's `breakpoints` in `nef inspect --json`:

| Size      | Breakpoint used                                 | CSS written                                    | Preview width                               |
| --------- | ----------------------------------------------- | ---------------------------------------------- | ------------------------------------------- |
| All sizes | none                                            | a top-level rule                               | the pane, never narrower than Tablet's `lg` |
| Tablet    | below `lg` (the one nearest 1024px if unnamed)  | `@media (max-width: <lg − 0.02>px)`, 1023.98px | `md`'s width, 768px                         |
| Phone     | below `md` (the one nearest 768px under Tablet) | `@media (max-width: <md − 0.02>px)`, 767.98px  | 375px, or narrower if `md` is narrower      |

New top-level rules go after the last top-level rule before the first Tablet
or Phone block; the Tablet block sits before the Phone block, so Phone
overrides Tablet overrides All sizes. A theme reporting fewer than two
breakpoints, or a core that reports none, gets Tailwind's `md` and `lg`. A
preview wider than its pane is scaled down to fit.

## Commands

| Command                  | What it does                                     |
| ------------------------ | ------------------------------------------------ |
| `npm run dev`            | Vite dev server only (needs the Electron shell)  |
| `npm run dev:app`        | Renderer + Electron shell                        |
| `npm run build`          | Type-check and build the renderer to `dist/`     |
| `npm run build:electron` | Compile the Electron shell to `dist-electron/`   |
| `npm run lint`           | ESLint with autofix (`lint:check` to only check) |
| `npm run format`         | Prettier (`format:check` to only check)          |
| `npm run test:e2e`       | Playwright e2e suite against the built app       |

## License

MIT — see [LICENSE](./LICENSE).
