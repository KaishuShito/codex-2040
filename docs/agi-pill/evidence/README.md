# AGI Pill browser evidence

Captured with the Codex in-app browser against the local production-equivalent Vite client on 2026-07-21 (JST). Browser interaction—not mocks—was the primary verifier.

## Screenshot set

- `agi-pill-desktop-en.png` — English critical-event decision with causal chain and recovery-window copy.
- `agi-pill-dashboard-desktop-en.png` — English Earth control room, coupled telemetry, rivals, and Dyson-as-prologue frontier.
- `agi-pill-mobile-landscape-en.png` — landscape-mobile control room at the minimum representative viewport.
- `agi-pill-ending-desktop-en.png` — post-Dyson plural-solar-system result screen.
- `agi-pill-ending-desktop-ja.png` — a completed Japanese post-Dyson worldline, including its reproducible run seed (separate from the English evidence run).
- `standard-ending-desktop-ja.png` — independent Standard run at 2040, Japanese result screen (`Regulatory Freeze`, rank C).
- `standard-ending-desktop-en.png` — the same saved Standard result restored through the visible English mode selector after the typed Standard i18n fix.
- `standard-mobile-landscape-en.png` — corrected Standard result review at the actual 865×400 CSS viewport; all four market cards are present in a 2×2 grid with no page horizontal overflow.
- `standard-mobile-landscape-en-top.png` — alternate compact-landscape capture retaining the result header and upper market context.
- `agi-pill-warning-auto-pause-en.png` — fresh visible-play Pill run at T+4Y 324D, showing an automatically paused `Control deficit` critical window and three recovery actions.

## Final integrated browser run

The final run was repeated after the Cockpit B fixes and the TIBO naming cherry-pick:

1. Fresh AGI Pill start at T+0 in Japanese; Earth industrial-loop overlay and localized era labels visible.
2. Overclock worldline reached a warned/recoverable misalignment loss, proving unsafe acceleration does not auto-win.
3. Fresh balanced/industry worldline: no fixed-date event fired while its predicates were false.
4. Once capability and industry predicates became true, authored events fired. The run selected decisions and executed visible countermeasure buttons inside their persisted recovery windows.
5. Save/reload restored the Pill state and playback settings. A newly eligible authored event correctly re-paused the resumed 8x run.
6. The worldline moved Earth → autonomous orbit → first swarm ignition → branching solar-system civilization.
7. At T+10 the scenario-horizon review paused play and explicitly distinguished continued branching play from a forecast.
8. `Continue beyond the horizon` resumed post-Dyson play; the localized pluralistic-expansion result appeared at T+11.
9. Landscape-mobile result viewport reported `clientWidth=865`, `scrollWidth=865`, `clientHeight=400`, `scrollHeight=400` (no page overflow).

Independent Standard integrated run:

1. Fresh Standard start, tutorial skip, East Asia community action, and 8x progression.
2. Reload restored the Standard action/date without touching the Pill save.
3. Browser decisions were made at 2029 and 2035.
4. The run reached 2040-01-01 and rendered the full Standard result/receipt.

## Post-fix browser replay

After the independent auditor identified partial Standard English coverage and missing Pill warning auto-pause, the lead replayed the affected paths against committed implementation HEAD:

1. Visible mode selector → `EN` → `Resume Standard` restored the 2040 Standard ending with English shell, causal recap, competition result, decision review, controls, and source copy.
2. Visible mode selector → `Resume AGI Pill` → `Try another worldline` → `Begin simulation` → `8x` → `Overclock` reached a `Control deficit` alert at T+4Y 324D.
3. The alert was marked `RECOVERABLE`, exposed `Safety first`, `Governance first`, and `Civilization pact`, and automatically removed the active 8x state.
4. The visible date remained T+4Y 324D after a three-real-second observation, proving that the warning is a decision boundary rather than a reaction-time test.
5. After the fresh-context audit, the Standard English run was replayed with fully localized authored news (`Youth protest agent walkout` latest intel; zero Japanese visible headlines).
6. The corrected ending was measured at actual CSS viewports 865×400 and 844×391. Compact-landscape media rules were active, all four competitor cards were in the DOM and visible grid, and page `scrollWidth` equaled `clientWidth` at both sizes.

The final automated gate and synthetic-worldline evidence live in `RESULT.md` and `playtests/agi-pill/REPORT.md`.
