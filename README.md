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
