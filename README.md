# Nefantaris Editor

Desktop editor for Nefantaris sites.

See [BRIEF.md](./BRIEF.md) for the mission and product direction.

## Commands

| Command                  | What it does                                     |
| ------------------------ | ------------------------------------------------ |
| `npm run dev`            | Renderer only, in the browser (Vite dev server)  |
| `npm run dev:app`        | Renderer + Electron shell                        |
| `npm run build`          | Type-check and build the renderer to `dist/`     |
| `npm run build:electron` | Compile the Electron shell to `dist-electron/`   |
| `npm run lint`           | ESLint with autofix (`lint:check` to only check) |
| `npm run format`         | Prettier (`format:check` to only check)          |
| `npm run test:e2e`       | Playwright smoke test                            |

## License

MIT — see [LICENSE](./LICENSE).
