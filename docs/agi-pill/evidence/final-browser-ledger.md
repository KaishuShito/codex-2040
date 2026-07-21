# Final browser ledger — affected-path replay

Date: 2026-07-21 JST  
Server: local Vite client at `http://127.0.0.1:4173/`  
Interaction: Codex in-app browser; visible controls only; no localStorage edits, state injection, mocked endings, or test-only time travel.

## Standard English restoration

1. Opened the Japanese Pill result's visible `モード選択へ` control.
2. Selected `EN` in the visible mode selector.
3. Selected `Resume Standard`; the independently completed Standard save loaded at 2040-01-01.
4. Observed English governed-takeoff mode identity, `Regulatory Freeze`, rank C / score 39, rival ranking, 2029/2035 decision recap, sources, speed controls, and TIBO protocol.
5. Captured `standard-ending-desktop-en.png`; repeated at 865×400 and captured `standard-mobile-landscape-en.png`.

## AGI Pill warning auto-pause

1. Selected `Choose mode` → `Resume AGI Pill` → `Try another worldline` → `Begin simulation`.
2. Selected `8x`, then the visible `Overclock` policy.
3. Coupled telemetry showed safety capacity falling behind capability and the risk band increasing from 46.7 to 63.5.
4. At T+4Y 324D a `CRITICAL WINDOW / Control deficit` alert appeared: “Capability is outrunning verification and corrigibility.”
5. The alert displayed a 23-day recoverable countdown and three direct moves: `Safety first`, `Governance first`, and `Civilization pact`.
6. The 8x control was no longer active. The date read T+4Y 324D before and after a three-real-second wait.
7. Captured `agi-pill-warning-auto-pause-en.png`.

## Verifier result

- Standard typed locale propagation and English runtime: PASS.
- Pill visible warning chain and automatic pause at 8x: PASS.
- Pill warning remains recoverable and causally legible: PASS.
- Direct-state manipulation prohibition: PASS.

## Independent-audit P1 closure

1. Restored Standard in English after the authored-content localization commit. Latest scenario intel read `Youth protest agent walkout`; scanning the visible DOM found zero Japanese headlines.
2. The translation contract iterates all 100 authored world events and all combos, requiring non-empty, non-Japanese English copy. Known dynamic news is translated by exact or typed patterns; unknown source-language GM/player content receives an explicit English disclosure rather than fabricated content.
3. Re-measured the ending using browser `innerWidth`/`innerHeight`, not screenshot pixel assumptions. At 865×400 the four-card grid computed as two 408px columns and page width was 865/865. At 844×391 it computed as two 397.333px columns and page width was 844/844.
4. Replaced `standard-mobile-landscape-en.png` with the corrected 865×400 evidence.
