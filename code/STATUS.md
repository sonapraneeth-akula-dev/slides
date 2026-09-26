# Feature status

Only the subsets below have implementation evidence. This is **not** a blanket completion claim for the mockup or the full PRD.

| Area | Status | Evidence / boundary |
|---|---|---|
| Local decks and source | Implemented subset | Create/open/relink/hide, atomic local saves, source diagnostics, section hierarchy, and source-preserving edits have unit/integration coverage. Files remain local. |
| Development mode | Implemented subset | Source/split/preview views, outline navigation, direct plain-paragraph preview edits, and master theme/settings updates are wired; structural/rich edits use source. |
| Content | Implemented subset | Basic Markdown, syntax-highlighted code, KaTeX, constrained Mermaid, bounded inline JSON charts (line/bar/area/scatter/pie/donut), five layouts, four themes, reveal steps, and notes. Markdown images display an unavailable-image fallback; local assets and broader diagram syntax are not implemented. |
| Presentation mode | Implemented subset | Frozen saved deck, navigation and reveals, private notes/timer, pointer, ink, blank/blackout, explicit ink-discard confirmation, and local audience view. Annotation persistence/export is not implemented. |
| Audience/LAN | Implemented subset | Read-only audience route, sanitized shared rendering, reconnect, explicit interface/port sharing, and backend isolation tests. Remote-device connectivity and visual fidelity are not verified. |
| Export | Deferred | Buttons retained without export functionality. |
| Custom components and authored code | Deferred | JSX/imports/expressions, component registration, and execution are intentionally unavailable. |
| Full acceptance | Unverified | Full mockup/PRD parity, browser end-to-end coverage, accessibility/security review, and measured performance have not been established. |

Validation at implementation handoff: `bun run check` (0 errors, 0 warnings), `bun test` (25 passing), and `bun run build` (owner/audience pages and Bun host). A loopback host smoke check returned 200 for `/`, `/audience/`, and `/api/bootstrap`; owner-protected `/api/library` rejected an unauthenticated request with 403 and accepted an authenticated request with 200. These checks do not prove browser/LAN behavior, security certification, accessibility, or performance thresholds.
