# 2048

A 2048 Game with AI Assistant

## Docs

- [`TECHNICAL_DESIGN.md`](./TECHNICAL_DESIGN.md) — architecture, design decisions, AI strategy.
- [`TEST_PLAN.md`](./TEST_PLAN.md) — function-by-function test cases.
- [`AI_FLOW.md`](./AI_FLOW.md) — domain & AI module flow.
- [`bench/`](./bench/) — self-play benchmark harness + [`BENCHMARK_REPORT.md`](./bench/BENCHMARK_REPORT.md).

## Design notes

- **AI loading state.** Expectimax depth 3 returns advice in ~74ms mean / 187ms p95 — full benchmark in [`bench/BENCHMARK_REPORT.md`](./bench/BENCHMARK_REPORT.md) (77% reach 2048 at n=100; random / greedy baselines never reach 2048). Even so, the AI panel shows a brief `Computing…` state. Playtesting read silent computation as "system frozen"; explicit feedback reads as "system thinking." A 100ms delay you can see beats a 100ms delay you can't.
