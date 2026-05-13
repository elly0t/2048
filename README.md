# 2048

[![CI](https://github.com/elly0t/2048/actions/workflows/ci.yml/badge.svg)](https://github.com/elly0t/2048/actions/workflows/ci.yml)

A 2048 Game with AI Assistant

## Docs

- [`TECHNICAL_DESIGN.md`](./TECHNICAL_DESIGN.md) — architecture, design decisions, AI strategy.
- [`TEST_PLAN.md`](./TEST_PLAN.md) — function-by-function test cases.
- [`AI_FLOW.md`](./AI_FLOW.md) — domain & AI module flow.
- [`bench/`](./bench/) — self-play benchmark harness + [`BENCHMARK_REPORT.md`](./bench/BENCHMARK_REPORT.md).

## Testing

- **Unit + integration** — `npm install && npm test` (Vitest, ~10s). Suite enumerated in [`TEST_PLAN.md`](./TEST_PLAN.md).
- **Pre-push hook** — husky runs `npm run check` (typecheck + lint + format + unit suite) before every `git push`. Bypass with `git push --no-verify` if needed.
- **E2E (opt-in)** — `npm run e2e` (Playwright, Chromium + WebKit). First run downloads ~270 MB of browser binaries to the user cache (1–2 min); subsequent runs skip the check (~1 s). Scenarios in [`TEST_PLAN.md`](./TEST_PLAN.md) §UI Layer; design rationale in [`TECHNICAL_DESIGN.md`](./TECHNICAL_DESIGN.md) §12.

## Configuration

`EXPECTIMAX_DEPTH` in [`src/config.ts`](./src/config.ts) (default `3`) — drop to `2` on low-tier hardware for snappier advice. Win rates are ~equal (~80% both); d3 mostly wins in the 4096-reach tail. See [`bench/BENCHMARK_REPORT.md`](./bench/BENCHMARK_REPORT.md).

## Deploy

- **Preview** — `npx vercel` — uploads the local working tree and returns a preview URL.
- **Production** — `npx vercel --prod` — promotes the latest build to the production alias.
- **Auto-deploy** — push to `main` triggers GitHub Actions, which runs the full test suite (lint, typecheck, unit, build, Playwright E2E) and only then deploys to production via the Vercel CLI. See [`.github/workflows/ci.yml`](./.github/workflows/ci.yml).

## Tested on

- **Functional:** Apple M4 Pro / Brave (primary), iOS Safari (mobile swipe).
- **AI latency proxy:** Deployed build hit through Chrome DevTools' "Low-tier mobile" CPU profile (15.6× slowdown on M4 Pro) — d3 ranges from ~1s on full boards to ~8s on sparse boards (table in [`bench/BENCHMARK_REPORT.md`](./bench/BENCHMARK_REPORT.md) § "Browser latency under CPU throttle"). Default is shipped with the config escape hatch above.

## Design notes

- **AI loading state.** Expectimax depth 3 returns advice in ~74ms mean / 187ms p95 — full benchmark in [`bench/BENCHMARK_REPORT.md`](./bench/BENCHMARK_REPORT.md) (77% reach 2048 at n=100; random / greedy baselines never reach 2048). Even so, the AI panel shows a brief `Computing…` state. Playtesting read silent computation as "system frozen"; explicit feedback reads as "system thinking." A 100ms delay you can see beats a 100ms delay you can't.
