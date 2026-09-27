# Feature status

Only the subsets below have implementation evidence. This is **not** a blanket completion claim for the mockup or the full PRD.

| Area | Status | Evidence / boundary |
|---|---|---|
| Local decks and source | Implemented subset | Create/open/relink/hide, atomic local saves, source diagnostics, section hierarchy, and source-preserving edits have unit/integration coverage. Files remain local. |
| Development mode | Implemented subset | Source/split/preview views, outline navigation, direct plain-paragraph preview edits, and master theme/settings updates are wired; structural/rich edits use source. Browser coverage exercises eligible plain-text writeback and saved theme/layout. |
| Content | Implemented subset | Basic Markdown, syntax-highlighted code, KaTeX, constrained Mermaid, bounded inline JSON charts (line/bar/area/scatter/pie/donut), five layouts, four themes, reveal steps, and notes. Markdown images display an unavailable-image fallback; local assets and broader diagram syntax are not implemented. |
| Presentation mode | Implemented subset | Frozen saved deck, navigation and reveals, private notes/timer, pointer, ink, blank/blackout, explicit ink-discard confirmation, and local audience view. Browser coverage exercises reveals, navigation, blackout, ending, and notes privacy; annotation persistence/export is not implemented. |
| Audience/LAN | Implemented subset | Read-only audience route, sanitized shared rendering, reconnect, explicit interface/port sharing, and backend isolation tests. Remote-device connectivity and visual fidelity are not verified. |
| Integrated development | Implemented subset | `bun run dev` runs the Astro live-reloading UI and watched Bun API together; the UI displays a DEV MODE badge. Backend restarts invalidate the owner token and active sessions, so save drafts and refresh after API source changes. LAN audience assets still require a production build. |
| Export | Deferred | Buttons retained without export functionality. |
| Custom components and authored code | Deferred | JSX/imports/expressions, component registration, and execution are intentionally unavailable. |
| Full acceptance | Unverified | Browser end-to-end coverage exists for selected flows, not full mockup/PRD parity, accessibility/security review, physical LAN sharing, or measured performance. |

Validation at implementation handoff: `bun run check` (0 errors, 0 warnings), `bun test` (25 passing), and `bun run test:e2e` (Astro/Bun build and 2 Chromium tests passing). A loopback host smoke check returned 200 for `/`, `/audience/`, and `/api/bootstrap`; owner-protected `/api/library` rejected an unauthenticated request with 403 and accepted an authenticated request with 200. Browser tests exercise persisted source, rich rendering, local audience updates, export controls, and external-edit conflict; they do not prove remote-device LAN behavior, security certification, accessibility, or performance thresholds.
