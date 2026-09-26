# PRD: Slides

## 1. Overview

- **Version**: 1.0  |  **Date**: 2026-09-26  |  **Status**: Draft
- **Sources**: [Discovery](../plans/2026-09-21_slides_discovery.md) (behavior and priorities, Draft) · [Technical design](../plans/2026-09-22_slides_technical-design.md) (Bun + Astro + TypeScript islands, Draft)
- **Traceability**: every discovery `FR-xxx` / `NFR-xxx` maps to exactly one requirement below (section 4 "Covers" column). Feasibility gates `G-01`..`G-06` from the technical design are milestones in their own right and are scheduled first (section 9).

Items the discovery marks **Proposed** keep that status here. Writing them into a milestone sets their intended priority. It does not approve them. This PRD does not authorize implementation. That requires owner sign-off on the discovery, the technical design, and this document (section 10).

### Problem Statement

The owner, a programmer who presents technical material, has no slide tool that fits a document-driven workflow. He wants to write Markdown/MDX, nest explanations to any depth, run small JavaScript/React demos, present with private notes and live marking, and export ordered PDF/HTML. All of it should run from one local executable without a cloud account or a separately installed runtime. Existing products (Deckrun, Slidev, reveal.js, Marp, Quarto) each cover part of this. None combines recursive trees, frozen presentation instances, permissioned code, and read-only LAN audience viewing.

### Target Users

A single local owner who also acts as author and presenter, plus read-only audiences who watch in a projector window, on a LAN browser, or through an exported artifact. Primary users are desktop keyboard-and-mouse users on Windows, macOS, and Linux.

## 2. Goals & Non-Goals

### Business Goals / User Goals

- **Complete workflow**: for each of three technical decks, the owner can find it in the local library, open the pages view, author it, edit it externally, present it in two windows, annotate, and export, with no manual HTML repair.
- **Narrative order**: Next/Previous, export order, and the navigation fixture hierarchy agree 100%.
- **Responsiveness**: 3-second launch, 200 ms preview, 100 ms navigation, and 60 fps on the reference workload (NFR-001..004).
- **Export quality**: all built-in content renders with no missing assets, no unintended clipping, and no private-note leakage.
- **Ownership and offline use**: no unapproved external requests. Files, not browser storage, are authoritative. LAN sharing needs no internet.
- **Draft/presentation separation**: draft edits hot reload. Active presentations never change.
- **Consistent design**: master edits update every draft slide. A template change affects only its slide.
- **Network viewing**: two separate LAN clients reproduce the presenter's public output without any access to private data or controls.

### Non-Goals (Out of Scope)

- Cloud accounts/storage, telemetry, hosted collaboration, payments. _Rationale: personal, local-first tool._
- Public internet hosting, automatic tunnels/router forwarding, cross-device presenter control. _Rationale: LAN audience viewing only; control stays on the host._
- Live Python/R, shell, notebook kernels, server-side code runners. _Rationale: only simple JavaScript/React executes; other languages are displayed._
- Plugin marketplace or third-party extension distribution. _Rationale: extensibility comes from maintainer changes and local React components._
- Freeform object-placement editor; arbitrary HTML import/editing. _Rationale: MDX is the source, HTML is output; master and templates cover design._
- PPTX, notebook, or office-document import/export. _Rationale: not selected._
- Full TeX, arbitrary LaTeX packages, TikZ. _Rationale: KaTeX-compatible equations only._
- Full mobile authoring or native mobile executables. _Rationale: desktop first; exported reading stays responsive._
- Guaranteed single-file HTML, or a bundled PDF browser. _Rationale: folder bundles and an installed Chromium are accepted._

## 3. User Personas

- **Owner / maintainer**: a developer who extends the product and approves requirements.
- **Author**: has file and markup skills, and optionally JavaScript/React. Edits in the browser or an external editor.
- **Presenter**: familiar with decks, keyboard, and mouse. Navigates branches and reveals, reads notes, marks slides live, and shares on the LAN.
- **Audience / reader**: needs no authoring knowledge. Views on a projector, a LAN browser, or an exported artifact.

Owner, author, and presenter are often the same person.

| Role | Permissions | Key Actions |
|------|-------------|-------------|
| Owner / maintainer | Maintain product; approve requirements | Extend renderers/components; sign off milestones |
| Author | Edit selected files; grant code/network/file permissions on own device | Create, edit, lint, and export decks; edit master and templates |
| Presenter | Control local/LAN playback and annotations; start/stop sharing; save annotations explicitly | Present, navigate, annotate, share, and end sessions |
| Audience / reader | Read-only LAN view or independent export; no source edits or session control | Watch live output; read exported artifacts; grant own permissions for runnable HTML |

## 4. Requirements (MoSCoW)

| ID | Requirement | Priority | Problem it solves | Covers | Milestones | Est. AI |
|----|-------------|----------|-------------------|--------|------------|---------|
| REQ-001 | Users can launch the app from a file path and manage decks in a local, file-owned library | Must | No private, command-driven way to open and organize decks | FR-001–004, 011–015, 105, 106 | M-001.1–M-001.4 | 08:20 |
| REQ-002 | Authors can write MDX/Markdown in a browser editor with hot reload, durable autosave, and conflict safety | Must | Authoring must be fast and must never silently lose work | FR-005–010, 016, 086; NFR-002, 005, 013 | M-002.1–M-002.3 | 06:30 |
| REQ-003 | Presenters can navigate a recursive slide tree with reveals in one canonical order | Must | Flat decks cannot express nested explanations | FR-017–028, 050 | M-003.1–M-003.3 | 05:05 |
| REQ-004 | Decks render rich technical content offline | Must | Technical content must not be rebuilt in a graphical editor | FR-029–036, 039, 040 | M-004.1–M-004.4 | 05:55 |
| REQ-005 | Document code, network, and file access run only with explicit, device-local permission | Must | Authored code and references could leak data or harm the host | FR-037, 038, 041, 082–085; NFR-012 | M-005.1–M-005.3 | 05:40 |
| REQ-006 | Authors control deck design through a presentation master, 14 themes, four templates, and motion presets | Must | Consistent styling without editing every slide | FR-042–049, 099, 100 | M-006.1–M-006.3 | 04:40 |
| REQ-007 | Presenting uses frozen presentation instances with a private presenter view and a linked audience view | Must | Live edits must never change a running talk; notes must stay private | FR-051–053, 059, 097, 098, 102, 107 | M-007.1–M-007.2 | 03:40 |
| REQ-008 | Presenters can mark slides live with a laser, pen, canvas, blackout, highlights, and comments | Must | Presenters need to point and explain during a talk | FR-054–058, 060, 061 | M-008.1–M-008.2 | 03:45 |
| REQ-009 | Annotations are temporary until saved explicitly, with transactional Save/Clear/Cancel on export | Must | Presenters must not lose marks unexpectedly or clear them wrongly | FR-062, 063, 103, 104 | M-009.1–M-009.2 | 04:35 |
| REQ-010 | Decks export to source, Markdown, interactive/continuous/private HTML, and PDF without private leakage | Must | Portable, ordered artifacts with no manual repair | FR-064–069, 071–074; NFR-009, 018 | M-010.1–M-010.4 | 07:10 |
| REQ-011 | Deck lint runs in the editor and in CI with a failing exit status | Must | Problems should be found before the talk, not during it | FR-075–081 | M-011.1–M-011.2 | 02:25 |
| REQ-012 | Presenters can share a live instance read-only on the LAN with full public-output parity | Must | Audiences need their own screens without installing anything or seeing private data | FR-087–096, 101; NFR-006, 019, 020 | M-012.1–M-012.4 | 07:00 |
| REQ-013 | Standalone executables for all three OS families meet the performance, accessibility, and privacy bars | Must | The workflow must work anywhere without installing a runtime | NFR-001, 003, 004, 011, 014–016 | M-013.1–M-013.4 | 05:35 |
| REQ-014 | PDF export offers final-state-only mode, a linked TOC, and a throughput target | Should | Convenience for handouts and long decks | FR-070, 108; NFR-010 | M-014.1–M-014.3 | 02:20 |
| REQ-015 | The app stays lightweight and local React components are reusable across decks | Should | The owner's lightweight and extensibility motivation | NFR-007, 008, 017 | M-015.1–M-015.2 | 01:50 |
| REQ-016 | Presenter surface shows an elapsed timer and a next-slide preview | Should | Pacing aid during talks (discovery §11 "suggested Should"; no FR yet) | — | M-016.1 | 01:05 |
| REQ-017 | Charts add histograms, box plots, and heatmaps | Could | Scientific audiences (discovery §11 "Could"; no FR yet) | — | M-017.1 | 00:55 |
| REQ-018 | Authors can edit plain-text blocks directly in the draft preview, with edits written back to the MDX source | Should | Small wording fixes shouldn't require finding the source line | FR-109 | M-018.1 | 01:50 |
| **Total** | | | | | **48 milestones** | **78:20** |

Subtotals: Must 70:20 · Should 07:05 · Could 00:55.

### Won't Have

- Presenter extras beyond timer and preview, such as clocks, rehearsal recording, or audience Q&A. _Rationale: not requested; add Should FRs if accepted._
- In-place republishing of a running presentation. _Rationale: owner-confirmed. A new instance picks up changes._
- Viewer-side execution of authored code during live sharing. _Rationale: LAN viewers get only the presenter's public output (FR-090)._
- Automatic annotation backup or recovery after a session ends. _Rationale: owner-confirmed lifetime rule (FR-062)._
- Visual editing of code, diagrams, charts, media, components, or richly formatted text in the preview. _Rationale: FR-109 covers plain text only; everything else is edited in source._
- Every item listed under Non-Goals in section 2.

## 5. Requirement Breakdown

> Requirement → Milestone → Feature → User Story. Estimate rule: feature = sum of its stories; milestone = sum of its features + 00:15 exit-criteria run; requirement = sum of its milestones.

### REQ-001: Local launch, library, and file ownership (Must Have)

- **Outcome**: the platform executable opens a deck from a path, or opens My Decks with no path. All private surfaces stay on loopback. Decks are plain files in authorized locations.
- **Est. AI**: 08:20

#### Milestone M-001.1: Executable launches a private loopback host

- **Problem solved**: no private, command-driven way to open a deck.
- **Est. AI**: 02:15

##### FEAT-001.1.1: CLI launch and path handling

Implements `slides [path]` (FR-001, FR-002).

- **Est. AI**: 00:50
- **US-001** — **As an** author **I want** to run `slides <file>` **So that** my deck opens in a draft preview (`Est. AI: 00:30`)
  - [ ] `.mdx` and `.md` paths open in draft mode, never in a live session.
  - [ ] Paths with spaces and non-ASCII characters work on Windows, macOS, and Linux.
  - [ ] A missing or unreadable path gives an actionable error and exit code `2`.
- **US-002** — **As an** author **I want** to run `slides` with no path **So that** I land in My Decks (`Est. AI: 00:20`)
  - [ ] The library route opens in the default browser.
  - [ ] LAN sharing is never started implicitly.

##### FEAT-001.1.2: Private loopback listener and capability bootstrap

Implements FR-003 and FR-004, and the private-auth model from technical design §6.1.

- **Est. AI**: 01:10
- **US-003** — **As an** owner **I want** authoring, library, preview, and presenter controls served only on `127.0.0.1` **So that** no other device can reach them (`Est. AI: 00:45`)
  - [ ] The listener binds `127.0.0.1` on the configurable port (Proposed default `7890`), never `0.0.0.0` or `::`.
  - [ ] Exact Host and Origin checks reject DNS-rebinding and cross-site requests with 403.
  - [ ] A one-use launcher fragment is exchanged for an in-memory capability. It is removed from history and never written to local or session storage.
- **US-004** — **As an** author **I want** a different port offered when mine is taken **So that** launch never kills another process (`Est. AI: 00:25`)
  - [ ] When the port is occupied, the app reports the alternative URL, which uses the literal `127.0.0.1`.
  - [ ] The existing process keeps running.

**Exit Criteria**:

- [ ] **Unit tests**: port validation, Host/Origin guard, and capability expiry/replay (401) pass. Coverage on new host modules is at least 80%.
- [ ] **Integration tests**: occupied-port fallback and DNS-rebind/cross-origin rejection pass against a real listener.
- [ ] **UI / E2E tests**: US-001 and US-002 pass from Unicode+space paths on the candidate support matrix (Windows 11, macOS 14, Ubuntu 24.04; technical design §9.2, pending approval).
- [ ] **Security**: a LAN client cannot connect to the private port. The SAST and dependency scan has no high or critical findings.

#### Milestone M-001.2: Local deck library with authorized locations

- **Problem solved**: decks saved in different places are hard to find, and access to them must stay scoped.
- **Est. AI**: 02:50

##### FEAT-001.2.1: Default deck directory and authorized roots

Implements FR-011.

Related: the library applies REQ-005's authorized-location rule for file access.

- **Est. AI**: 01:15
- **US-005** — **As an** author **I want** new decks saved to a per-user `Decks` directory by default **So that** I don't have to pick a location each time (`Est. AI: 00:30`)
  - [ ] The directory is created under per-user app data, never beside the executable.
  - [ ] If it cannot be created or written, the app shows an error and a location picker. It never falls back silently or reports a false "saved".
- **US-006** — **As an** owner **I want** opening a file to authorize only that deck **So that** sibling decks are not indexed (`Est. AI: 00:45`)
  - [ ] File-open grants read-write access to the file. Referenced files beneath its folder are read-only.
  - [ ] References outside that folder need an explicit grant.
  - [ ] A directory is indexed only after a separately confirmed directory grant.
  - [ ] Canonical path identity prevents duplicate cards for symlinks and overlapping roots.

##### FEAT-001.2.2: Searchable cover-card gallery

Implements FR-105.

- **Est. AI**: 01:20
- **US-007** — **As an** author **I want** a gallery of cover cards I can search by title **So that** I can find any deck quickly (`Est. AI: 00:40`)
  - [ ] Cards list every app-created or opened deck, including decks outside the default directory, and they persist across restarts.
  - [ ] A cover is the first slide's static public preview, or a safe placeholder.
  - [ ] Covers never execute code, make external requests, or show notes or annotations.
- **US-008** — **As an** author **I want** missing or denied decks to stay visible with Relink and Remove-from-library actions **So that** nothing disappears silently (`Est. AI: 00:40`)
  - [ ] Relink keeps the document's identity and never moves or overwrites files.
  - [ ] Remove never deletes files. Removed decks stay excluded from directory reconciliation until explicitly reopened.

**Exit Criteria**:

- [ ] **Unit tests**: grant scoping, canonical-path dedupe, exclusion logic, and keyset pagination pass. Coverage on new code is at least 80%.
- [ ] **Integration tests**: SQLite index (`authorized_root`, `document_index`, `library_exclusion`) round-trips across restart with a real temp directory. An unavailable default root is reported.
- [ ] **UI / E2E tests**: US-005..US-008 pass. A deck created in an external location is still listed after restart.
- [ ] **Security**: opening one file never lists or reads sibling decks, and covers trigger zero network requests (verified by network capture).

#### Milestone M-001.3: Library document operations

- **Problem solved**: creating, duplicating, renaming, and deleting decks without breaking references or losing files.
- **Est. AI**: 01:55

##### FEAT-001.3.1: New deck initialization

Implements FR-012.

- **Est. AI**: 00:25
- **US-009** — **As an** author **I want** a new deck to start with a presentation master and a chosen first-slide template **So that** I need no hand-written setup (`Est. AI: 00:25`)
  - [ ] The deck is created in the default directory, or in an explicitly selected location.
  - [ ] A filename collision returns 409. An invalid path returns 422.

##### FEAT-001.3.2: Duplicate, rename, and delete

Implements FR-013, FR-014, and FR-015.

- **Est. AI**: 01:15
- **US-010** — **As an** author **I want** to duplicate a deck **So that** I can make a variant safely (`Est. AI: 00:25`)
  - [ ] The copy gets a new identity and never overwrites the original or shared assets.
  - [ ] Asset references in the copy still resolve.
- **US-011** — **As an** author **I want** to rename or move a deck **So that** its references keep working (`Est. AI: 00:30`)
  - [ ] Relative references are kept or recalculated. Collisions and invalid paths are reported.
  - [ ] The original stays in place until the operation succeeds.
  - [ ] (Proposed) Rename returns 409 while a draft of the deck is open.
- **US-012** — **As an** author **I want** deletion to require confirmation **So that** I don't lose a deck by accident (`Est. AI: 00:20`)
  - [ ] Only the selected source file is deleted. Referenced and shared assets stay.
  - [ ] Delete returns 409 while a draft is open.

**Exit Criteria**:

- [ ] **Unit tests**: reference recalculation and collision detection pass. Coverage on new code is at least 80%.
- [ ] **Integration tests**: interrupted rename/duplicate leaves the original intact. Delete keeps a shared asset that another deck uses.
- [ ] **UI / E2E tests**: US-009..US-012 pass, including the delete confirmation dialog.

#### Milestone M-001.4: Pages view

- **Problem solved**: the author needs a visual map of a deck's slides and hierarchy before editing or presenting.
- **Est. AI**: 01:20

##### FEAT-001.4.1: Canonical thumbnail pages view

Implements FR-106.

- **Est. AI**: 01:05
- **US-013** — **As an** author **I want** ordered slide thumbnails that show the hierarchy **So that** I can see the deck's structure (`Est. AI: 00:40`)
  - [ ] Each node gets one fully revealed static thumbnail, in canonical preorder, with its hierarchical number and title.
  - [ ] Keyboard-selectable grid with a list alternative.
  - [ ] Thumbnails contain no notes or annotations and trigger no code or external requests.
  - [ ] Draft changes refresh the affected thumbnails. A master change refreshes all of them.
- **US-014** — **As an** author **I want** to open a slide in draft mode, or press a separate Present button **So that** browsing never starts a talk by accident (`Est. AI: 00:25`)
  - [ ] Selecting a thumbnail opens that slide in the same draft workspace.
  - [ ] Present starts a new instance at the first node, reveal step 0.

**Exit Criteria**:

- [ ] **Unit tests**: thumbnail order equals the preorder from M-003.1 on the navigation fixture (discovery §6, technical design §3.3).
- [ ] **UI / E2E tests**: US-013 and US-014 pass. Stale pages are labeled after an invalid edit.
- [ ] **Accessibility**: zero critical or serious axe violations on `/library` and `/draft/:id/pages`. Full keyboard journey passes.

### REQ-002: Draft authoring, autosave, and conflict safety (Must Have)

- **Outcome**: authors edit MDX or Markdown in a browser editor or an external editor. The preview hot reloads. Every acknowledged save is durable, and competing edits are never lost.
- **Est. AI**: 06:30

#### Milestone M-002.1: MDX deck compiler and source contract

- **Problem solved**: the app needs one deterministic way to turn a Markdown/MDX file into a slide tree.
- **Est. AI**: 02:00

##### FEAT-002.1.1: Slide directive grammar and DeckIR

Implements FR-005 and the source contract from technical design §3.2.

- **Est. AI**: 01:15
- **US-015** — **As an** author **I want** plain Markdown to work without JSX **So that** I can write slides in ordinary Markdown (`Est. AI: 00:30`)
  - [ ] A file with no slide directives becomes one slide.
  - [ ] `.md` and `.mdx` use the same grammar and the same permission model.
  - [ ] MDX-versus-CommonMark differences are documented in `docs/formats/`.
- **US-016** — **As an** author **I want** `::slide{id parent}`, `:::reveal`, and `:::notes` directives **So that** I can declare a tree with reveals and private notes (`Est. AI: 00:45`)
  - [ ] Output is a DeckIR with stable IDs, preorder, depth, reveal groups, and source spans.
  - [ ] Cycles, missing parents, duplicate IDs, and dynamically generated structure are rejected with a source location.
  - [ ] Directives inside code fences are treated as code.
  - [ ] Notes go into a private graph before any public projection is built.

##### FEAT-002.1.2: Last valid preview

Implements FR-016.

- **Est. AI**: 00:30
- **US-017** — **As an** author **I want** invalid source to keep the last valid preview **So that** a typo doesn't blank my screen (`Est. AI: 00:30`)
  - [ ] The retained preview is labeled stale, and the edited text and its diagnostics are kept.
  - [ ] A build result for an older revision never replaces a newer one.

**Exit Criteria**:

- [ ] **Unit tests**: grammar fixtures (both extensions, all rejection cases, fenced directives) pass. Coverage on `compiler/` is at least 85%.
- [ ] **Integration tests**: compiling with code-execution permission denied evaluates no imports or expressions (verified by an instrumented module).
- [ ] **Security**: the public projection contains no note text, verified by byte search of the generated output.

#### Milestone M-002.2: Browser editor with hot-reload preview

- **Problem solved**: authors need immediate visual feedback while they type.
- **Est. AI**: 01:35

##### FEAT-002.2.1: CodeMirror source editor

Implements FR-006.

- **Est. AI**: 00:35
- **US-018** — **As an** author **I want** an in-browser source editor with undo and redo **So that** I can author without leaving the app (`Est. AI: 00:35`)
  - [ ] MDX mixed-syntax highlighting and inline diagnostics work.
  - [ ] Undo and redo work across the session.
  - [ ] The editor exists only in draft mode, never on the presentation surface.

##### FEAT-002.2.2: Hot-reloading draft preview

Implements FR-007 and NFR-002.

- **Est. AI**: 00:45
- **US-019** — **As an** author **I want** the adjacent preview to update as I edit **So that** I see results immediately (`Est. AI: 00:45`)
  - [ ] Source, component, local asset/data, master, and template edits refresh the preview and pages view.
  - [ ] On the reference edit set, p95 from edit to valid paint is at most 200 ms.
  - [ ] Active presentation instances never change.

**Exit Criteria**:

- [ ] **Unit tests**: revision tagging discards stale builds.
- [ ] **UI / E2E tests**: US-018 and US-019 pass in Chrome, Edge, Firefox, and Safari.
- [ ] **Performance**: preview p95 is at most 200 ms over 100 reference edits on the recorded reference machine.
- [ ] **Accessibility**: the editor passes a screen-reader smoke check with NVDA or VoiceOver.

#### Milestone M-002.3: Durable autosave and external-edit conflicts (G-04)

- **Problem solved**: browser and external edits can collide or fail silently and lose work.
- **Est. AI**: 02:55

##### FEAT-002.3.1: Durable autosave with visible status

Implements FR-008 and NFR-005 (Proposed threshold).

- **Est. AI**: 00:40
- **US-020** — **As an** author **I want** edits autosaved with a visible status **So that** I know my work is on disk (`Est. AI: 00:40`)
  - [ ] Eligible edits are persisted within 1 s after input settles.
  - [ ] "Saved" is shown only after persistence is confirmed. A detected failure is visible within 1 s.
  - [ ] Browser storage is never authoritative. Annotations never go into the source.

##### FEAT-002.3.2: External changes and conflict resolution

Implements FR-009 and FR-010.

- **Est. AI**: 01:15
- **US-021** — **As an** author **I want** changes made in an external editor to refresh the draft **So that** I can use my own editor (`Est. AI: 00:30`)
  - [ ] Non-conflicting external changes to the source or to referenced assets, data, or components reload the draft.
  - [ ] Watchers cover only authorized paths.
- **US-022** — **As an** author **I want** both versions kept when edits overlap **So that** neither version is lost (`Est. AI: 00:45`)
  - [ ] Autosave stops, and the editor and disk versions are both shown for an explicit decision.
  - [ ] Writes use content-hash preconditions, not timestamps, and there is no last-writer-wins. This data-loss safeguard is Proposed (FR-010).

##### FEAT-002.3.3: Durable-file feasibility gate (G-04)

Implements FR-086 and NFR-013.

- **Est. AI**: 00:45
- **US-023** — **As an** owner **I want** fault fixtures to prove save integrity **So that** acknowledged saves are never corrupted (`Est. AI: 00:45`)
  - [ ] The fixtures cover a race between hash check and replace, external atomic saves, a full disk, denied permission, a process crash, symlink/junction swaps, and interrupted rename.
  - [ ] Moving a complete deck directory keeps its master, theme, templates, fonts, motion, and components (FR-086).

**Exit Criteria**:

- [ ] **Unit tests**: conflict state machine and hash preconditions pass. Coverage on new code is at least 85%.
- [ ] **Integration tests**: every G-04 fixture passes on Windows, macOS, and Linux. Every acknowledged source and every displaced version is intact or explicitly recoverable (zero silent overwrites).
- [ ] **Performance**: the NFR-005 save and failure-visibility thresholds are met on the reference machine.
- [ ] **UI / E2E tests**: US-020..US-022 pass using a real external editor process.
- [ ] **Manual / UAT**: the owner accepts G-04's result, or accepts a native file adapter as a replacement.

### REQ-003: Recursive navigation and reveals (Must Have)

- **Outcome**: one canonical model drives Next/Previous, the directional arrows, the overview, continuous reading, the pages view, and export order.
- **Est. AI**: 05:05

#### Milestone M-003.1: Canonical tree and traversal model

- **Problem solved**: every surface needs the same order through nested slides and their reveals.
- **Est. AI**: 01:55

##### FEAT-003.1.1: Recursive tree model

Implements FR-017.

- **Est. AI**: 00:30
- **US-024** — **As a** presenter **I want** slides nested to any depth **So that** I can drill into detail (`Est. AI: 00:30`)
  - [ ] A pure model holds an ordered tree with parent, sibling, and child links, validated to at least 10 levels.
  - [ ] Hierarchical numbers (for example `1.1.2`) are derived from sibling positions.

##### FEAT-003.1.2: Next/Previous with reveals

Implements FR-020, FR-021, FR-027, and FR-050.

- **Est. AI**: 01:10
- **US-025** — **As a** presenter **I want** Next to step through reveals first and then move through nodes in depth-first preorder **So that** my narrative is linear and complete (`Est. AI: 00:40`)
  - [ ] On the navigation fixture (discovery §6, technical design §3.3), Next visits `1 → 1.1 → 1.1.1 → 1.1.2 → 1.2 → 2` without repeating an ancestor.
  - [ ] Previous is the exact inverse. It enters the preceding node at its final reveal and ignores jump history.
  - [ ] Traversal stops at the first and last states and never wraps.
- **US-026** — **As an** author **I want** to mark bullets, prose, equations, code, and diagrams as reveal groups **So that** I don't duplicate slides (`Est. AI: 00:30`)
  - [ ] Steps are contiguous positive integers starting at 1, and step 0 is the initial state. Groups that share a step appear together.
  - [ ] An ambiguous or invalid step is a compile error with its source location.

**Exit Criteria**:

- [ ] **Unit tests**: generated tree fixtures cover every Next/Previous transition, boundaries, and 10-plus levels. Coverage on `core/` navigation is 100% of branches.
- [ ] **Integration tests**: the navigation fixture order equals the order produced by the compiler's DeckIR.

#### Milestone M-003.2: Directional and jump navigation

- **Problem solved**: presenters need to skip detail branches and jump anywhere without losing their place.
- **Est. AI**: 02:25

##### FEAT-003.2.1: Alternating-axis directional controls

Implements FR-018, FR-022, and FR-023.

- **Est. AI**: 01:00
- **US-027** — **As a** presenter **I want** arrows that follow alternating axes by depth **So that** I can skip or enter branches (`Est. AI: 00:45`)
  - [ ] Roots move along the vertical axis, children along the horizontal axis, and so on alternately.
  - [ ] From `1.1.2`, Down goes to `1.2`. From `1.2`, Right goes to `2`. From `2`, Left goes to `1.2`. From `1.2`, Up goes to `1.1.2`.
  - [ ] Unavailable directions are disabled. Directional moves never wrap to a branch's first sibling and always enter step 0.
- **US-028** — **As a** presenter **I want** a parent/breadcrumb action **So that** I can leave a deep branch directly (`Est. AI: 00:15`)
  - [ ] It works from any sibling and enters the parent at step 0. This navigational safeguard is Proposed (FR-023).

##### FEAT-003.2.2: Progress indicator and quick-jump overview

Implements FR-019 and FR-024.

- **Est. AI**: 00:35
- **US-029** — **As a** presenter **I want** `1.1.2` and `4 / 100` shown with a button that opens an overview **So that** I know where I am and can jump anywhere (`Est. AI: 00:35`)
  - [ ] These show in private controls and in independent HTML navigation, never on the audience stage.
  - [ ] Reveal steps do not change the counts. Overview jumps enter step 0.

##### FEAT-003.2.3: Input ownership and gestures

Implements FR-025 and FR-026.

- **Est. AI**: 00:35
- **US-030** — **As a** presenter **I want** keyboard, mouse, and wheel/trackpad navigation that never fires by accident **So that** drawing or scrolling doesn't skip slides (`Est. AI: 00:35`)
  - [ ] Editors, text selection, pen gestures, scrollable content, and focused widgets take their events first.
  - [ ] Directional gestures have a threshold and a gesture boundary, so inertia cannot trigger repeated advances.

**Exit Criteria**:

- [ ] **Unit tests**: the axis table from technical design §3.3 is fully covered, including the forward-at-last-sibling exit and the backward-perpendicular entry into the end of the previous branch.
- [ ] **UI / E2E tests**: US-027..US-030 pass with keyboard, mouse, and simulated wheel inertia in Chrome and Firefox.
- [ ] **Performance**: p95 from input to transition start is at most 100 ms over 200 reference inputs.
- [ ] **Accessibility**: every navigation control has a keyboard equivalent and a visible focus indicator.

#### Milestone M-003.3: Continuous reading view

- **Problem solved**: readers want the same content as a scrollable document.
- **Est. AI**: 00:45

##### FEAT-003.3.1: Continuous reading view

Implements FR-028.

- **Est. AI**: 00:30
- **US-031** — **As a** reader **I want** each node shown once, fully revealed, in tree order **So that** I can read the deck like a document (`Est. AI: 00:30`)
  - [ ] Scrolling is ordinary document scrolling, and the section hierarchy stays identifiable.

**Exit Criteria**:

- [ ] **Unit tests**: continuous order equals the preorder node list.
- [ ] **UI / E2E tests**: US-031 passes. The view is readable at 320 CSS px and at 200% text zoom.

### REQ-004: Technical content rendering (Must Have)

- **Outcome**: code, equations, diagrams, charts, shapes, blocks, images, and media render offline in both viewing modes and in exports.
- **Est. AI**: 05:55

#### Milestone M-004.1: Code and equations

- **Problem solved**: technical talks need highlighted code and math.
- **Est. AI**: 01:05

##### FEAT-004.1.1: Syntax highlighting (Shiki)

Implements FR-029.

- **Est. AI**: 00:25
- **US-032** — **As an** author **I want** fenced code highlighted in previews, presentations, and rendered exports **So that** code is readable (`Est. AI: 00:25`)
  - [ ] Highlighting uses a declared language catalog that loads lazily.
  - [ ] An unknown language falls back to readable plain text with a diagnostic. Displaying code never executes it.

##### FEAT-004.1.2: KaTeX equations

Implements FR-030.

- **Est. AI**: 00:25
- **US-033** — **As an** author **I want** inline and block KaTeX equations **So that** I can show math (`Est. AI: 00:25`)
  - [ ] `trust: false` and bounded macro expansion are set.
  - [ ] An unsupported command gives a diagnostic that names it.

**Exit Criteria**:

- [ ] **Unit tests**: highlighting and equation fixtures (valid, unknown language, unsupported command) pass.
- [ ] **UI / E2E tests**: US-032 and US-033 render in the preview, presentation, and HTML export.

#### Milestone M-004.2: Diagrams and charts

- **Problem solved**: authors need diagrams and data visuals without external tools.
- **Est. AI**: 01:50

##### FEAT-004.2.1: Mermaid catalog

Implements FR-031.

- **Est. AI**: 00:30
- **US-034** — **As an** author **I want** flowchart, sequence, class, state, and entity-relationship diagrams **So that** I can explain systems (`Est. AI: 00:30`)
  - [ ] Strict security mode is set, and document directives cannot override it.
  - [ ] Settings are deterministic, and results are cached by source, master, and renderer version.

##### FEAT-004.2.2: ECharts catalog

Implements FR-032 and FR-033.

- **Est. AI**: 01:05
- **US-035** — **As an** author **I want** line, bar, area, scatter, pie, and donut charts **So that** I can present data (`Est. AI: 00:40`)
  - [ ] Charts show hover and selection details in HTML, and have a matching static SVG for exports.
  - [ ] Options are data-only. Formatter callbacks are allowed only inside the sandbox.
- **US-036** — **As an** author **I want** chart data given inline or from local CSV or JSON files **So that** no remote data service is needed (`Est. AI: 00:25`)
  - [ ] CSV is parsed with Papa Parse, with row and byte limits and explicit column types.

**Exit Criteria**:

- [ ] **Unit tests**: every catalog diagram and chart type renders from fixtures.
- [ ] **Integration tests**: CSV and JSON loading honors authorized paths and size limits.
- [ ] **Performance**: the reference deck (10 diagrams with up to 30 nodes each; 10 charts with up to 1,000 points each) stays within the NFR-002 preview budget.

#### Milestone M-004.3: Shapes, blocks, and insert catalog

- **Problem solved**: slides need composition blocks and simple shapes, and authors shouldn't have to memorize syntax.
- **Est. AI**: 01:50

##### FEAT-004.3.1: Shapes and blocks

Implements FR-034 and FR-035.

- **Est. AI**: 01:10
- **US-037** — **As an** author **I want** rectangles, circles, lines, arrows, and labels with configurable appearance **So that** I can annotate concepts in source (`Est. AI: 00:30`)
  - [ ] Shapes are native SVG primitives with no object-editor library. They are separate from live pen marks.
- **US-038** — **As an** author **I want** callout, column, timeline, metric, table, and image/caption blocks **So that** I can compose slides (`Est. AI: 00:40`)
  - [ ] Blocks use a documented directive syntax, semantic HTML, and CSS Grid, and each has an accessibility fixture.

##### FEAT-004.3.2: Insertable component examples

Implements FR-036.

- **Est. AI**: 00:25
- **US-039** — **As an** author **I want** a discoverable insert catalog **So that** I can add built-ins without looking up syntax (`Est. AI: 00:25`)
  - [ ] Every built-in has an example that inserts at the cursor as a valid directive.

**Exit Criteria**:

- [ ] **Unit tests**: each shape and block renders and passes its static-export fixture.
- [ ] **UI / E2E tests**: US-039 inserts each catalog item and the preview is valid.
- [ ] **Accessibility**: zero critical or serious axe violations across the block fixtures.

#### Milestone M-004.4: Local images and media

- **Problem solved**: decks reference local images and media that must resolve safely.
- **Est. AI**: 01:10

##### FEAT-004.4.1: Local image resolution

Implements FR-039.

- **Est. AI**: 00:25
- **US-040** — **As an** author **I want** raster images and safe SVGs resolved relative to my document **So that** my assets just work (`Est. AI: 00:25`)
  - [ ] Scriptable SVG, event attributes, and unapproved CSS URLs are rejected or sanitized.

##### FEAT-004.4.2: Local audio and video

Implements FR-040.

- **Est. AI**: 00:30
- **US-041** — **As a** presenter **I want** local audio and video to play in preview and presentation **So that** I can show demos (`Est. AI: 00:30`)
  - [ ] A rejected `play()`, an autoplay block, or a codec error shows a diagnostic and never a false "playing" state.
  - [ ] PDF uses a static fallback. Supported codecs are documented.

**Exit Criteria**:

- [ ] **Unit tests**: sanitizer fixtures (hostile SVG, event attributes, CSS URLs) pass.
- [ ] **UI / E2E tests**: US-040 and US-041 pass, including the blocked-autoplay and unsupported-codec cases.
- [ ] **Security**: zero high or critical findings from hostile-asset fixtures.

### REQ-005: Permissioned code, network, and file boundaries (Must Have)

- **Outcome**: document code runs only after the executing device's user permits it, and only inside an isolation boundary. Network access and file access are separate permissions. A failing block never takes down the document.
- **Est. AI**: 05:40

#### Milestone M-005.1: Isolation feasibility (G-03)

- **Problem solved**: nobody has yet proven that authored JS/React can run usefully without ambient host access.
- **Est. AI**: 01:00

##### FEAT-005.1.1: QuickJS-WASM and output-bridge prototype

This is the technical design's gate G-03.

- **Est. AI**: 00:45
- **US-042** — **As an** owner **I want** the reference demos running in the candidate sandbox **So that** the isolation approach is proven before we commit to it (`Est. AI: 00:45`)
  - [ ] The five reference demos and one reusable React island run through the guest renderer and DOM bridge. They exercise context, hooks, events, imports, fallback, and a state codec.
  - [ ] Blocked: denied module initializers, DOM escape, CSS/SVG requests, navigation, WebRTC egress, worker creation, CPU/memory exhaustion, and arbitrary file reads.
  - [ ] Recipient denial keeps packaged code inert offline. The design has no same-origin `eval` fallback.

**Exit Criteria**:

- [ ] **Integration tests**: every G-03 fixture passes in Chrome, Edge, Firefox, and Safari.
- [ ] **Security**: all escape attempts are blocked, with zero high or critical findings.
- [ ] **Manual / UAT**: the owner approves the supported API/import/fallback contract, or a changed boundary.

#### Milestone M-005.2: Code-execution permission and sandboxed islands

- **Problem solved**: authors want live demos without silently running untrusted code.
- **Est. AI**: 02:30

##### FEAT-005.2.1: Code-execution permission gate

Implements FR-082.

- **Est. AI**: 00:35
- **US-043** — **As a** presenter **I want** a built-in prompt before document code runs **So that** I decide what executes on my device (`Est. AI: 00:35`)
  - [ ] A grant is tied to the device session and the code-graph digest. It is never persisted in the source or in exports, and a changed graph needs new consent.
  - [ ] Passive Markdown and built-in controls need no prompt.
  - [ ] Denial keeps the code inactive and shows readable fallbacks. This covers preview, presentation, export, and executing lint.

##### FEAT-005.2.2: JavaScript and React islands

Implements FR-037 and FR-038.

- **Est. AI**: 01:15
- **US-044** — **As an** author **I want** simple JavaScript examples to run when I press Run **So that** I can demonstrate behavior (`Est. AI: 00:30`)
  - [ ] Code runs only after an explicit Run action. Visibility or idle policies never authorize execution.
- **US-045** — **As an** author **I want** my local React components to render once permitted **So that** I can reuse interactive widgets (`Est. AI: 00:45`)
  - [ ] State, effects, events, bounded timers, and local imports work in the sandbox.
  - [ ] Decks with no runnable React island ship no React bytes.

##### FEAT-005.2.3: Per-block failure isolation

Implements FR-085.

- **Est. AI**: 00:25
- **US-046** — **As an** author **I want** a failing block identified without losing the rest of the slide **So that** one bug doesn't break the talk (`Est. AI: 00:25`)
  - [ ] Runaway code is interrupted (Proposed limits: 64 MiB heap, 50 ms slice, calibrated in G-03) and only that block fails.

**Exit Criteria**:

- [ ] **Unit tests**: grant keying (digest change requires re-consent) and manifest-requirements-are-not-grants rules pass.
- [ ] **UI / E2E tests**: US-043..US-046 pass with permission both granted and denied.
- [ ] **Security**: no authored code runs before consent, even when trusted private UI hydrates. Verified by instrumented module-initializer fixtures.

#### Milestone M-005.3: Network and file boundaries

- **Problem solved**: code permission must not imply network or file access.
- **Est. AI**: 02:10

##### FEAT-005.3.1: Network permission and external embeds

Implements FR-041 and FR-083.

- **Est. AI**: 00:40
- **US-047** — **As a** presenter **I want** exact-origin network approval that is separate from code permission **So that** content contacts only the sites I allow (`Est. AI: 00:40`)
  - [ ] Redirect targets and resolved IPs are validated. Loopback, link-local, and private-control endpoints are denied, and credentials are never forwarded.
  - [ ] An embed that is unavailable or offline shows the common fallback. At least one real permitted embed passes end to end.

##### FEAT-005.3.2: File-access policy

Implements FR-084.

- **Est. AI**: 00:35
- **US-048** — **As an** owner **I want** app-mediated file access restricted to authorized locations **So that** a deck cannot read or overwrite arbitrary files (`Est. AI: 00:35`)
  - [ ] Symlink and junction targets are validated, and checks are repeated at each operation boundary.
  - [ ] No directory is served as a web root. The compiler, asset serving, backup, and export all share one policy.

##### FEAT-005.3.3: Security fixture suite

Implements NFR-012.

- **Est. AI**: 00:40
- **US-049** — **As an** owner **I want** adversarial fixtures run in CI **So that** permission boundaries stay enforced (`Est. AI: 00:40`)
  - [ ] Fixtures cover hostile MDX, HTML, SVG, and JSON (including closing-tag strings), SSRF through resources, and forged audience read/control/write attempts.
  - [ ] The local author, the LAN viewer, and the HTML recipient are each tested separately, including denial.

**Exit Criteria**:

- [ ] **Integration tests**: the redirect/IP validation, UNC-path denial, and symlink swap fixtures pass on all three OS families.
- [ ] **Security**: 100% of NFR-012 fixtures pass. The SAST and dependency scan has no high or critical findings.
- [ ] **Performance**: network capture shows zero unapproved non-loopback requests during a permission-denied run.

### REQ-006: Presentation master, themes, templates, and motion (Must Have)

- **Outcome**: deck-wide styling lives in a master that every slide inherits. Templates arrange content only. Motion is opt-in and can be paused, and reduced-motion preferences are respected.
- **Est. AI**: 04:40

#### Milestone M-006.1: Presentation master and themes

- **Problem solved**: styling a whole deck consistently without editing every slide.
- **Est. AI**: 01:45

##### FEAT-006.1.1: Master editor view

Implements FR-043, FR-044, FR-045, and FR-099.

- **Est. AI**: 00:45
- **US-050** — **As an** author **I want** to edit palette, heading/body/code fonts, sizes, background, logo, and footer in `/draft/:id/master` **So that** every draft slide, including descendants, updates at once (`Est. AI: 00:45`)
  - [ ] Edits become source-editor transactions on the front matter. There is no second write path.
  - [ ] Existing instances and their exports keep their captured master.
  - [ ] Math fonts are preserved. A missing font or an overflow gets a warning and is never silently clipped.

##### FEAT-006.1.2: 14 theme presets

Implements FR-042.

- **Est. AI**: 00:45
- **US-051** — **As an** author **I want** 14 selectable themes **So that** I can restyle a deck without rewriting content (`Est. AI: 00:45`)
  - [ ] Each preset differs from every other in palette or in heading/body font pairing.
  - [ ] Every text/background role pair meets WCAG 2.2 AA contrast.
  - [ ] (Proposed) Switching presets keeps explicit master overrides. A separate Reset action clears them.

**Exit Criteria**:

- [ ] **Unit tests**: master resolution (preset merged with sparse overrides) and contrast checks pass for all 14 presets.
- [ ] **UI / E2E tests**: a master edit updates every slide in a 5-level fixture. A running instance stays unchanged.
- [ ] **Accessibility**: automated contrast checks pass for all 14 themes, with zero serious violations.
- [ ] **Manual / UAT**: the owner signs off the 14-theme catalog (names and visuals).

#### Milestone M-006.2: Slide templates

- **Problem solved**: authors need per-slide layouts that do not fight the master.
- **Est. AI**: 01:15

##### FEAT-006.2.1: Four templates with named slots

Implements FR-046 and FR-100.

- **Est. AI**: 01:00
- **US-052** — **As an** author **I want** to pick title/content, two-column, three-column, or picture/text per slide **So that** I get a layout without rewriting content (`Est. AI: 00:40`)
  - [ ] `:::slot{name}` fills named slots. Unassigned content is grouped deterministically in source order.
  - [ ] Unused or unknown slots go to a visible continuation region with a diagnostic and are never dropped.
  - [ ] A layout change affects only that slide.
- **US-053** — **As an** author **I want** every template to inherit the master **So that** layouts never override shared styling (`Est. AI: 00:20`)
  - [ ] A template cannot redefine palette, fonts, background, or shared elements.

**Exit Criteria**:

- [ ] **Unit tests**: slot assignment, continuation-region, and inheritance fixtures pass for all four templates.
- [ ] **UI / E2E tests**: switching templates on a slide keeps every block, and the other slides are unchanged.
- [ ] **Accessibility**: each template has a defined reading order, and screen-reader order matches it.

#### Milestone M-006.3: Transitions, backdrops, and no-motion

- **Problem solved**: motion must add polish without hurting accessibility or export determinism.
- **Est. AI**: 01:40

##### FEAT-006.3.1: Five transition presets

Implements FR-047.

- **Est. AI**: 00:35
- **US-054** — **As an** author **I want** fade, directional slide, zoom, wipe, and flip transitions (a Proposed catalog) **So that** I can choose a motion style (`Est. AI: 00:35`)
  - [ ] Transitions use the Web Animations API with no motion library.
  - [ ] Hierarchy and order are unchanged. Instances keep their captured settings.

##### FEAT-006.3.2: Animated backdrops and no-motion

Implements FR-048 and FR-049.

- **Est. AI**: 00:50
- **US-055** — **As an** author **I want** opt-in animated backdrops **So that** a title slide can have ambience (`Est. AI: 00:30`)
  - [ ] Backdrops are off by default. They can be paused during playback, and each has a deterministic static frame for PDF and offline output.
- **US-056** — **As a** viewer **I want** my reduced-motion preference respected **So that** motion never harms me (`Est. AI: 00:20`)
  - [ ] Transitions, backdrops, and reveal effects are suppressed without changing content or order.

**Exit Criteria**:

- [ ] **Unit tests**: each of the five transitions and each shipped backdrop has a fixture, and the no-motion fixture is additional.
- [ ] **Performance**: at most 1% dropped frames at 60 Hz during the 60-second reference navigation, scrolling, and drawing run (NFR-004; the frame-drop definition is Proposed).
- [ ] **Accessibility**: with `prefers-reduced-motion` emulated, zero motion occurs and content is identical.

### REQ-007: Frozen presentation instances and presenter/audience surfaces (Must Have)
- **Outcome**: each presentation runs from an immutable captured version, and the private presenter surface is separate from a chrome-free audience stage.
- **Est. AI**: 03:40

#### Milestone M-007.1: Captured instance versions and launch gating
- **Problem solved**: editing during a talk must never change what the audience is seeing.
- **Est. AI**: 01:40

##### FEAT-007.1.1: Instance snapshot
Implements FR-097.
- **Est. AI**: 00:45
- **US-057** — **As a** presenter **I want** Present to capture the source, local assets/data/components, notes, master, and template assignments **So that** the running talk cannot drift (`Est. AI: 00:45`)
  - [ ] A browser-editor edit or external file change after launch leaves the instance and its exports byte-identical.
  - [ ] Showing the edits requires starting a new instance. Each instance keeps its own id, and one instance never retargets to another.

##### FEAT-007.1.2: Launch gating and "Present last valid version"
Implements FR-102.
- **Est. AI**: 00:40
- **US-058** — **As a** presenter **I want** launch blocked when the draft has errors or file conflicts, with an explicit fallback option **So that** I never present broken content by accident (`Est. AI: 00:40`)
  - [ ] Warnings alone do not block launch; errors are listed.
  - [ ] **Present last valid version** uses a retained coherent snapshot of the source and its dependencies, not just cached HTML. It also rechecks permissions and readiness, and preserves the current edits and conflicts.
  - [ ] The option is disabled when no usable snapshot exists.

**Exit Criteria**:
- [ ] **Unit tests**: snapshot digests stay stable across draft edits, and the conflict/error gating fixtures pass.
- [ ] **UI / E2E tests**: US-057 and US-058 pass. This includes editing a draft during a live instance and confirming the stage is unchanged.
- [ ] **Integration tests**: last-valid snapshot selection passes when a dependency changes on disk.

#### Milestone M-007.2: Presenter and audience surfaces
- **Problem solved**: the presenter needs private context, and the audience must see only the slide.
- **Est. AI**: 02:00

##### FEAT-007.2.1: Linked chrome-free audience stage
Implements FR-051 and FR-107.
- **Est. AI**: 00:35
- **US-059** — **As a** presenter **I want** a linked audience view separate from my presenter view **So that** I can project only the slide (`Est. AI: 00:35`)
  - [ ] The stage shows slide content plus deliberate public overlays (laser, blackout).
  - [ ] Library, card, page, editor, and presenter chrome never appear on the stage.
  - [ ] Local tabs/windows and LAN browsers are supported. The presenter controls projection and sharing.

##### FEAT-007.2.2: Private presenter view
Implements FR-052, FR-053, and FR-098.
- **Est. AI**: 00:50
- **US-060** — **As a** presenter **I want** per-slide notes and a synchronized preview of the selected instance **So that** I stay oriented privately (`Est. AI: 00:30`)
  - [ ] Notes appear only on the presenter surface. The selected instance determines the annotation, control, and export targets.
  - [ ] The preview and notes follow slide and reveal changes within one navigation step.
- **US-061** — **As a** presenter **I want** authoring edits and hot reload disabled on the presentation surface **So that** nothing mutates mid-talk (`Est. AI: 00:20`)
  - [ ] Navigation, prepared demos/media, and temporary annotations still work. A separate draft editor can continue editing.

##### FEAT-007.2.3: Shortcut help
Implements FR-059.
- **Est. AI**: 00:20
- **US-062** — **As a** presenter **I want** `?` and a visible control to open shortcut help **So that** I can recall keys under pressure (`Est. AI: 00:20`)
  - [ ] `?` inside a text input does not open help.
  - [ ] Help is keyboard-dismissible and restores focus.

**Exit Criteria**:
- [ ] **UI / E2E tests**: US-059..US-062 pass with the stage and presenter in separate windows.
- [ ] **Security**: the stage DOM and payloads contain zero notes, private comments, or chrome markers (automated scan).
- [ ] **Accessibility**: zero critical or serious axe violations on the presenter view and the help dialog.

### REQ-008: Live presentation tools, highlights, and comments (Must Have)
- **Outcome**: presenters can point, draw, blank, and highlight live. Marks sync to linked views, and private comments stay private.
- **Est. AI**: 03:45

#### Milestone M-008.1: Pointer, pen, canvas, and blackout
- **Problem solved**: presenters need to direct attention without editing content.
- **Est. AI**: 02:25

##### FEAT-008.1.1: Laser pointer and mark synchronization
Implements FR-054 and FR-055.
- **Est. AI**: 00:40
- **US-063** — **As a** presenter **I want** a transient laser pointer **So that** I can point without leaving marks (`Est. AI: 00:15`)
  - [ ] The laser never modifies authored content and is never saved.
- **US-064** — **As a** presenter **I want** deliberate audience-visible marks synced to local and LAN views **So that** everyone sees the same thing (`Est. AI: 00:25`)
  - [ ] Marks stay aligned across window sizes, using slide-relative coordinates.
  - [ ] Private comments are never transmitted.

##### FEAT-008.1.2: Freehand pen
Implements FR-056.
- **Est. AI**: 00:45
- **US-065** — **As a** presenter **I want** a pen with color, width, undo, erase, and clear **So that** I can annotate live (`Est. AI: 00:45`)
  - [ ] Works with a mouse. Stylus pressure is optional.
  - [ ] Undo and erase affect only the current instance and slide.

##### FEAT-008.1.3: Blank canvas and blackout
Implements FR-057 and FR-058.
- **Est. AI**: 00:45
- **US-066** — **As a** presenter **I want** to enter and leave a blank drawing canvas **So that** I can sketch without losing my place (`Est. AI: 00:25`)
  - [ ] Each canvas belongs to its instance and slide, and is kept separate from slide ink.
  - [ ] Saved canvases become labeled appendix pages, never authored slides.
- **US-067** — **As a** presenter **I want** blackout until I dismiss it **So that** I control audience attention (`Est. AI: 00:20`)
  - [ ] The navigation position and private presenter context are retained.

**Exit Criteria**:
- [ ] **Unit tests**: slide-relative mark normalization and the undo/erase stacks pass.
- [ ] **UI / E2E tests**: US-063..US-067 pass across a local stage and one LAN viewer.
- [ ] **Performance**: a pen stroke propagates to the linked local audience view at p95 ≤ 100 ms (NFR-006, Proposed threshold).

#### Milestone M-008.2: Text highlights and comments
- **Problem solved**: presenters want to emphasize text and attach notes without changing the source.
- **Est. AI**: 01:20

##### FEAT-008.2.1: Marker highlights
Implements FR-060.
- **Est. AI**: 00:35
- **US-068** — **As a** presenter **I want** marker-style highlights in draft preview and live instances **So that** I can emphasize text (`Est. AI: 00:35`)
  - [ ] Draft marks and each live instance are isolated from one another. Marks never transfer implicitly and never change the source.
  - [ ] After draft edits, unresolvable anchors are discarded rather than mis-marked.

##### FEAT-008.2.2: Highlight comments
Implements FR-061.
- **Est. AI**: 00:30
- **US-069** — **As a** presenter **I want** editable comments on highlights that are private by default **So that** my notes aren't shown accidentally (`Est. AI: 00:30`)
  - [ ] Showing a comment to the audience is a separate, deliberate action.

**Exit Criteria**:
- [ ] **Unit tests**: anchor resolution and discard-after-edit fixtures pass.
- [ ] **UI / E2E tests**: US-068 and US-069 pass. Stage and LAN payloads contain no private comment.
- [ ] **Accessibility**: highlight and comment controls are keyboard operable, with zero serious axe violations.

### REQ-009: Annotation lifetime and export transactions (Must Have)
- **Outcome**: unsaved annotations never outlive their owning session. Exports that involve annotations use an explicit Save, Clear, or Cancel transaction with honest per-output results.
- **Est. AI**: 04:35

#### Milestone M-009.1: Owner lifetime and session closure
- **Problem solved**: annotations must be discarded predictably, with no silent recovery and no premature loss.
- **Est. AI**: 01:55

##### FEAT-009.1.1: Owner-lifetime feasibility (G-05)
This is the technical design's gate G-05.
- **Est. AI**: 00:35
- **US-070** — **As an** owner **I want** owner close, reload, crash, sleep, and network loss proven against the owner-lease design **So that** the lifetime rules are reliable (`Est. AI: 00:35`)
  - [ ] The owner lease and reconnect window are Proposed. Owner-contact loss beyond the window counts as abrupt closure.
  - [ ] A viewer disconnect, or a transient owner disconnect inside the window, does not end the session.

##### FEAT-009.1.2: Session close and discard
Implements FR-062.
- **Est. AI**: 01:05
- **US-071** — **As a** presenter **I want** unsaved annotations discarded when my session closes **So that** nothing private persists without my action (`Est. AI: 00:35`)
  - [ ] Owner close, reload, end, or host exit discards annotations with no automatic backup or restore.
  - [ ] Unfinished annotation-dependent outputs are cancelled, including Clear's clean output. An independent raw backup may still complete.
- **US-072** — **As a** presenter **I want** Save-and-close to wait for success **So that** I don't lose marks on a failed save (`Est. AI: 00:30`)
  - [ ] Omitting private comments requires explicit discard consent.
  - [ ] If the save fails, the session stays open with its marks intact.

**Exit Criteria**:
- [ ] **Integration tests**: every G-05 fault fixture (close, reload, crash, sleep, network loss) yields its expected closure or keep-alive outcome.
- [ ] **UI / E2E tests**: US-071 and US-072 pass, including a save failure injected mid-close.
- [ ] **Manual / UAT**: the owner approves the reconnect-window value, or it stays labeled Proposed.

#### Milestone M-009.2: Annotation export transaction
- **Problem solved**: exporting an annotated session must neither lose nor leak marks.
- **Est. AI**: 02:40

##### FEAT-009.2.1: Save / Clear / Cancel decision
Implements FR-063.
- **Est. AI**: 01:00
- **US-073** — **As a** presenter **I want** to choose Save annotations, Clear annotations and export, or Cancel **So that** annotated exports are deliberate (`Est. AI: 00:35`)
  - [ ] Only the selected draft session or live instance is captured. The dialog lists the marks and comments that will be kept and omitted.
  - [ ] Saving ink with a source export needs a PDF/HTML companion, and a companion failure never blocks the raw backup.
  - [ ] Private comments require the private presenter HTML output.
- **US-074** — **As a** presenter **I want** Clear to remove only the unchanged captured marks, and only after a clean export succeeds **So that** newer marks survive (`Est. AI: 00:25`)
  - [ ] The Save or Clear decision request names its `decisionOutputId`. Each per-output receipt reports the output's ID, status, and assigned decision role. The clear gate removes marks only after the named output commits.
  - [ ] Cancel or failure keeps all marks.

##### FEAT-009.2.2: Captured export input
Implements FR-103.
- **Est. AI**: 00:30
- **US-075** — **As a** presenter **I want** each export job to capture one input version at request time **So that** later edits or playback cannot change the result (`Est. AI: 00:30`)
  - [ ] Rendered or converted draft jobs require valid, resolved input. Raw source export follows FR-064.
  - [ ] Committed files persist when the owner closes. Unfinished annotation-dependent outputs are cancelled.

##### FEAT-009.2.3: Step-aware annotation rendering
Implements FR-104.
- **Est. AI**: 00:55
- **US-076** — **As a** presenter **I want** saved marks to appear from their creation reveal step onward **So that** exports match what was shown (`Est. AI: 00:35`)
  - [ ] Final and continuous outputs show all surviving marks, with no stroke-history replay. Laser, blackout, and tool chrome are omitted.
  - [ ] Annotated dynamic content uses labeled static snapshots. Clean HTML keeps supported interaction.
- **US-077** — **As a** presenter **I want** saved canvases appended in canonical slide order **So that** sketches accompany the deck (`Est. AI: 00:20`)
  - [ ] Each appendix page is labeled with its source slide.

**Exit Criteria**:
- [ ] **Unit tests**: the transaction state machine (Save, Clear, Cancel, failure, receipts, clear gate) passes 100% of its branch fixtures.
- [ ] **Integration tests**: an edit made during an in-flight export does not appear in the output, and newer marks survive a Clear.
- [ ] **UI / E2E tests**: US-073..US-077 pass for PDF, public HTML, private HTML, and a source+companion export.

### REQ-010: Source, Markdown, HTML, and PDF exports (Must Have)
- **Outcome**: every agreed export format is produced faithfully and deterministically, with private content excluded from public artifacts and failures reported honestly.
- **Est. AI**: 07:10

#### Milestone M-010.1: Source and Markdown exports
- **Problem solved**: authors need a reliable backup and a portable text format, even when the draft is invalid.
- **Est. AI**: 01:25

##### FEAT-010.1.1: Exact source export
Implements FR-064.
- **Est. AI**: 00:35
- **US-078** — **As an** author **I want** the exact selected MDX/Markdown source exported even when it is invalid **So that** I always have a backup (`Est. AI: 00:35`)
  - [ ] Available authorized companions are included, and missing ones are reported without blocking the export.
  - [ ] No code executes. On a conflict I choose the editor or disk version, and neither is overwritten.
  - [ ] The output is labeled non-public when it contains notes or code.

##### FEAT-010.1.2: Markdown conversion
Implements FR-065.
- **Est. AI**: 00:35
- **US-079** — **As an** author **I want** a Markdown export that reports content it can't represent **So that** nothing is silently lost (`Est. AI: 00:35`)
  - [ ] JSX and executable expressions become supplied static representations or identified placeholders.
  - [ ] Notes become labeled sections, and the output is labeled not audience-safe.

**Exit Criteria**:
- [ ] **Unit tests**: exporting a malformed-source fixture gives a byte-identical backup. The Markdown placeholder report lists every MDX-only construct.
- [ ] **Integration tests**: the companion-missing and conflict-choice fixtures pass without overwriting any file.

#### Milestone M-010.2: Offline HTML bundles
- **Problem solved**: recipients need to view the deck offline without the authoring app.
- **Est. AI**: 01:55

##### FEAT-010.2.1: Interactive HTML bundle
Implements FR-066.
- **Est. AI**: 00:40
- **US-080** — **As a** recipient **I want** an offline interactive bundle that keeps tree navigation and reveals **So that** I can present or review it anywhere (`Est. AI: 00:40`)
  - [ ] Navigation and static content work without code permission. Authored code and network access are gated by the recipient's own consent.

##### FEAT-010.2.2: Continuous-reading HTML
Implements FR-067.
- **Est. AI**: 00:30
- **US-081** — **As a** reader **I want** a continuous document in canonical node order **So that** I can read the deck like an article (`Est. AI: 00:30`)
  - [ ] Each node appears exactly once, with all reveals visible.

##### FEAT-010.2.3: Self-contained assets
Implements FR-071.
- **Est. AI**: 00:30
- **US-082** — **As a** recipient **I want** every redistributable asset and font bundled **So that** nothing loads from a CDN (`Est. AI: 00:30`)
  - [ ] A required resource that can't be embedded blocks the export unless an explicit fallback is selected.

**Exit Criteria**:
- [ ] **UI / E2E tests**: US-080..US-082 pass when the bundle is opened offline in Chrome, Edge, Firefox, and Safari.
- [ ] **Performance**: with the network disabled, the bundle makes zero non-loopback requests.

#### Milestone M-010.3: Public-artifact privacy and private presenter HTML
- **Problem solved**: public artifacts must be verifiably free of private data, while presenters still get a private bundle.
- **Est. AI**: 01:20

##### FEAT-010.3.1: Public artifact scrubbing
Implements FR-073.
- **Est. AI**: 00:35
- **US-083** — **As a** presenter **I want** notes, private comments, and app chrome removed from every part of a public PDF/HTML **So that** sharing is safe (`Est. AI: 00:35`)
  - [ ] Removal covers embedded data, HTML comments, source maps, and companion files, not just the visual output.
  - [ ] Saved public annotation comments are allowed.

##### FEAT-010.3.2: Private presenter HTML
Implements FR-068.
- **Est. AI**: 00:30
- **US-084** — **As a** presenter **I want** a separately labeled private bundle with notes and presenter tools **So that** I can present offline (`Est. AI: 00:30`)
  - [ ] The bundle is labeled "not for distribution" in its filename and UI, and any local-server requirement is documented.

**Exit Criteria**:
- [ ] **Security**: a byte scan of every public artifact finds zero sentinel note or comment strings and zero source maps.
- [ ] **UI / E2E tests**: US-084 shows notes and tools from the private bundle.

#### Milestone M-010.4: PDF, static representations, and failure reporting (G-06)
- **Problem solved**: PDF output must be faithful and deterministic, and must fail loudly.
- **Est. AI**: 02:30

##### FEAT-010.4.1: Reveal-expanded PDF with fidelity gate
Implements FR-069, NFR-009, and NFR-018. This is the technical design's gate G-06.
- **Est. AI**: 01:05
- **US-085** — **As a** presenter **I want** a PDF with one page per canonical slide and reveal state **So that** handouts show every step (`Est. AI: 00:40`)
  - [ ] Order: the initial state and each reveal, then descendants and siblings in Next order. The reference workload produces 160 pages.
  - [ ] The PDF has no app chrome, and text and code stay selectable. Rendering uses an installed compatible Chromium browser.
- **US-086** — **As an** owner **I want** repeated exports to be identical **So that** output is trustworthy (`Est. AI: 00:25`)
  - [ ] Three exports of unchanged input match in node/reveal order, page count, annotations, and static content, ignoring timestamps.

##### FEAT-010.4.2: Static representations
Implements FR-072.
- **Est. AI**: 00:30
- **US-087** — **As an** author **I want** executable components, media, embeds, and motion to use defined static representations in PDF and offline fallbacks **So that** output is reliable without running code (`Est. AI: 00:30`)
  - [ ] Where automatic capture is unreliable, an author-supplied representation is required. Export never runs code without permission.

##### FEAT-010.4.3: Export failure reporting
Implements FR-074.
- **Est. AI**: 00:40
- **US-088** — **As a** presenter **I want** failures reported before any claim of completion **So that** I never trust a broken artifact (`Est. AI: 00:40`)
  - [ ] Format prerequisites are validated up front, for example a missing browser.
  - [ ] A source export and its annotation companion each report their own result.
  - [ ] Cancel or failure never clears marks or overwrites source.

**Exit Criteria**:
- [ ] **Integration tests**: the G-06 fixtures pass. Every built-in content type exports with correct order, and there is no clipping, blank capture, or missing resource.
- [ ] **Unit tests**: the NFR-018 triple-export comparison passes on the reference workload.
- [ ] **UI / E2E tests**: US-085..US-088 pass, with a missing-browser failure injected.
- [ ] **Manual / UAT**: the owner reviews the reference 160-page PDF.

### REQ-011: Deck linting in the editor and CI (Must Have)
- **Outcome**: authors get the same deterministic diagnostics in the editor and in a noninteractive CI command.
- **Est. AI**: 02:25

#### Milestone M-011.1: Static and rendered lint rules
- **Problem solved**: authors find broken or unreadable slides before they present.
- **Est. AI**: 01:35

##### FEAT-011.1.1: Static syntax and structure rules
Implements FR-076, FR-079, and FR-080.
- **Est. AI**: 00:40
- **US-089** — **As an** author **I want** malformed MDX, code fences, equations, diagrams, reveal markers, and hierarchy declarations reported **So that** I can fix them at the source (`Est. AI: 00:40`)
  - [ ] Each diagnostic shows the source line/column and the affected slide where possible.
  - [ ] Ambiguous reveal ordering, ambiguous parentage, and duplicate identities are reported as errors.

##### FEAT-011.1.2: Rendered-content rules
Implements FR-075, FR-077, and FR-078.
- **Est. AI**: 00:40
- **US-090** — **As an** author **I want** empty slides, dense or overflowing content, missing images or alt text, and unsuitable image dimensions reported **So that** my slides are readable (`Est. AI: 00:40`)
  - [ ] Intentionally blank, title, and reveal states are not flagged.
  - [ ] Density is a documented heuristic warning. Actual overflow is a separate diagnostic.
  - [ ] Remote-image checks never bypass network permission.

**Exit Criteria**:
- [ ] **Unit tests**: at least one positive and one negative fixture passes for every rule in FEAT-011.1.1 and FEAT-011.1.2.
- [ ] **UI / E2E tests**: the editor diagnostics panel shows US-089 and US-090 results, and each links to its source location.

#### Milestone M-011.2: Noninteractive CLI lint
- **Problem solved**: authors want lint to gate CI without opening the app.
- **Est. AI**: 00:50

##### FEAT-011.2.1: `slides lint` command
Implements FR-081.
- **Est. AI**: 00:35
- **US-091** — **As an** author **I want** a CLI lint that uses the editor's rules and exits nonzero on errors **So that** CI blocks broken decks (`Est. AI: 00:35`)
  - [ ] Exit codes: 0 = ok, 1 = content errors, 2 = I/O or prerequisite failure, 3 = permission-blocked. When several apply, precedence is 2 > 3 > 1.
  - [ ] Warnings are reported separately and alone exit 0.
  - [ ] Permission-dependent checks without prior authorization are reported as blocked and never prompt or hang.

**Exit Criteria**:
- [ ] **Integration tests**: CLI and editor diagnostics are identical on the lint fixture set, and every exit-code branch passes.
- [ ] **UI / E2E tests**: runs with stdin closed on all three OS families and completes with no prompt.

### REQ-012: Live LAN audience sharing (Must Have)
- **Outcome**: an explicitly shared presentation reaches LAN browsers as a faithful read-only public stage, with private data and controls unreachable.
- **Est. AI**: 07:00

#### Milestone M-012.1: Public stage delivery (G-02)
- **Problem solved**: every audience view must show exactly what the presenter's public stage shows.
- **Est. AI**: 02:00

##### FEAT-012.1.1: Live-output feasibility prototype
This is the technical design's gate G-02. Element Capture + WebRTC is the candidate, not settled.
- **Est. AI**: 00:45
- **US-092** — **As an** owner **I want** the capture/transport candidate proven on one stage, one local receiver, and two LAN devices **So that** live sharing is feasible before we build on it (`Est. AI: 00:45`)
  - [ ] Covers counter, random/time, asynchronous chart, hover, audio/video play/seek, transitions, ink/laser/canvas/blackout, reconnect, tiny text, no-motion, and accessible current state.
  - [ ] Private UI covering the capture source never leaks into frames or signaling. No unapproved egress occurs, and nothing is delivered before LAN consent.
  - [ ] A capture failure preserves the private stage and never sends divergent content.

##### FEAT-012.1.2: Public-state reproduction
Implements FR-093 and NFR-006.
- **Est. AI**: 01:00
- **US-093** — **As an** audience member **I want** the same layout, reveals, widget state, code results, media position, and marks as the presenter's stage **So that** I see the real talk (`Est. AI: 00:35`)
  - [ ] There is no per-viewer time, random, or data divergence, and no private notes or tool UI.
- **US-094** — **As a** presenter **I want** the local audience view to update fast **So that** the projector keeps up with me (`Est. AI: 00:25`)
  - [ ] Navigation and mark propagation to the same-machine receiver is p95 ≤ 100 ms (Proposed threshold) through the actual capture path.

**Exit Criteria**:
- [ ] **Integration tests**: every G-02 fixture passes, and packet/frame inspection shows no private content.
- [ ] **Performance**: NFR-006 p95 ≤ 100 ms (Proposed threshold) measured over 200 navigation and mark events.
- [ ] **Manual / UAT**: the owner accepts the transport choice, or directs an architecture change per the design's G-02 fallback.

#### Milestone M-012.2: Port range and audience URLs
- **Problem solved**: presenters need a predictable, working URL for viewers without port collisions.
- **Est. AI**: 01:35

##### FEAT-012.2.1: Configurable port range and binding
Implements FR-087, FR-088, and FR-089.
- **Est. AI**: 00:45
- **US-095** — **As a** presenter **I want** Start sharing to bind a free port from my configured range **So that** each instance gets its own audience port (`Est. AI: 00:25`)
  - [ ] The range must be legal, ordered, and nonempty (Proposed default: 50000–50100). The private port (Proposed default: 7890) and occupied ports are excluded.
  - [ ] Bind collisions are retried within the range. Local-only presentation binds no audience port.
- **US-096** — **As a** presenter **I want** a clear error when the range is exhausted **So that** I can adjust it (`Est. AI: 00:20`)
  - [ ] No other process is terminated, no port outside the range is used, and existing presentations continue.

##### FEAT-012.2.2: Copyable audience URLs
Implements FR-091.
- **Est. AI**: 00:35
- **US-097** — **As a** presenter **I want** copyable URLs for each usable LAN address and the actual bound port **So that** viewers can join (`Est. AI: 00:35`)
  - [ ] URLs appear in the presenter surface and the launcher output, labeled by interface.
  - [ ] IPv4 is supported, and IPv6 is shown in brackets when offered. Loopback and wildcard addresses are never advertised as remote URLs.

**Exit Criteria**:
- [ ] **Unit tests**: range validation, the collision-retry loop, and URL formatting fixtures (including IPv6 brackets) pass.
- [ ] **Integration tests**: occupied-port, exhausted-range, and two-concurrent-instance fixtures pass.

#### Milestone M-012.3: Public listener isolation
- **Problem solved**: LAN viewers must never reach private authoring data or controls.
- **Est. AI**: 01:30

##### FEAT-012.3.1: Read-only public output
Implements FR-090.
- **Est. AI**: 00:35
- **US-098** — **As a** presenter **I want** only the selected version's read-only public output served on approved interfaces **So that** viewers can only watch (`Est. AI: 00:35`)
  - [ ] Viewers cannot navigate independently, change widgets, or control playback. No install is required.
  - [ ] Host permission never grants code execution on a viewer's device.

##### FEAT-012.3.2: Private-capability denial
Implements FR-092.
- **Est. AI**: 00:40
- **US-099** — **As a** presenter **I want** editor, library, source, notes, comments, and write/control routes denied to LAN clients **So that** a separate port isn't my only protection (`Est. AI: 00:40`)
  - [ ] The public listener exposes no private routes. Delivered assets and diagnostics contain no private data.

**Exit Criteria**:
- [ ] **Security**: forged LAN read, control, and write requests against every private route are denied (100% of fixtures).
- [ ] **Security**: a byte scan of public payloads finds zero sentinel strings.

#### Milestone M-012.4: Join, stop, preflight, and LAN verification
- **Problem solved**: sharing must start, recover, and stop cleanly, and must refuse content it can't share faithfully.
- **Est. AI**: 01:55

##### FEAT-012.4.1: Join and reconnect
Implements FR-094.
- **Est. AI**: 00:25
- **US-100** — **As an** audience member **I want** to join or reconnect into the current public state **So that** I'm not sent back to slide 1 (`Est. AI: 00:25`)
  - [ ] The join state includes widget, code, media, and annotation state. Disconnection is shown while resyncing.

##### FEAT-012.4.2: Stop sharing
Implements FR-095.
- **Est. AI**: 00:20
- **US-101** — **As a** presenter **I want** stopping sharing to release the port **So that** resources are freed (`Est. AI: 00:20`)
  - [ ] Stop sharing keeps the local instance and its marks. Ending the instance closes all its views and discards unsaved marks.

##### FEAT-012.4.3: Sharing preflight and guidance
Implements FR-101 and FR-096.
- **Est. AI**: 00:30
- **US-102** — **As a** presenter **I want** content that can't be shared faithfully identified before delivery **So that** viewers are never silently downgraded (`Est. AI: 00:20`)
  - [ ] Delivery is blocked, or a presenter-approved fallback applies identically to the host and public views.
- **US-103** — **As a** presenter **I want** actionable guidance when LAN sharing is unavailable **So that** I can fix interface or firewall issues (`Est. AI: 00:10`)
  - [ ] The app never claims remote reachability and never changes network security settings.

##### FEAT-012.4.4: LAN verification suite
Implements NFR-019 and NFR-020.
- **Est. AI**: 00:25
- **US-104** — **As an** owner **I want** the published-URL, follow, late-join, reconnect, and stop fixtures run with two LAN devices per host OS **So that** parity is proven (`Est. AI: 00:25`)
  - [ ] Public content, layout, and settled state agree 100% across presenter, local, and LAN views.
  - [ ] Two LAN client devices per host OS is the Proposed minimum coverage, not an audience limit.

**Exit Criteria**:
- [ ] **Integration tests**: every NFR-019 fixture passes on Windows, macOS, and Linux hosts.
- [ ] **UI / E2E tests**: US-100..US-103 pass. After a stop, the audience port is released within 1 s.
- [ ] **Manual / UAT**: the owner signs off the parity demo using the reference deck.

### REQ-013: Packaging, performance, privacy, and accessibility (Must Have)
- **Outcome**: a single runtime-free executable per OS meets the agreed startup, latency, motion, offline-privacy, accessibility, and display targets.
- **Est. AI**: 05:35

#### Milestone M-013.1: Single-executable packaging (G-01) and portability
- **Problem solved**: users must run the app on any supported OS without installing a language runtime.
- **Est. AI**: 01:40

##### FEAT-013.1.1: Packaging feasibility prototype
This is the technical design's gate G-01.
- **Est. AI**: 00:45
- **US-105** — **As an** owner **I want** the Bun executable to embed the prebuilt Astro shells and the full runtime graph **So that** one file runs offline (`Est. AI: 00:45`)
  - [ ] The graph covers MDX, SQLite, watcher, WASM, fonts, the island loader, and puppeteer-core.
  - [ ] Open, edit, lint, and export work from a Unicode path containing spaces on clean machines.
  - [ ] No Astro SSR or Vite process runs. A plain public deck contains no React bytes.
  - [ ] The library checks from technical design §10.1 G-01 pass on the packaged executable. Decks created in the default and in an external location both show cover cards and the pages view after a restart. The checks also cover an unavailable default root, unopened-deck pagination, overlapping grants, missing or relinked source, and runtime-ID deep links.
  - [ ] Opening a file resolves references beneath its deck folder but never indexes sibling decks or reads outside the folder. A deck removed from the library leaves its files intact and stays excluded across restart until it is reopened explicitly. Thumbnails run no code and make no external requests.
  - [ ] The plain public deck's compressed application JS/CSS is measured against the Proposed NFR-008 budget of 1 MiB. Download size, unpacked size, and startup time are recorded.

##### FEAT-013.1.2: Cross-OS acceptance journeys
Implements NFR-015.
- **Est. AI**: 00:40
- **US-106** — **As a** user **I want** launch, edit, local/LAN present, lint, PDF, and offline HTML to work on Windows, macOS, and Linux **So that** I can use any machine (`Est. AI: 00:40`)
  - [ ] Interface discovery, firewall, and browser prerequisites are declared in the support matrix.

**Exit Criteria**:
- [ ] **Integration tests**: every G-01 check passes on clean VMs for all three OS families.
- [ ] **UI / E2E tests**: the NFR-015 journeys pass on the declared matrix.
- [ ] **Manual / UAT**: the owner accepts Bun, or the design's Node SEA comparison is run.

#### Milestone M-013.2: Performance targets
- **Problem solved**: the app must feel instant on the reference workload.
- **Est. AI**: 01:40

##### FEAT-013.2.1: Startup and preview latency
Implements NFR-001.
Related: US-108 re-measures REQ-002's preview-latency target on packaged builds.
- **Est. AI**: 00:45
- **US-107** — **As an** author **I want** cold launch to reach a usable slide in p95 ≤ 3 s **So that** I can start quickly (`Est. AI: 00:25`)
  - [ ] Measured when launching with the reference document path.
- **US-108** — **As an** author **I want** a valid preview within p95 ≤ 200 ms of an edit **So that** feedback is immediate (`Est. AI: 00:20`)
  - [ ] Measured across the reference text, equation, chart, and diagram edits.

##### FEAT-013.2.2: Navigation latency and motion smoothness
Implements NFR-003 and NFR-004.
- **Est. AI**: 00:40
- **US-109** — **As a** presenter **I want** a transition to start within p95 ≤ 100 ms of input **So that** navigation feels responsive (`Est. AI: 00:20`)
  - [ ] Input latency is measured separately from the intentional transition duration.
- **US-110** — **As a** viewer **I want** smooth 60 fps motion **So that** transitions and drawing don't stutter (`Est. AI: 00:20`)
  - [ ] At most 1% dropped frames at 60 Hz across the 60-s reference navigation, scrolling, and drawing run (Proposed operational definition).

**Exit Criteria**:
- [ ] **Performance**: NFR-001..NFR-004 met on the recorded reference machine for all three OS families, using the discovery §4 sample plan: at least 20 cold launches, 100 preview edits, 200 navigation inputs, and one 60-second motion/drawing trace. The NFR-004 frame-drop definition is Proposed.

#### Milestone M-013.3: Offline privacy
- **Problem solved**: users need proof that nothing leaves the machine without approval.
- **Est. AI**: 00:50

##### FEAT-013.3.1: Egress audit
Implements NFR-011.
- **Est. AI**: 00:35
- **US-111** — **As a** user **I want** zero unapproved non-loopback requests during local authoring, presentation, and offline export **So that** my content stays private (`Est. AI: 00:35`)
  - [ ] The app has no telemetry, analytics, or implicit runtime downloads. Explicit LAN sharing permits only its scoped audience traffic.

**Exit Criteria**:
- [ ] **Security**: a network capture during the full local journey records zero unapproved requests.

#### Milestone M-013.4: Accessibility and display support
- **Problem solved**: the app and its exports must be usable with assistive technology and at common viewport sizes.
- **Est. AI**: 01:25

##### FEAT-013.4.1: WCAG 2.2 AA conformance
Implements NFR-014.
- **Est. AI**: 00:40
- **US-112** — **As a** keyboard or screen-reader user **I want** complete keyboard journeys and AA contrast **So that** I can author and present (`Est. AI: 00:40`)
  - [ ] Automated fixtures report no critical or serious findings, focus is visible, and manual assistive-technology checks are recorded.

##### FEAT-013.4.2: Viewport and zoom support
Implements NFR-016.
- **Est. AI**: 00:30
- **US-113** — **As a** user **I want** no control overlap at 1280×720 and 1920×1080, and readable continuous HTML at 320 px and 200% zoom **So that** the app works on any display (`Est. AI: 00:30`)
  - [ ] Two-dimensional diagrams and tables keep accessible navigation instead of destructive reflow.
  - [ ] The listed viewport sizes are Proposed verification sizes.

**Exit Criteria**:
- [ ] **Accessibility**: zero critical or serious axe violations across all app pages and the reference HTML. Manual NVDA and VoiceOver passes are recorded.
- [ ] **UI / E2E tests**: US-113 visual checks pass at every listed viewport and zoom level.

### REQ-014: PDF final-state mode, linked TOC, and throughput (Should Have)
- **Outcome**: presenters can produce shorter handouts and navigable PDFs, and long decks export within a bounded time.
- **Est. AI**: 02:20

#### Milestone M-014.1: Final-state-only PDF
- **Problem solved**: handouts don't need every reveal step.
- **Est. AI**: 00:45

##### FEAT-014.1.1: Final-state export option
Implements FR-070.
- **Est. AI**: 00:30
- **US-114** — **As a** presenter **I want** a final-state-only PDF option **So that** handouts show one page per slide (`Est. AI: 00:30`)
  - [ ] The default stays every reveal step. With the option on, the reference workload yields 100 pages. The option itself is a Proposed convenience (FR-070).

**Exit Criteria**:
- [ ] **Integration tests**: page counts are 160 (default) and 100 (final-only) on the reference workload, and repeated runs are deterministic.

#### Milestone M-014.2: Linked PDF table of contents
- **Problem solved**: long PDFs are hard to navigate.
- **Est. AI**: 00:50

##### FEAT-014.2.1: Optional TOC
Implements FR-108.
- **Est. AI**: 00:35
- **US-115** — **As a** presenter **I want** an optional numbered, hierarchical, linked TOC **So that** readers can jump to any slide (`Est. AI: 00:35`)
  - [ ] The TOC is off by default. When on, its pages precede the deck and each entry links to its slide's first emitted page, in either reveal mode.
  - [ ] If the renderer can't produce a TOC, the app says so. A requested TOC never silently produces a TOC-free export.

**Exit Criteria**:
- [ ] **Integration tests**: every TOC link resolves to the correct page in both modes. The unsupported-capability fixture fails loudly.

#### Milestone M-014.3: PDF throughput
- **Problem solved**: long exports must finish in reasonable time and stay cancellable.
- **Est. AI**: 00:45

##### FEAT-014.3.1: Throughput and cancellation
Implements NFR-010.
- **Est. AI**: 00:30
- **US-116** — **As a** presenter **I want** the 160-page reference PDF in ≤ 60 s **So that** export doesn't stall my prep (`Est. AI: 00:30`)
  - [ ] Cancel and error reporting stay available throughout. Browser install time is excluded. The 60 s target is Proposed (NFR-010).

**Exit Criteria**:
- [ ] **Performance**: the 160-page export takes ≤ 60 s (Proposed target) on the recorded reference machine (median of 3 runs). Cancel stops it within 2 s.

### REQ-015: Lightweight footprint and reusable components (Should Have)
- **Outcome**: the download and exported-deck overhead stay within budget, and one local React component is proven reusable.
- **Est. AI**: 01:50

#### Milestone M-015.1: Size budgets
- **Problem solved**: users expect a lightweight tool and lightweight exports.
- **Est. AI**: 00:55

##### FEAT-015.1.1: Distribution and plain-deck budgets
Implements NFR-007 and NFR-008.
- **Est. AI**: 00:40
- **US-117** — **As a** user **I want** a compressed download of ≤ 100 MiB per platform **So that** installation is quick (`Est. AI: 00:20`)
  - [ ] The unpacked size is disclosed too. This is a Proposed budget.
- **US-118** — **As a** recipient **I want** a text-only exported deck to carry ≤ 1 MiB of compressed app JS/CSS **So that** it opens fast (`Est. AI: 00:20`)
  - [ ] Fonts and authored assets are excluded. Editor and library code are absent.

**Exit Criteria**:
- [ ] **Performance**: CI size checks fail the build if either Proposed budget is exceeded on any platform.

#### Milestone M-015.2: Reusable local React component
- **Problem solved**: authors want to write a widget once and reuse it.
- **Est. AI**: 00:55

##### FEAT-015.2.1: Two-deck reuse demonstration
Implements NFR-017.
- **Est. AI**: 00:40
- **US-119** — **As an** author **I want** one local React component used in two decks **So that** I don't duplicate widgets (`Est. AI: 00:40`)
  - [ ] Navigation and export orchestration need no changes, and the static fallback works in PDF and denied-permission HTML. This is a Proposed maintainability check (NFR-017).

**Exit Criteria**:
- [ ] **Integration tests**: both decks preview, present, and export with the shared component, including its static fallback.

### REQ-016: Presenter timer and next-slide preview (Should Have)
- **Outcome**: presenters can pace the talk from the private surface.
- **Est. AI**: 01:05

#### Milestone M-016.1: Pacing aids
- **Problem solved**: presenters lose track of time and of what comes next.
- **Est. AI**: 01:05

##### FEAT-016.1.1: Elapsed timer
No FR yet (discovery §11 suggestion).
- **Est. AI**: 00:25
- **US-120** — **As a** presenter **I want** an elapsed timer with pause and reset **So that** I can pace myself (`Est. AI: 00:25`)
  - [ ] The timer is shown only on the presenter surface and never on the stage or in exports.

##### FEAT-016.1.2: Next-slide preview
No FR yet (discovery §11 suggestion).
- **Est. AI**: 00:25
- **US-121** — **As a** presenter **I want** a preview of the next slide or reveal state **So that** transitions are smooth (`Est. AI: 00:25`)
  - [ ] The preview follows canonical Next order. The previewed content runs no code.

**Exit Criteria**:
- [ ] **UI / E2E tests**: US-120 and US-121 pass. A scan of the stage DOM finds no timer or preview.

### REQ-017: Statistical chart types (Could Have)
- **Outcome**: scientific decks can show distributions and matrices natively.
- **Est. AI**: 00:55

#### Milestone M-017.1: Histogram, box plot, and heatmap
- **Problem solved**: authors currently need external tools for common statistical charts.
- **Est. AI**: 00:55

##### FEAT-017.1.1: Three additional chart types
No FR yet (discovery §11 suggestion).
- **Est. AI**: 00:40
- **US-122** — **As an** author **I want** histogram, box plot, and heatmap charts from local data **So that** I can present distributions (`Est. AI: 00:40`)
  - [ ] Each chart type has an accessible data-table fallback and a deterministic static PDF representation.

**Exit Criteria**:
- [ ] **Unit tests**: render and export fixtures pass for all three types, and the static output is byte-identical across 3 runs.

### REQ-018: In-place text editing in the draft preview (Should Have)
- **Outcome**: authors can fix plain wording directly on the rendered slide, and the MDX source stays the only authority.
- **Est. AI**: 01:50

#### Milestone M-018.1: Preview text editing
- **Problem solved**: small wording fixes force the author to hunt for the matching source line.
- **Est. AI**: 01:50

##### FEAT-018.1.1: Plain-text editing with source write-back
Implements FR-109.
- **Est. AI**: 00:45
- **US-123** — **As an** author **I want** to edit plain-text headings, paragraphs, quotes, and list items directly in the draft preview **So that** I can fix wording where I see it (`Est. AI: 00:45`)
  - [ ] Typing in an eligible block rewrites only that block's source range and keeps its leading Markdown prefix (heading marks, list marker, or quote marker). After autosave, the editor, preview, and file agree.
  - [ ] Newly typed Markdown or directive syntax (such as `**`, `[`, `$`, or a leading `#` or `:::`) is escaped, so it stays literal text.
  - [ ] Each edit is a normal source edit: undo/redo restores both source and preview, and autosave, conflict handling, and hot reload apply unchanged.

##### FEAT-018.1.2: Eligibility and edit safety
Implements FR-109.
- **Est. AI**: 00:50
- **US-124** — **As an** author **I want** code, diagrams, charts, media, components, and richly formatted text to open at their source instead of being edited in the preview **So that** preview edits never corrupt markup (`Est. AI: 00:25`)
  - [ ] Blocks with inline formatting, links, math, JSX, or expressions, and all code, diagram, chart, image, media, and component blocks, are not editable in the preview. Selecting one moves the source caret to that block.
  - [ ] A round-trip fixture edits every eligible block and confirms all other source bytes are unchanged.
- **US-125** — **As an** author **I want** preview editing disabled whenever the preview may not match the source **So that** an edit never lands on the wrong line (`Est. AI: 00:25`)
  - [ ] The preview is read-only while it is stale or invalid (FR-016), during an unresolved conflict (FR-010), or while its revision lags the editor. The preview says why.
  - [ ] Presenter, audience, LAN, and export outputs contain no editable markup and no source ranges.

**Exit Criteria**:
- [ ] **Unit tests**: eligibility classification and source-range write-back pass for every block type in the reference fixture, including prefix preservation and escaping.
- [ ] **UI / E2E tests**: US-123 to US-125 pass in Chrome, Edge, Firefox, and Safari, including undo/redo, autosave, and a conflict raised mid-edit.
- [ ] **Security**: a DOM scan of the stage, LAN view, and exports finds no `contenteditable` elements or source-range attributes.
- [ ] **Accessibility**: editable blocks are keyboard-reachable and announced as editable. Non-editable blocks announce that they open in source.

## 6. User Experience

### Entry Points, Core Experience, Edge Cases

| Step | Action | System Response | Success State |
|------|--------|-----------------|---------------|
| 1 | Run the executable, with or without a deck path | Starts the private loopback host (Proposed port 7890) and opens the browser | The library appears, or the deck's first slide within p95 ≤ 3 s |
| 2 | Create or open a deck in `/library` | Shows cover cards across authorized roots | The deck opens in `/draft/:id` |
| 3 | Edit the MDX source, or plain-text blocks directly in the preview (FR-109) | Autosaves; preview repaints within p95 ≤ 200 ms | The save status reads "Saved" and diagnostics are current |
| 4 | Adjust the master in `/draft/:id/master` | Every draft slide restyles | The instance is unaffected until the next Present |
| 5 | Press Present | Validates, captures a frozen instance, and opens `/present/:instanceId` plus `/audience/:instanceId` | The stage shows only slide content, and notes stay private |
| 6 | Start LAN sharing | Runs preflight, binds a port in the range (Proposed 50000–50100), and lists URLs | LAN browsers show the same public stage |
| 7 | Annotate: laser, pen, canvas, blackout, highlights | Syncs public marks; comments stay private | Views agree (NFR-020) |
| 8 | Export | Offers the Save / Clear / Cancel decision if marks exist, then captures the input | Per-output receipts; public artifacts are free of private data |
| 9 | End the instance | Closes views, releases the port, and discards unsaved marks | The draft editor is untouched |

Edge cases:
- Invalid draft or unresolved conflict at Present → launch blocked; **Present last valid version** is offered.
- External edit during editing → conflict UI; neither version is overwritten.
- Stale, invalid, or conflicted preview → preview text editing is disabled until the preview matches the source.
- Code permission denied → readable fallbacks everywhere.
- Port range exhausted, or LAN unavailable → actionable error; the local presentation continues.
- Owner tab loss → handled per the owner lease (Proposed reconnect window).
- Export failure → nothing is cleared or claimed.

### Pages & Screens

These come from the technical design's §7.1 route map.
- `/library` — cover-card gallery with new/open/duplicate/rename/delete.
- `/draft/:id/pages` — hierarchical thumbnail grid.
- `/draft/:id` — source editor plus preview, outline, insert catalog, and diagnostics.
- `/draft/:id/master` — master editor with whole-deck preview.
- `/present/:instanceId` — public stage with private notes and tools.
- `/audience/:instanceId` — receive-only local projector view.
- LAN `http://<ip>:<port>/` — public receive-only view.
- Standalone export root — interactive, continuous, or private presenter HTML.

Visual references are in `docs/mockups/`.

## 7. Technical Considerations

The authoritative design is `docs/plans/2026-09-22_slides_technical-design.md`; this PRD does not duplicate it.
- **Stack**: a Bun single executable serves prebuilt Astro static shells with TypeScript islands and an optional, permissioned React adapter. There is no SSR/Vite process at runtime.
- **Integration points**:
  - an installed compatible Chromium through puppeteer-core, for PDF;
  - an OS file watcher;
  - SQLite for library metadata only (the source files are canonical);
  - QuickJS-WASM with Remote DOM for authored code;
  - Element Capture + WebRTC as the live-output candidate.
- **Data & privacy**:
  - Everything stays local, with no telemetry.
  - Grants last only for the draft session or presentation instance (Proposed lifetime, discovery §12). They are never persisted and never exported.
  - Public artifacts and the LAN listener are built from public-only data.
- **Feasibility gates**: G-01 through G-06 must pass before implementation is committed. Their milestones are front-loaded in §9: M-013.1, M-002.3, M-005.1, M-012.1, M-009.1, and M-010.4. Each gate has a documented fallback in the technical design's §10.1.
- **Challenges**:
  - capture-path latency and privacy;
  - sandboxed React compatibility;
  - crash-safe atomic saves on three operating systems;
  - deterministic PDF capture of dynamic content.
- **Proposed values** stay Proposed until owner approval: ports, sandbox limits (64 MiB, 50 ms), reconnect window, handoff lifetime (60 s), grant lifetime, transitions catalog, size budgets (NFR-007, NFR-008), and the NFR-004 frame-drop definition, NFR-005/006/010 thresholds, NFR-016 viewport sizes, and NFR-019 minimum LAN coverage.

## 8. Success Metrics

| Metric | Target | How measured |
|--------|--------|--------------|
| Startup | p95 ≤ 3 s | NFR-001 harness on the reference machine |
| Preview latency | p95 ≤ 200 ms | NFR-002 reference edit set |
| Navigation latency | p95 ≤ 100 ms | NFR-003 reference sequence |
| Motion smoothness | ≤ 1% dropped frames at 60 Hz (Proposed definition) | NFR-004 60-s trace |
| Local sync | p95 ≤ 100 ms (Proposed) | NFR-006 through the capture path |
| Live parity | 100% agreement | NFR-020 fixtures on local and LAN views |
| Offline privacy | 0 unapproved requests | NFR-011 network capture |
| Permission boundary | 100% of fixtures pass | NFR-012 suite |
| Data integrity | 0 silent overwrites | NFR-013 crash, conflict, and full-disk fixtures |
| Export determinism | 3 identical runs | NFR-018 |
| Accessibility | 0 critical/serious findings, plus manual AT pass | NFR-014 |
| Portability | All journeys pass on Windows, macOS, and Linux | NFR-015 |
| Owner adoption | The owner delivers a real talk end to end, including LAN sharing and a PDF | Manual / UAT |

## 9. Delivery Sequence

Gate-bearing milestones come first. A gate failure triggers the technical design's fallback before any dependent milestone starts.

| Order | Milestone | Requirement | Priority | Est. AI | Depends on | Exit criteria met |
|-------|-----------|-------------|----------|---------|------------|-------------------|
| 1 | M-001.1 Executable launches a private loopback host | REQ-001 | Must | 02:15 | — | [ ] |
| 2 | M-013.1 Single-executable packaging (G-01) and portability | REQ-013 | Must | 01:40 | M-001.1 | [ ] |
| 3 | M-002.1 MDX deck compiler and source contract | REQ-002 | Must | 02:00 | M-001.1 | [ ] |
| 4 | M-003.1 Canonical tree and traversal model | REQ-003 | Must | 01:55 | M-002.1 | [ ] |
| 5 | M-002.2 Browser editor with hot-reload preview | REQ-002 | Must | 01:35 | M-002.1 | [ ] |
| 6 | M-002.3 Durable autosave and external-edit conflicts (G-04) | REQ-002 | Must | 02:55 | M-002.2 | [ ] |
| 7 | M-005.1 Isolation feasibility (G-03) | REQ-005 | Must | 01:00 | M-002.1 | [ ] |
| 8 | M-007.1 Captured instance versions and launch gating | REQ-007 | Must | 01:40 | M-002.3, M-003.1 | [ ] |
| 9 | M-007.2 Presenter and audience surfaces | REQ-007 | Must | 02:00 | M-007.1 | [ ] |
| 10 | M-012.1 Public stage delivery (G-02) | REQ-012 | Must | 02:00 | M-007.2 | [ ] |
| 11 | M-009.1 Owner lifetime and session closure | REQ-009 | Must | 01:55 | M-007.2 | [ ] |
| 12 | M-010.4 PDF, static representations, and failure reporting (G-06) | REQ-010 | Must | 02:30 | M-003.1, M-007.1 | [ ] |
| 13 | M-003.2 Directional and jump navigation | REQ-003 | Must | 02:25 | M-003.1 | [ ] |
| 14 | M-003.3 Continuous reading view | REQ-003 | Must | 00:45 | M-003.1 | [ ] |
| 15 | M-001.2 Local deck library with authorized locations | REQ-001 | Must | 02:50 | M-001.1 | [ ] |
| 16 | M-001.3 Library document operations | REQ-001 | Must | 01:55 | M-001.2 | [ ] |
| 17 | M-001.4 Pages view | REQ-001 | Must | 01:20 | M-001.2, M-003.1 | [ ] |
| 18 | M-004.1 Code and equations | REQ-004 | Must | 01:05 | M-002.1 | [ ] |
| 19 | M-004.2 Diagrams and charts | REQ-004 | Must | 01:50 | M-002.1 | [ ] |
| 20 | M-004.3 Shapes, blocks, and insert catalog | REQ-004 | Must | 01:50 | M-002.2 | [ ] |
| 21 | M-004.4 Local images and media | REQ-004 | Must | 01:10 | M-002.1 | [ ] |
| 22 | M-005.2 Code-execution permission and sandboxed islands | REQ-005 | Must | 02:30 | M-005.1 | [ ] |
| 23 | M-005.3 Network and file boundaries | REQ-005 | Must | 02:10 | M-005.2 | [ ] |
| 24 | M-006.1 Presentation master and themes | REQ-006 | Must | 01:45 | M-002.2 | [ ] |
| 25 | M-006.2 Slide templates | REQ-006 | Must | 01:15 | M-006.1 | [ ] |
| 26 | M-006.3 Transitions, backdrops, and no-motion | REQ-006 | Must | 01:40 | M-003.2 | [ ] |
| 27 | M-008.1 Pointer, pen, canvas, and blackout | REQ-008 | Must | 02:25 | M-007.2 | [ ] |
| 28 | M-008.2 Text highlights and comments | REQ-008 | Must | 01:20 | M-008.1 | [ ] |
| 29 | M-009.2 Annotation export transaction | REQ-009 | Must | 02:40 | M-009.1, M-008.1, M-010.4 | [ ] |
| 30 | M-010.1 Source and Markdown exports | REQ-010 | Must | 01:25 | M-002.1 | [ ] |
| 31 | M-010.2 Offline HTML bundles | REQ-010 | Must | 01:55 | M-005.2, M-003.3 | [ ] |
| 32 | M-010.3 Public-artifact privacy and private presenter HTML | REQ-010 | Must | 01:20 | M-010.2 | [ ] |
| 33 | M-011.1 Static and rendered lint rules | REQ-011 | Must | 01:35 | M-002.1 | [ ] |
| 34 | M-011.2 Noninteractive CLI lint | REQ-011 | Must | 00:50 | M-011.1 | [ ] |
| 35 | M-012.2 Port range and audience URLs | REQ-012 | Must | 01:35 | M-012.1 | [ ] |
| 36 | M-012.3 Public listener isolation | REQ-012 | Must | 01:30 | M-012.2 | [ ] |
| 37 | M-012.4 Join, stop, preflight, and LAN verification | REQ-012 | Must | 01:55 | M-012.3 | [ ] |
| 38 | M-013.2 Performance targets | REQ-013 | Must | 01:40 | M-002.2, M-006.3 | [ ] |
| 39 | M-013.3 Offline privacy | REQ-013 | Must | 00:50 | M-010.2, M-012.4 | [ ] |
| 40 | M-013.4 Accessibility and display support | REQ-013 | Must | 01:25 | M-006.1, M-007.2 | [ ] |
| 41 | M-014.1 Final-state-only PDF | REQ-014 | Should | 00:45 | M-010.4 | [ ] |
| 42 | M-014.2 Linked PDF table of contents | REQ-014 | Should | 00:50 | M-010.4 | [ ] |
| 43 | M-014.3 PDF throughput | REQ-014 | Should | 00:45 | M-010.4 | [ ] |
| 44 | M-015.1 Size budgets | REQ-015 | Should | 00:55 | M-013.1, M-010.2 | [ ] |
| 45 | M-015.2 Reusable local React component | REQ-015 | Should | 00:55 | M-005.2 | [ ] |
| 46 | M-016.1 Pacing aids | REQ-016 | Should | 01:05 | M-007.2 | [ ] |
| 47 | M-018.1 Preview text editing | REQ-018 | Should | 01:50 | M-002.3 | [ ] |
| 48 | M-017.1 Histogram, box plot, and heatmap | REQ-017 | Could | 00:55 | M-004.2 | [ ] |
| **Total** | | | | **78:20** | | |

## 10. Open Questions

- [ ] Formal owner approval of this PRD and the discovery baseline, including every Proposed value: ports 7890 and 50000–50100, sandbox limits, reconnect window, handoff lifetime, transition catalog, the NFR-004 frame-drop definition, NFR-005..008 and NFR-010 thresholds, NFR-016 viewport sizes, and NFR-019 minimum LAN coverage.
- [ ] Final product name and named owner.
- [ ] The 14-theme catalog, font/media catalog, and redistribution-rights review. This blocks the M-006.1 UAT.
- [ ] Frozen source grammar for hierarchy, notes, reveals, blocks, master, and slots, confirmed with a real authored example.
- [ ] Support matrix: OS versions, CPU architectures, and browsers. Also whether live presenting or rendered lint may require a tested desktop Chromium, and approval of the capture gesture/permission.
- [ ] Live output: the G-02 transport outcome; LAN audience size, latency, and media-skew profile; interface enforcement; no-motion and caption semantics.
- [ ] Supported sandbox API/import/fallback contract after G-03, and the code/network/file grant lifetime (Proposed: per session, never persisted).
- [ ] Standalone private-HTML save contract: a download with no completion receipt must not trigger Clear or Save-and-close.
- [ ] Reference hardware and frozen performance/export-fidelity fixtures.
- [ ] Signing and notarization expectations, and any paid certificate cost.
- [ ] CI host: GitHub Actions or Azure Pipelines, but not both (technical design §9.3). The task list assumes GitHub Actions paths.
- [ ] Approval of FR-109 (preview text editing, Should) and its plain-text-only scope. It was added at the owner's request after the discovery baseline; `docs/mockups/draft.html` demonstrates it.
- [ ] Whether REQ-016 (Should) and REQ-017 (Could), which have no FR yet, should become numbered FRs in the discovery baseline.

