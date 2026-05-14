# 2048

[![CI](https://github.com/elly0t/2048/actions/workflows/ci.yml/badge.svg)](https://github.com/elly0t/2048/actions/workflows/ci.yml)

A playable 2048 with an in-browser AI assistant. React + TypeScript + Vite, tested with Vitest and Playwright. The Expectimax search (depth 3) runs on the client to provide sub-100ms typical advice.

Substantial docs live alongside the code: [`TECHNICAL_DESIGN.md`](./TECHNICAL_DESIGN.md) (architecture), [`TEST_PLAN.md`](./TEST_PLAN.md) (test coverage spec), [`AI_FLOW.md`](./AI_FLOW.md) (AI module flow), [`bench/`](./bench/) (self-play benchmark harness + report). Full index at the bottom.

**Live:** <https://2048-delta-five.vercel.app>

## Run locally

Requires Node >=22.

```bash
npm install
npm run dev
```

Open <http://localhost:2048> (yes, that port — `vite.config.ts:server.port = 2048`, because of course). Arrow keys on keyboard / swipe on mobile to play; click the AI button for next move suggestion.

## Tech stack

- **UI** — React 18 + TypeScript, Vite dev server / bundler.
- **AI** — Expectimax (depth 3) over a 2D-array game model, synchronous on the main thread.
- **Tests** — Vitest (unit + integration), Playwright (E2E, Chromium + WebKit).
- **Tooling** — ESLint, Prettier, Husky pre-push hook.

Architecture, AI strategy, and tradeoffs: [`TECHNICAL_DESIGN.md`](./TECHNICAL_DESIGN.md).

## Testing

- **Unit + integration** — `npm test` (Vitest, ~10s). Cases enumerated in [`TEST_PLAN.md`](./TEST_PLAN.md).
- **E2E (opt-in)** — `npm run e2e` (Playwright, Chromium + WebKit). Scenarios in [`TEST_PLAN.md`](./TEST_PLAN.md) §UI Layer.
- **Pre-push** — Husky runs `npm run check` (typecheck + lint + format + unit) before every push.

## Configuration

In [`src/config.ts`](./src/config.ts):

- `EXPECTIMAX_DEPTH` (default `3`) — drop to `2` on low-tier hardware for snappier advice. Win rates are ~equal (~80% both); d3 wins significantly more to reach 4096. Numbers in [`bench/BENCHMARK_REPORT.md`](./bench/BENCHMARK_REPORT.md).

- `INIT_TILE_COUNT` (default `min: 2, max 8`) — adjust to spawn more or less 2 tiles when game starts.

- More in the config file.

## Design notes

- Expectimax depth 3 returns advice in ~74ms mean / 187ms p95 — full benchmark in [`bench/BENCHMARK_REPORT.md`](./bench/BENCHMARK_REPORT.md) (77% reach 2048 at n=100; random / greedy baselines never reach 2048).
- The AI panel shows a brief `Computing…` state when searching, to show the system is thinking instead of being frozen.

## Deploy

- **Preview** — `npx vercel` — uploads the local working tree and returns a preview URL.
- **Production** — `npx vercel --prod` — promotes the latest build to the production alias.
- **Auto-deploy** — push to `main` triggers GitHub Actions, which runs lint, typecheck, unit, build, and Playwright E2E before deploying via the Vercel CLI. See [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) — rationale in [`TECHNICAL_DESIGN.md`](./TECHNICAL_DESIGN.md) §7.4.

## Tested on

- **Functional** — Apple M4 Pro / Brave, Chrome, Safari, iOS Safari (mobile swipe).
- **AI latency proxy** — Deployed build hit through Chrome DevTools' "Low-tier mobile" CPU profile (15.6× slowdown on M4 Pro, calibrated): d3 ranges from ~1s on full boards to ~8s on sparse boards. Table in [`bench/BENCHMARK_REPORT.md`](./bench/BENCHMARK_REPORT.md) § "Browser latency under CPU throttle".

## Notes

- Pre-push hook failing but need to get past check for deployment? `git push --no-verify` bypasses it.
- First `npm run e2e` downloads ~270 MB of Playwright browser binaries (1–2 min); subsequent runs skip the check.

## Docs

- [`TECHNICAL_DESIGN.md`](./TECHNICAL_DESIGN.md) — **Recommended Starting Point**. Architecture, design decisions, AI strategy. 15-min reading path at the top.
- [`TEST_PLAN.md`](./TEST_PLAN.md) — function-by-function test cases.
- [`AI_FLOW.md`](./AI_FLOW.md) — domain & AI module flow.
- [`bench/`](./bench/) — self-play benchmark harness + [`BENCHMARK_REPORT.md`](./bench/BENCHMARK_REPORT.md).
