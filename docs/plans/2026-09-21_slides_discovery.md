# Discovery: Slides

**Date**: 2026-09-21 | **Updated**: 2026-09-25 | **Status**: Draft | **Owner**: Project owner (requester)

Name provisional. Summary confirmed and draft saved on 2026-09-21; formal approval pending. Architecture, stack, APIs, schema, and engineering backlog are outside discovery.

**Decision status**: user-confirmed behavior is the scope baseline. Items marked **Proposed** are recommendations awaiting acceptance, even when their intended priority is Must. Priority is not approval; this document remains Draft.

This document owns product behavior and priorities; the companion technical design owns implementation choices. Its owner-selected stack direction does not approve every Proposed requirement or waive a Must. Open feasibility gates are unresolved implementation evidence, not contradictory product requirements or permission to reduce scope.

## 1. Idea Summary

Build a lightweight application for personal use by programmers, software engineers, and data scientists, extensible by its owner and inspired by Deckrun. Author in Markdown-based MDX, optionally add JSX/React or JavaScript, and produce recursive slides, continuous documents, and clean PDF/HTML exports with presenter tools. Windows, macOS, and Linux executables open a document without a separate runtime installation; preview and local-only presentation stay private, while explicitly starting LAN sharing for a live presentation provides a separate audience port and IP-address URLs.

## 2. Problem & Motivation

The owner has no current slide tool; this is not a migration. The need is an extensible, document-driven workflow, not just conversion: technical content without rebuilding it in a graphical editor, nested explanations with private notes/live marking, portable ordered exports, and browser-only LAN audience access.

Doing nothing leaves that workflow unavailable; no time-loss, financial-impact, or commercial-demand baseline exists. Existing products cover common features. Extensibility, recursive navigation, and packaged local use motivate a custom product, not rebuilding proven rendering capabilities.

## 3. Users & Stakeholders

| Role | Needs | Technical level | Permissions |
| --- | --- | --- | --- |
| Owner / maintainer | Extend and direct the product | Developer | Maintain product; approve requirements |
| Author | Markdown/MDX content and local assets | File/markup skills; optional JavaScript/React | Edit selected files; grant code/network permissions |
| Presenter | Branches, reveals, notes, and marking | Deck, keyboard, and mouse familiarity | Control local/LAN playback and annotations, not authored content; start/stop sharing; explicitly save annotations |
| Audience / reader | Content without editor chrome or private notes | No authoring knowledge | Read-only LAN view or independent export; no source edits/shared-session control |

Single-author, local ownership; owner, author, and presenter may be one person. Multiple LAN viewers need no accounts/identity service and remain isolated from private authoring/control.

## 4. Goals & Success Criteria

| Goal | Success criterion |
| --- | --- |
| Complete workflow | Three technical decks: find each in the local library, open a pages view, author, externally edit, present in two windows, annotate, and export without manual HTML repair. |
| Narrative order | 100% agreement between Next/Previous, export order, and navigation-fixture hierarchy. |
| Responsiveness and motion | Meet NFR-001 through NFR-004 on the reference workload: 3-second launch, 200 ms preview, 100 ms navigation, and 60 fps targets. |
| Export quality | All built-in content renders without missing assets, unintended clipping, or private-note leakage. |
| Ownership and offline use | No unapproved external requests or browser-storage dependency for reopening files; LAN sharing needs no internet. |
| Draft/presentation separation | Draft edits hot reload; source, asset, master, or template edits never change an active presentation. |
| Consistent design | Editing the presentation master updates all draft slides; changing one slide template affects only that slide's layout. |
| Network viewing | Two separate LAN clients reproduce the presenter's public output, including widgets, code results, media, and annotations, without private data/control access. |

### Reference Workload

The owner accepted the 100-slide/responsiveness targets. Freeze these fixture details and per-OS reference hardware during technical design, before measurement:

- 100 nodes, including descendants to five levels; five is a fixture depth, not a product limit.
- Source <= 1 MiB; 20 equations; 10 Mermaid diagrams, each <= 30 nodes/50 edges; 10 charts, each <= 1,000 data points.
- 20 local images totaling <= 20 MiB; five simple JavaScript/React demos, such as counters or parameter-controlled charts.
- Thirty slides with two reveals each, seventy without: 160 default PDF pages including initial states.
- Reference laptop: >= four CPU cores, 16 GiB RAM, SSD, integrated graphics, 1920 x 1080 at 60 Hz; record a machine per supported OS family.
- Valid deck with local assets and any authored-code execution explicitly permitted; exclude installation, human permission-response time, and deliberately unbounded code from timings.
- At least 20 cold launches, 100 preview edits, 200 navigation inputs, and a 60-second motion/drawing trace. Cold launch includes application/document startup with no existing process serving the deck.

Additional unconfirmed numeric targets are marked **Proposed** in section 8. No measurements have been performed.

## 5. Scope

### In Scope

Full selected v1, not a reduced presentation-only MVP. Section 7 defines the complete feature set:

- Draft-mode `.mdx`/`.md` authoring with browser editor, hot-reloading preview, autosave, a local deck gallery/pages view, and external editors; one source for slides and continuous reading. Presentation mode freezes authored content and design.
- Recursive navigation, rich technical content, themes, an editable presentation master, per-slide templates, motion, and presenter/annotation tools; catalogs below, behavior in section 6.
- Original-source/Markdown, interactive HTML, continuous HTML, private presenter HTML, and headless PDF exports. Offline HTML may be a folder bundle requiring local serving.
- Application and noninteractive local/CI linting; offline core, explicit code/network permissions, no mandatory cloud service.
- Windows/macOS/Linux executables accepting a file path; PDF may require an installed compatible browser.
- Separate range-selected live ports and copyable LAN URLs for read-only viewers; ordinary preview does not enable sharing.

### Application Form

- **Model**: [Deckrun](https://github.com/arpitbbhayani/deckrun)-inspired local command/file-driven launch. Browser editing, preview, presentation, and export are interfaces, not a mandated web application, hosted service, or native GUI. Authored React components do not select the application's UI framework.
- **Distribution**: standalone executables for all three OS families, without separate language-runtime installation. Do not inherit Deckrun's Node.js/npm prerequisite; architecture and packaging remain technical-design decisions.

### Authoring Format

- **Baseline**: MDX is Markdown with optional JSX/React, expressions, and imports/exports. Headings, prose, lists, links, images, and fenced code need no authored JavaScript. The two output modes are slides and continuous reading, not separate Markdown/MDX products.
- **Compatibility**: accept `.mdx` and `.md`; document CommonMark differences, including raw HTML versus JSX, autolinks, and reserved `<`/`{` characters. Renaming arbitrary Markdown to MDX is not guaranteed to work unchanged.
- **Code-execution permission**: permission to run document-supplied JavaScript, expressions, or React components, not a judgment about the slides. Passive Markdown and built-in application controls need no such prompt. The local author grants it for authoring/presentation; it does not grant network/file access or transfer to another person's device. Without permission, keep code inactive and show static content/fallbacks.
- **Recipients**: LAN viewers receive the presenter's public output without having to execute unapproved document code; author permission cannot silently authorize execution on their devices. Recipients of runnable HTML exports must grant their own code-execution/network permissions. An export's initial permission gate may run built-in application code, not the document's code.
- **Export compatibility**: only added capabilities unrepresentable in ordinary Markdown need conversion diagnostics/fallbacks.

### Presentation Master and Slide Templates

- **Presentation master view**: edit deck-wide colors, heading/body/code fonts, font sizes, background, and shared elements such as logos/footers in draft mode; changes reflect across all slides. Themes supply preset master styling.
- **Slide templates**: choose a layout per slide, such as title/content, two columns, three columns, or picture with text. They arrange content while inheriting master styling; they do not replace the master or silently override its shared properties.
- Edit both in draft mode and store them with the deck. Changes affect draft previews, draft-based exports, and newly started presentations, including descendant slides. Existing presentation instances and their exports retain the captured master/templates.

### Out of Scope (Non-Goals)

| Excluded | Rationale |
| --- | --- |
| Cloud accounts/storage, telemetry, hosted collaboration, payments | Personal, local-first tool. |
| Public internet hosting, automatic tunnels/router forwarding, cross-device presenter control | LAN audience viewing only; editing, notes, and control stay private on the host. |
| Live Python/R, shell, notebook kernels, server-side code runners | Execute simple JavaScript/React only; other languages can be displayed. |
| Plugin marketplace/third-party extension distribution | Maintainer changes and local React components provide extensibility. |
| Arbitrary object-placement editor, arbitrary HTML import/editing | Master settings and slide templates are included, but not a PowerPoint-style freeform editor. MDX/Markdown is source; HTML is output; pen is a presenting tool. |
| PPTX, notebook, office-document import/export | Not selected. |
| Full TeX compilation, arbitrary LaTeX packages, TikZ | KaTeX-compatible equations only. |
| Full mobile authoring/native mobile executables | Desktop keyboard/mouse first; exported reading remains responsive. |
| Guaranteed single-file HTML or bundled PDF browser | Folder bundles and an installed PDF browser are accepted. |

### Initial Catalog Boundaries

| Catalog | Contents |
| --- | --- |
| Charts | Line, bar, area, scatter, pie, donut; HTML hover details and meaningful static output. |
| Mermaid | Flowchart, sequence, class, state, entity-relationship, at minimum. |
| Shapes | Rectangles, circles, lines, arrows, labels; configurable appearance. |
| Blocks | Callouts, columns, timelines, metrics, tables, image/caption compositions. |
| Presentation master | Editable shared styling/background/elements for every slide; separate from individual layouts. |
| Four initial slide templates | Title/content, two columns, three columns, picture with text. User-required examples replace the earlier proposed catalog; names/visual treatments remain design choices. |
| Five transitions | Proposed: fade, directional slide, zoom, wipe, flip; no-motion is separate and not counted. |
| Themes | 14 distinct palette/typography presets; names/visuals deferred to design, no content rewrites when switching. |

## 6. Key Scenarios / User Journeys

### Open and Edit a Local Deck

Run the executable with a `.mdx`/`.md` file to open draft/creation mode; without a file, open the local **My Decks** library. New decks save under a writable, per-user application deck directory by default; choosing another location saves there instead and keeps that deck in the library. If the default directory cannot be created or written, report the failure and let the author choose another location; never silently save elsewhere or claim persistence. The library shows all app-created or opened decks, including those saved elsewhere, as searchable cover cards with titles; only explicitly added/opened external files or directories are indexed, not the whole disk. Opening one file authorizes that deck and read-only resolution of its referenced files beneath its folder, not indexing sibling decks; references outside that folder need explicit authorization. Selecting a card opens a pages view with ordered slide thumbnails and hierarchy, from which the author can open a slide in draft mode or start presenting from the first slide. The supplied gallery reference guides the local cover-card layout, not cloud/team sharing, exact branding, or category requirements.

Source, component, local asset/data, master, and template changes hot reload the draft preview and pages view. Save status is visible, conflicts preserve competing versions, and invalid edits retain source and the last valid preview (FR-001 through FR-016). Missing or unreadable decks stay identifiable in the library with relink and remove-from-library actions rather than silently disappearing; removal never deletes files.

### Start and End Presentation Mode

Normal launch requires a valid draft with no unresolved file conflicts. Invalid edits retain the last valid preview but never silently become an older live presentation. A separate, explicit **Present last valid version** action can launch a retained, validated version, clearly identified as older, without discarding or resolving current draft edits/conflicts.

Starting presentation captures the selected valid source, referenced local assets/data/components, notes, master, and template assignments as a fixed session version. The presentation surface disables authoring and hot reload; a separate draft editor may continue editing. Neither browser-editor nor external-file changes affect an existing instance. Start a new presentation instance to pick up changes; there is no in-place republishing. Existing instances keep their own captured versions until closed.

The presentation surface shows the selected slide stage without library, card, pages, or editor chrome; the draft may stay open in its own window. Projected and LAN audience views contain no application navigation, deck thumbnails, sidebars, or presenter chrome. Private notes and tools stay on the separate presenter surface. Navigation, reveals, playback of authored demos/media, and annotation tools remain available; these change presentation state, not source content. Pen/highlights/comments, laser, blank canvas, and blackout are temporary overlays. Private notes and tool controls never become audience content merely because the public output is synchronized.

### Share a Live Presentation on the Local Network

Starting a presentation creates a live instance, which may remain local-only. Explicitly start LAN sharing to expose that instance's audience view on approved interfaces, leaving private capabilities on loopback. Each LAN-shared instance gets a distinct, successfully bound audience port using FR-087 through FR-089; a local-only instance has no LAN listener. An exhausted range can be changed without interrupting the editor or existing services. Stopping sharing releases its audience port/connections but preserves the local instance and its marks; ending the instance also discards its unsaved marks. Already delivered content cannot be recalled.

Viewers enter a displayed URL from the same reachable network. Example: `http://192.168.1.25:50001` illustrates a host IP plus bound port, not prescribed/current values. Addresses come from approved host interfaces, labeled Wi-Fi/Ethernet; do not assign new IPs or scan other devices. FR-091 defines URL formatting and excludes loopback/wildcard addresses from remote URLs.

All live viewers, including late joins/reconnections, see the same public presentation output as the presenter: layout, slide/reveal, animations, chart hover/selection, React widget state, JavaScript results, media playback position, and visible annotations/modes. Time/random/data-driven results must not diverge per viewer. Viewers cannot navigate or interact independently during the live session; standalone exports retain independent navigation. Uniform fit-to-screen scaling is allowed without layout reflow; device accessibility settings may suppress motion without changing content/state. Network delay is measured separately, not treated as instantaneous pixel-identical delivery.

If a component/embed cannot meet shared-output requirements, report it before starting audience delivery; use a presenter-approved fallback identically for everyone or block that delivery rather than silently show different content. This applies to linked local audience views as well as LAN sharing and specifies behavior, not streaming versus state synchronization. Keep the private local preview/presentation usable when sharing fails. Interface discovery does not prove reachability: firewall, guest isolation, VPN, and routing restrictions need guidance, not automatic security changes, elevation, or public internet exposure.

### Present a Recursive Narrative

```text
1
  1.1
    1.1.1
    1.1.2
  1.2
2
```

Next follows `1 -> 1.1 -> 1.1.1 -> 1.1.2 -> 1.2 -> 2`; Previous reverses this canonical order, not jump history. Completing a branch does not redisplay ancestors.

- Sibling axes alternate by depth: vertical roots, horizontal children, vertical grandchildren, continuing recursively.
- Along-axis arrows move among siblings; the forward perpendicular direction enters the first child. At the first sibling, the backward along-axis direction returns to its parent, if any. A parent/breadcrumb action returns directly from any sibling.
- From `1`: Right enters `1.1`, Down skips to `2`. From `1.1`: Down enters `1.1.1`, Right skips to `1.2`. Arrows may skip detail; Next does not.
- Disable unavailable directions; directional moves never wrap branches. Next/Previous traverse ancestors as needed and stop at the deck boundaries.
- Show hierarchical and overall slide progress, excluding reveal counts; overview, directional, and parent jumps enter the destination's initial reveal state.

### Reveal Content Without Duplicating Authored Slides

Next exhausts current reveals before moving to the next node; Previous reverses every state. Direct jumps open the initial state; backward entry reaches the preceding slide's final state.

Two reveal steps produce three default PDF pages: initial, first reveal, second reveal, before descendants/siblings. Interactive HTML retains navigation/reveals; continuous HTML shows each node once, fully revealed, in the same node order.

### Present With Private Notes and Live Marking

Keep private notes and presenter controls separate from public output. Capture live pen strokes, text highlights, and comments per presentation instance and slide; comments stay private unless explicitly made public. Tools preserve position and marks stay aligned across window sizes. Marks belong to the reveal step where created and remain visible at that step and later steps, never earlier ones; erasing removes them from the current annotation set, not from already saved copies.

On export, ask **Save annotations**, **Clear annotations and export**, or **Cancel** when the selected draft session or live instance has annotations. Save writes an annotated copy, preserves its included marks on reopening that artifact, and leaves session marks available. Disclose omitted private comments before confirmation; a public artifact never counts as saving those comments. Clear explicitly discards unchanged captured marks and their comments only after a successful clean export, synchronizing that removal to linked views. Cancel or failure changes no marks; later additions/edits are untouched. Source-only/converted Markdown needs an annotated PDF/HTML companion to save ink; failure of that companion must not block a raw-source backup or falsely mark annotations saved.

An instance ends when its controlling live document is closed/reloaded, the presenter ends it, or the host application exits. Unsaved annotations then cannot be recovered through reopening, browser restoration, or a new presentation; no automatic annotation backup is kept. Controlled close offers save/discard/cancel, waits for save success, and stays open on failure; abrupt closure may offer no warning. **Proposed**: because a crashed owner cannot be distinguished from a lost connection, losing contact with the controlling document beyond a bounded reconnect window counts as abrupt closure; a transient disconnect within that window does not end the session. Closing/reloading an audience view only disconnects/rejoins that viewer. Draft-preview highlights belong to their own session and fully revealed preview state; they never enter a live instance/export implicitly. Switching pages/editor/master views of that same open draft preserves its session; closing/reloading it follows the same annotation save/discard rule. Starting a separate live instance does not close the draft.

### Use a React Demonstration or External Media

Permit authored JavaScript/React execution separately from launching the application; external resources need additional network permission. Draft mode supports editing/reloading; presentation mode plays the prepared demo without source edits and shares its visible results/state. Built-in diagrams, equations, local-data charts, and local media work offline; unavailable remote embeds use a common fallback. PDF uses static representations, not live execution/playback.

### Export and Share Reliably

Live exports use the selected instance's frozen version, never newer editor/disk content. At export request capture its surviving annotations, relevant displayed state, options, and static representations; the Save/Clear decision uses that snapshot. Later edits, strokes, or playback cannot change the job. A save succeeds only when its artifact is written; closing the instance before completion cancels its unfinished annotation-dependent outputs and does not create annotation recovery.

| Output | Input and validation |
| --- | --- |
| Original MDX/Markdown source | Exact selected source, even if malformed, plus available authorized companion files. For a file conflict, explicitly choose editor or disk version without overwriting either. No code execution; report missing companions without blocking the source backup. |
| Converted Markdown or rendered draft output | Current valid editor revision with resolved file conflicts, even if source autosave is still pending; never silently substitute disk or the last valid preview. Conversion/rendering diagnostics apply. Annotated draft output captures the relevant displayed preview state so marks stay aligned. |
| Live converted/rendered/annotated output | Captured live version and applicable export-time state, unaffected by draft changes. Apply the annotation choice above and ordinary export diagnostics. |

Public rendered exports contain authored slide content and explicitly saved public annotations/comments, not the library, pages view, editor/presenter toolbars, private notes, or private comments. Independent HTML retains its own navigation, permission, playback, and accessibility controls outside the slide content; these are not exported application chrome. Original source and converted Markdown are text outputs without a public-safety guarantee, and private presenter HTML is explicitly labeled private. PDF follows canonical node/reveal order: one initial page plus each reveal step; continuous HTML shows each node once, fully revealed. An optional PDF table of contents can precede the slides, linking numbered node titles to their first emitted page (initial state by default, fully revealed state for final-only output); it is off by default so ordinary page counts are unchanged. Saved marks appear from their creation step onward, so a circle drawn at reveal 2 is absent on states 0 and 1. Save the surviving set, not stroke history; final-state-only output shows all surviving slide marks. An annotated HTML copy preserves reveal navigation but uses labeled static snapshots for marked dynamic content to maintain alignment. Unmarked content and clean interactive exports retain supported interaction; annotated copies do not promise recording/replay of arbitrary widget/media behavior.

Blank-canvas drawings are separate from slide ink: save one labeled final canvas per marked slide, after the deck in canonical slide order. These appendix pages/sections do not change slide numbering or the 160-page unannotated benchmark. Laser position, blackout, and tool controls are never exported. Save discloses which marks/comments the format preserves; private comments require private presenter HTML, while public PDF/HTML physically omit them and authored notes. Source, converted Markdown, and private presenter exports warn that they are not audience-safe.

## 7. Functional Requirements

**Must**: required for v1; **Should**: recommended, nonblocking; **Could**: optional; **Won't**: outside v1. These are intended priorities, not confirmation status. **Proposed** applies only to the named detail/target pending acceptance, not to already confirmed behavior. Unmarked recommendations remain draft requirements until document approval.

### Authoring and Local Ownership

| ID | Requirement | Priority | Notes |
| --- | --- | --- | --- |
| FR-001 | The system shall open the supplied document in a local preview when invoked through the platform executable with its file path. | Must | Paths containing spaces and non-ASCII characters must work; the executable-driven workflow does not prescribe a web-app architecture. |
| FR-002 | The system shall open the local My Decks library when launched without a document path. | Must | Show app-created decks from the default directory and explicitly selected other locations. |
| FR-003 | The system shall serve authoring, the library, private preview, and presenter controls on a configurable private port bound only to `127.0.0.1`. | Must | LAN audience delivery uses a separate port; opening a preview does not expose private capabilities. |
| FR-004 | The system shall offer a different private authoring port when the requested port is occupied. | Must | Report the resulting URL; never terminate the existing process. Live audience ports are selected automatically under FR-088. |
| FR-005 | The system shall support Markdown-only deck content within its primary MDX authoring format without requiring JSX, JavaScript expressions, or imports. | Must | Accept both `.mdx` and `.md` files in the same workflow; document MDX-specific syntax differences rather than assuming universal CommonMark compatibility. |
| FR-006 | The system shall provide an in-browser source editor with undo and redo in draft mode. | Must | Source-oriented; presentation mode is not an authoring surface. |
| FR-007 | The system shall hot reload the adjacent draft preview after authoring changes. | Must | Includes source, master, and slide-template edits; NFR-002 defines reference-edit latency. Never replace active presentation content. |
| FR-008 | The system shall autosave draft source edits to the selected local file with an observable save status. | Must | Browser storage is not authoritative; live annotations never autosave into source. |
| FR-009 | The system shall refresh the draft editor/preview after nonconflicting external changes to source or referenced local assets, data, and components. | Must | External editors remain first-class; active presentation versions are unaffected. |
| FR-010 | The system shall preserve competing versions for an explicit conflict decision when browser and external edits overlap. | Must | Proposed data-loss safeguard; no silent last-writer-wins. |
| FR-011 | The system shall maintain a searchable library of decks and document views in the default per-user application deck directory and explicitly selected local locations. | Must | New decks use the default directory unless another is chosen; decks created elsewhere remain listed after restart. Both modes refer to the same authored source; do not scan unrelated disk locations. |
| FR-012 | The system shall initialize a new local document with a presentation master and a selected first-slide template. | Must | A useful starting point without required hand-written setup; master and slide layout are distinct. |
| FR-013 | The system shall duplicate a library document without overwriting the original. | Must | Retain resolvable asset references. |
| FR-014 | The system shall rename a library document without silently breaking its asset references. | Must | Report conflicts or invalid paths. Proposed: rename and delete require closing any open draft of that deck first. |
| FR-015 | The system shall require confirmation before deleting a document through the library. | Must | Do not delete shared assets implicitly. |
| FR-016 | The system shall retain the last valid preview when incomplete or invalid source cannot render. | Must | Identify the preview as stale and preserve edited text/diagnostics. Retaining a preview does not authorize silent launch of that version; see FR-102. |

### Hierarchy and Navigation

| ID | Requirement | Priority | Notes |
| --- | --- | --- | --- |
| FR-017 | The system shall represent slides as an ordered recursive tree in which a slide can have its own content and child slides. | Must | Not restricted to a two-level stack; validate at least ten levels. |
| FR-018 | The system shall alternate sibling orientation by depth, starting vertically at the top level. | Must | Automatic rule, not author-selectable orientation in v1. |
| FR-019 | The system shall display hierarchical slide numbering alongside overall slide progress. | Must | Example: `1.1.2` and `4 / 100`; reveals do not create new slide numbers. Show these in private presentation controls and independent HTML navigation, not as mandatory audience/export overlays. Author-defined master footers remain slide content. |
| FR-020 | The system shall advance Next through current reveal states and then through slide nodes in depth-first preorder. | Must | Complete descendants before the next sibling; no repeated ancestor pages. |
| FR-021 | The system shall make Previous the inverse of the canonical Next sequence. | Must | Reverses slide/reveal position, not annotations, widget edits, or playback history; independent of jump history. |
| FR-022 | The system shall provide Up, Down, Left, and Right controls following the hierarchy rules in section 6. | Must | Controls expose available destinations and disable unavailable moves. |
| FR-023 | The system shall provide a direct return to the current slide's parent. | Must | Proposed navigational safeguard for deep trees. |
| FR-024 | The system shall provide a carousel/progress indicator button that opens a hierarchy-aware quick-jump overview. | Must | Any slide can be selected. Overview, directional, and parent jumps start at the destination's initial reveal state; only Previous enters a preceding slide's final state. |
| FR-025 | The system shall support navigation using keyboard, mouse controls, and directional wheel/trackpad gestures. | Must | Directional gestures follow directional moves; Next/Previous provide the complete narrative walk. |
| FR-026 | The system shall prevent editing, drawing, content scrolling, or focused widget interaction from unintentionally triggering deck navigation. | Must | Includes gesture inertia and key handling. |
| FR-027 | The system shall stop traversal at the first and last canonical states without wrapping. | Must | Clear boundary state; no accidental restart during a talk. |
| FR-028 | The system shall offer a continuous-reading view that presents each slide node once, fully revealed, in tree traversal order. | Must | Ordinary document scrolling; retain identifiable section hierarchy. |

### Technical Content

| ID | Requirement | Priority | Notes |
| --- | --- | --- | --- |
| FR-029 | The system shall render fenced code with syntax highlighting in previews, presentations, and rendered exports. | Must | Original-source exports preserve the code text; displaying a language does not imply executing it. |
| FR-030 | The system shall render inline and block KaTeX-compatible equations in both viewing modes and PDF/HTML exports. | Must | Unsupported commands produce actionable diagnostics; no claim of full LaTeX support. |
| FR-031 | The system shall render the initial Mermaid diagram catalog in both viewing modes and PDF/HTML exports. | Must | Catalog listed in section 5. |
| FR-032 | The system shall render the initial chart catalog with HTML interaction and a corresponding static export representation. | Must | Line, bar, area, scatter, pie, and donut. |
| FR-033 | The system shall accept chart data defined inline or supplied by local CSV/JSON files. | Must | No remote data service is required. |
| FR-034 | The system shall provide document-authored rectangles, circles, lines, arrows, and labels with configurable appearance. | Must | Authoring shapes is distinct from live pen marks. |
| FR-035 | The system shall provide reusable callout, column, timeline, metric, table, and image/caption blocks. | Must | Available through documented document syntax. |
| FR-036 | The system shall offer discoverable, insertable examples for built-in components. | Must | Makes adding technical content practical without memorizing syntax. |
| FR-037 | The system shall run explicitly invoked simple JavaScript examples after code-execution permission is granted. | Must | Browser-context examples, not host shell or server execution; live results follow FR-093. |
| FR-038 | The system shall render author-supplied local React components after code-execution permission is granted. | Must | Reusable across documents; live widget state follows FR-093, not independent viewer execution. |
| FR-039 | The system shall resolve supported local image assets relative to the authored document. | Must | Include common raster images and safe SVG content; validate unsafe or unsupported assets. |
| FR-040 | The system shall play supported local audio/video in preview and presentation views. | Must | Document codec support; synchronize live playback state; PDF uses a static fallback. Browser playback restrictions must be surfaced, not hidden. |
| FR-041 | The system shall display explicitly permitted external embeds with a defined unavailable/offline fallback. | Must | Network permission is separate from code-execution permission; live sharing must meet FR-101. |

### Master, Slide Templates, and Motion

| ID | Requirement | Priority | Notes |
| --- | --- | --- | --- |
| FR-042 | The system shall provide 14 selectable theme presets. | Must | Distinct palettes and typography; catalog names remain a design decision. Proposed: switching presets keeps explicit master overrides; a separate Reset restores the preset. |
| FR-043 | The system shall apply master palette changes across draft slides, draft-based exports, and newly started presentations. | Must | Includes built-in charts/diagrams; existing instances and their exports keep their captured palette. |
| FR-044 | The system shall apply master heading, body, and code fonts across draft slides, draft-based exports, and newly started presentations. | Must | Preserve math fonts and report missing fonts. Existing instances and their exports keep captured typography. |
| FR-045 | The system shall apply master font-size settings across draft slides, draft-based exports, and newly started presentations. | Must | Draft-only editing without individual content edits; existing instances and their exports keep captured sizes. Warn about overflow rather than silently clipping content. |
| FR-046 | The system shall provide four initial per-slide templates selectable without manually rewriting slide content. | Must | Title/content, two columns, three columns, picture/text. Selecting a layout affects only that slide; all inherit the presentation master. Draft-only editing; existing instances and their exports keep captured layouts. |
| FR-047 | The system shall provide five draft-selectable transition presets without manual source-content rewrites. | Must | Existing instances retain captured settings; pausing motion/reduced-motion preferences remain playback controls, not authored edits. Hierarchy/order is unchanged. |
| FR-048 | The system shall offer opt-in animated backdrops. | Must | Must be pausable and have a defined static export appearance. |
| FR-049 | The system shall provide a no-motion experience that respects the user's reduced-motion preference. | Must | Applies to backdrops, transitions, and reveal effects without changing content order. |
| FR-050 | The system shall reveal author-marked bullets, prose, equations, code, and diagrams incrementally without duplicating source slides. | Must | Whole blocks or declared groups; automatic animation of internal diagram steps is not implied. |

### Presenter and Annotation Tools

| ID | Requirement | Priority | Notes |
| --- | --- | --- | --- |
| FR-051 | The system shall open a linked audience view separate from the editor/presenter view. | Must | Local tabs/windows and LAN audience browsers are supported; projection and sharing are controlled by the presenter. |
| FR-052 | The system shall display per-slide authored notes only in the private presenter surface during presentation. | Must | Projecting the entire desktop can still expose private windows; the app cannot control screen-sharing software. |
| FR-053 | The system shall keep the selected instance's private preview and notes synchronized with its slide and reveal state. | Must | Read-only authored content; a separate draft editor can continue editing. Instance selection also determines annotation/control/export targets, never another instance implicitly. |
| FR-054 | The system shall synchronize deliberate audience-visible live marks between linked presenter and audience views. | Must | Includes local and LAN views; marks stay aligned across window sizes, and private comments are not transmitted. |
| FR-055 | The system shall provide a transient laser pointer. | Must | Does not modify authored content. |
| FR-056 | The system shall provide freehand pen annotation with color, width, undo, erase, and clear controls. | Must | Mouse operation is required; specialized stylus pressure support is optional. |
| FR-057 | The system shall provide a blank drawing canvas that can be entered and left without losing presentation position. | Must | Drawings stay separate from slide ink and belong to that instance/slide. Saved canvases become labeled appendix pages/sections, not new authored slides. |
| FR-058 | The system shall provide blackout mode that hides audience content until explicitly dismissed. | Must | Retain navigation position and private presenter context. |
| FR-059 | The system shall show shortcut help when the presenter invokes `?` outside text input. | Must | Help must also have a discoverable control. |
| FR-060 | The system shall support marker-style text highlighting in draft preview and live presentation. | Must | Draft marks belong to its fully revealed preview; each live instance is isolated. Never implicitly transfer marks or change source. After draft edits discard unresolvable anchors rather than mark wrong content. |
| FR-061 | The system shall attach editable comments to text highlights. | Must | Private by default; deliberately showing a comment is a separate action. |
| FR-062 | The system shall discard unsaved annotations irrecoverably within the application when their owning session closes. | Must | No automatic backup/restore. Owner close/reload/end/host exit ends its session; viewer disconnect and transient owner disconnect do not. Proposed: owner-contact loss beyond a bounded reconnect window counts as abrupt closure. Controlled Save-and-close waits for success and requires explicit discard consent for any omitted private comments; failure stays open. Discard/abrupt closure cancels unfinished annotation-dependent outputs, including a Clear's clean output; an independent raw backup may still complete. Saved artifacts retain included marks when explicitly reopened, never through automatic new-session recovery. |
| FR-063 | The system shall require Save annotations, Clear annotations and export, or Cancel when exporting a session with annotations. | Must | Capture that draft session/live instance only. Clear removes unchanged captured marks after successful clean export, not newer edits; cancel/failure preserves them. Source needs a PDF/HTML companion to save ink, whose failure cannot block raw backup. Show preserved/omitted marks/comments; private comments require private presenter HTML. |

### Export

| ID | Requirement | Priority | Notes |
| --- | --- | --- | --- |
| FR-064 | The system shall export the exact selected MDX/Markdown source regardless of syntax validity. | Must | Include available authorized companions and report missing ones without blocking text backup. For conflicts, explicitly choose editor/disk version without overwriting either. Never execute code to back up source; notes/code make it non-public. |
| FR-065 | The system shall export Markdown while preserving Markdown content and reporting any MDX-specific content that cannot be represented. | Must | Markdown-only content needs no MDX-specific fallback. For added JSX/React behavior or executable expressions that cannot be represented, use supplied static representations or identified placeholders, never silent omission. Authored notes remain as labeled Markdown sections; the output is not audience-safe. |
| FR-066 | The system shall export an offline interactive HTML presentation bundle preserving tree navigation and reveals. | Must | Folder output/local serving is acceptable; no authoring app required. Recipient permission gates authored code/network access; navigation and static content remain available without it. |
| FR-067 | The system shall export an offline continuous-reading HTML bundle in canonical slide-node order. | Must | Each node appears once with all revealed content visible. |
| FR-068 | The system shall export a separately identified private presenter-ready HTML bundle with notes and presenter tools. | Must | Not safe to distribute as a public artifact; document any local-server requirement. |
| FR-069 | The system shall export a headless-rendered PDF with one page per canonical slide/reveal state by default. | Must | Initial state and every reveal, then descendants/siblings in Next order; installed compatible browser. No application chrome. Saved ink follows FR-104; saved blank canvases add labeled appendix pages after the deck. |
| FR-070 | The system shall offer a final-state-only PDF export option. | Should | Proposed convenience; the agreed default remains every reveal step. |
| FR-071 | The system shall include redistributable assets/fonts needed for an HTML bundle's declared offline representation. | Must | No silent CDN dependency. Remote services use declared local fallbacks offline; unavailable or non-embeddable required resources are reported as blocking unless an explicit fallback is selected. |
| FR-072 | The system shall use defined static representations for executable components, media, external embeds, and motion in PDF and offline fallbacks. | Must | Require an author representation when automatic output is unreliable; never run authored code without execution permission, including export. |
| FR-073 | The system shall omit authored notes, private comments, and application/library/editor/presenter chrome from every part of public PDF/HTML artifacts. | Must | Removal includes embedded data, HTML comments, source maps, and companion files, not merely visual hiding. Saved public annotation comments are permitted; standalone HTML includes its own navigation/permission/playback/accessibility controls. Private presenter HTML is a separately labeled non-public output. |
| FR-074 | The system shall report export failure before claiming a complete artifact or saved annotations. | Must | Validate format-specific prerequisites. For source plus annotation companion, report each result separately; a source-only success is not an annotation save. Invalid rendering never blocks raw backup. Cancel/failure never clears marks or overwrites source. |

### Validation and Permissions

| ID | Requirement | Priority | Notes |
| --- | --- | --- | --- |
| FR-075 | The system shall report unintentionally empty slides during deck linting. | Must | Distinguish intentional blank/title/reveal states. |
| FR-076 | The system shall report malformed MDX, code fences, equation syntax, and diagram definitions during deck linting. | Must | Identify the source location and affected slide where possible. |
| FR-077 | The system shall report dense or overflowing content for the selected presentation settings. | Must | Density is a documented heuristic; actual overflow is a separate diagnostic. |
| FR-078 | The system shall report missing local images, missing image descriptions, and unsuitable image dimensions during deck linting. | Must | Remote availability checks cannot bypass network permission. |
| FR-079 | The system shall report invalid or ambiguous reveal markers during deck linting. | Must | Reveal ordering must be deterministic. |
| FR-080 | The system shall report invalid slide hierarchy declarations during deck linting. | Must | Reject ambiguous parentage and duplicate identities; exact authoring syntax is deferred. |
| FR-081 | The system shall expose deck linting through a noninteractive local/CI operation with a failing exit status for errors. | Must | Same rules as editor; warnings are distinct. Permission-dependent checks require explicit prior authorization; otherwise report them blocked/incomplete with nonzero status, never hang for input or silently pass. |
| FR-082 | The system shall require the executing device's user to permit document-supplied code before it runs. | Must | Local author/presenter in the app; recipient for runnable HTML. Covers preview, presentation, export, and executing lint. Permission is not inherited from the sender; passive Markdown/static inspection and built-in controls require none. Denial leaves code inactive with readable content/fallbacks. |
| FR-083 | The system shall require explicit permission before deck content contacts an external origin. | Must | Code-execution permission does not grant network access; includes remote media/fonts/data/embeds. LAN delivery is separately authorized by starting sharing, not by permitting arbitrary external requests. |
| FR-084 | The system shall restrict application-mediated file access to locations explicitly authorized by the owner. | Must | Imported references cannot silently read or overwrite arbitrary files. Opening a deck authorizes read-only resolution of its referenced files beneath its folder; other locations need explicit authorization. |
| FR-085 | The system shall identify a failed content block without discarding the document or unrelated valid slide content. | Must | Proposed reliability safeguard for malformed or failing components. |
| FR-086 | The system shall preserve presentation settings when the source and companion files are reopened or moved together. | Must | Includes master, per-slide template assignments, theme, fonts, and motion; not only a port-specific cache. |

### Live LAN Sharing

| ID | Requirement | Priority | Notes |
| --- | --- | --- | --- |
| FR-087 | The system shall allow configuration of an inclusive port range for live audience presentations. | Must | Validate legal, usable port bounds and an ordered, nonempty range; the default numeric range remains a technical-design choice. |
| FR-088 | The system shall automatically bind a distinct available audience port from the configured range when explicitly starting LAN sharing for a presentation instance. | Must | Local-only presentation binds no audience port. Exclude the private authoring port and occupied ports; retry bind collisions within the range, and advertise only a successfully bound port. Applies to `.mdx` and `.md` decks. |
| FR-089 | The system shall report when no port in the configured presentation range can be bound. | Must | Preserve private authoring and existing presentations; do not terminate another process or silently select outside the range. |
| FR-090 | The system shall serve only the selected presentation version's read-only public output through approved LAN interfaces. | Must | Explicit live session; no viewer installation or requirement to execute unapproved document code. LAN viewers cannot independently navigate, change widgets, or control playback; host permission never silently grants viewer-device execution. |
| FR-091 | The system shall display copyable audience URLs containing each usable approved LAN IP address and the actual bound presentation port. | Must | Show in the presenter surface and launcher output with interface labels; support IPv4, use bracketed IPv6 when offered, and do not advertise loopback/wildcard addresses as remotely reachable URLs. |
| FR-092 | The system shall deny LAN audience access to private authoring data and presenter control capabilities. | Must | Includes editor/library access, raw source, authored notes, private comments, write/control operations, and private data embedded in delivered assets or diagnostics. A separate port alone is not sufficient protection. |
| FR-093 | The system shall reproduce the presenter's public presentation output in every local/LAN audience view. | Must | Includes layout, reveals/animation, chart hover/selection, React state, JavaScript results, media play/pause/seek position, visible comments/marks, laser, canvas, and blackout. No per-viewer time/random/data divergence or private notes/tool UI. |
| FR-094 | The system shall initialize joining or reconnecting LAN browsers with the active version and current public presentation state. | Must | Includes widget/code/media/annotation state; do not restart at the first slide or expose private state. Surface disconnection while resynchronizing. |
| FR-095 | The system shall stop LAN audience serving and release its audience port when sharing stops or its controlling live session ends. | Must | Stop-sharing preserves the local instance, local audience view, and its marks; ending the instance closes all its audience views and discards unsaved marks. Leave editor/other instances untouched. Already delivered content cannot be revoked. |
| FR-096 | The system shall report LAN-sharing unavailability with actionable connection guidance. | Must | Distinguish local-only operation from network sharing; explain relevant interface/firewall/routing checks without claiming host-side address discovery proves remote reachability or automatically changing network security settings. |

### Presentation Versions and Master Inheritance

| ID | Requirement | Priority | Notes |
| --- | --- | --- | --- |
| FR-097 | The system shall preserve a fixed authored-content version for each presentation instance. | Must | Capture source, referenced local assets/data/components, notes, master, and template assignments at start. Later browser-editor/file changes require a new instance and never mutate an existing one or its exports. |
| FR-098 | The system shall disable authoring edits and hot reload on the presentation surface. | Must | A separate draft editor may continue editing/reloading without affecting live instances. Navigation, prepared demos/media, and temporary annotations remain presentation actions, not source edits. |
| FR-099 | The system shall provide a draft presentation master view whose shared-property edits update every draft slide, including descendants. | Must | Colors, fonts/sizes, background, logos/footers; themes are styling presets. Changes affect new instances and draft-based exports only; existing instances and their exports retain the captured master. |
| FR-100 | The system shall make every slide template inherit the presentation master's shared properties. | Must | Templates define per-slide content arrangement without silently overriding master styling. Master changes do not replace slide content or individual layout choices. |
| FR-101 | The system shall identify content that cannot be faithfully shared before starting linked local audience delivery or LAN sharing. | Must | Block that delivery or use a presenter-approved fallback identically on host/public views; never silently downgrade only viewers. Preserve private local presentation when sharing fails; the delivery mechanism remains subject to technical-design feasibility gates. |
| FR-102 | The system shall block normal presentation launch from an invalid draft or one with unresolved file conflicts. | Must | Show errors; warnings alone do not block. Explicit **Present last valid version** selects a retained coherent snapshot of source and dependencies, not merely cached HTML; preserve current edits/conflicts and recheck permissions/readiness. Disable the option if no usable snapshot remains. |
| FR-103 | The system shall use one captured input version for each export job. | Must | Live jobs capture the selected instance and relevant state/annotations/options at request; later edits or playback cannot change them. Rendered/converted draft jobs require valid, resolved input; raw source uses FR-064. Owner closure before an annotation-dependent output completes cancels those unfinished outputs; independent outputs and successfully committed files persist. |
| FR-104 | The system shall save surviving slide annotations with their creation reveal step and apply them only at that step or later. | Must | Final/continuous output shows all surviving marks; no stroke-history replay. Annotated dynamic content uses labeled static snapshots; clean/unmarked HTML retains supported interaction. Append final canvases in canonical slide order; omit laser/blackout/tool chrome. |

### Local Library, Pages View, and Output Boundaries

| ID | Requirement | Priority | Notes |
| --- | --- | --- | --- |
| FR-105 | The system shall show every app-created or opened deck in a local cover-card gallery, including decks saved outside the default directory. | Must | Search at least by title; cover is the first slide's static public-content preview or a safe placeholder if unavailable/invalid. Missing or denied files remain identifiable with relink or remove-from-library actions; removal never deletes files. No cloud or team-deck requirement. |
| FR-106 | The system shall open a selected deck in a pages view showing slide thumbnails in canonical node order with visible hierarchy, draft-opening controls, and a separate Present action. | Must | One fully revealed static thumbnail per node, not per reveal; draft changes refresh it. Covers/thumbnails include no notes or session annotations and trigger no authored-code execution or external requests; use static fallbacks/placeholders. Page selection does not launch presentation; Present starts at the first canonical state. |
| FR-107 | The system shall keep application chrome out of the projected/LAN stage and public rendered exports. | Must | The stage includes selected slide content and deliberate public presentation overlays (such as laser/blackout), but no library/cards/pages/editor/presenter chrome. Exports include authored master elements, explicitly saved annotations/canvas appendices, and an optional PDF TOC; private presenter HTML, raw source, and converted Markdown are distinct, labeled non-public outputs. |
| FR-108 | The system shall offer an optional linked table of contents in PDF export when the supported PDF renderer can produce it. | Should | Owner-requested, conditional feature: numbered hierarchical slide titles link to their first emitted PDF page in either reveal mode; TOC pages precede the deck. Default off preserves ordinary page counts. Disclose unsupported capability; a requested but unsupported TOC must not silently yield a TOC-free export. |

## 8. Non-Functional Requirements

| ID | Category | Target | Priority | Notes |
| --- | --- | --- | --- | --- |
| NFR-001 | Startup | Cold launch to first correctly rendered, usable slide p95 <= 3 seconds on the reference workload. | Must | Owner-accepted target; includes application startup and opening the local preview surface. Measured launching with the reference document path; no-path launch opens the library instead. |
| NFR-002 | Preview latency | Draft source edit to corresponding valid preview paint p95 <= 200 ms across the reference edit set. | Must | Owner-accepted target; text, equation, chart, diagram edits. Does not authorize hot reload during presentation. |
| NFR-003 | Navigation latency | Navigation input to the start of a valid visual transition p95 <= 100 ms across the reference sequence. | Must | Owner-accepted target; intentional transition duration is distinct from input latency. |
| NFR-004 | Motion | Target 60 fps at 60 Hz, with <= 1% dropped frames during the 60-second reference navigation, scrolling, and drawing run. | Must | The 60 fps goal is agreed; frame-drop measurement is the proposed operational definition. |
| NFR-005 | Save responsiveness | Persist eligible edits within 1 second after input settles; expose a detected save failure within 1 second. | Must | Proposed threshold; do not claim success before persistence completes. Conflicts require resolution rather than forced saving. |
| NFR-006 | Presenter synchronization | Linked same-machine views reflect navigation and visible mark updates with p95 <= 100 ms propagation latency. | Must | Proposed threshold; resynchronize current state after a view reconnects. |
| NFR-007 | Distribution size | Compressed core application download <= 100 MiB per platform, excluding authored assets and the user's installed PDF browser. | Should | Proposed lightweight budget, to be validated during technical design; disclose unpacked size too. |
| NFR-008 | Plain-deck overhead | A text-only exported presentation requires <= 1 MiB of compressed application JS/CSS, excluding fonts and authored assets. | Should | Proposed budget; technical content can add its own disclosed resources. Editor/library code should not burden exported reading. |
| NFR-009 | Export fidelity | All built-in-content fixtures have correct order and no unintended clipping, blank captures, or missing resources; ordinary text/code remain selectable in PDF. | Must | Live A still exports A after draft/master becomes B. Verify annotation step visibility, Save/Clear/Cancel/failure, canvas appendices, malformed source backup, and export-time isolation; static snapshots may apply to dynamic content, not whole text slides. |
| NFR-010 | PDF throughput | Reference 160-page reveal-expanded PDF completes within 60 seconds on the recorded reference machine. | Should | Proposed target; excludes installing a missing browser. Cancellation and useful error reporting must remain available. |
| NFR-011 | Offline privacy | Zero unapproved non-loopback network requests during local-only authoring, presentation, and offline export tests. | Must | Explicit live sharing permits only its scoped LAN audience traffic and requires no internet service; remote embeds still need separate permission. No telemetry, analytics, or implicit remote runtime downloads. |
| NFR-012 | Permission boundary | All security fixtures prevent unpermitted authored-code execution, external/file access, and private-note leakage. | Must | Test local author, LAN viewer, and exported-HTML recipient separately, including denial. Include hostile MDX/HTML/SVG, malicious references, private read/control/write attempts, public payload/asset inspection; loopback/ports alone are not security guarantees. |
| NFR-013 | Data integrity | Zero silent overwrites or corrupted acknowledged saves in conflict, permission-denied, full-disk, and application-crash fixtures. | Must | Preserve successfully saved source/artifacts; surface failures. No recovery guarantee for unsaved keystrokes, closed-session annotations, or failed hardware; annotation lifetime follows FR-062. |
| NFR-014 | Accessibility | Meet applicable WCAG 2.2 AA criteria for application controls, supplied themes, and reference HTML content, with complete keyboard journeys and manual assistive-technology checks. | Must | No critical/serious automated findings in fixtures; visible focus and required contrast. Automated checks alone do not establish conformance. Reduced motion is an additional explicit requirement. |
| NFR-015 | Portability | Pass launch, edit, local/LAN presentation, lint, PDF, and offline HTML acceptance journeys on the declared Windows, macOS, and Linux support matrix, without a separate language-runtime installation. | Must | All three OS families are agreed. Declare interface discovery and firewall prerequisites alongside OS/browser support; PDF may use installed compatible Chromium. |
| NFR-016 | Display support | No application-control overlap at 1280 x 720 and 1920 x 1080 desktop viewports; readable continuous HTML at 320 CSS-pixel width and 200% text zoom. | Must | Proposed verification sizes; preserve essential two-dimensional diagrams/tables with accessible navigation instead of destructive reflow. |
| NFR-017 | Extensibility | Demonstrate one reusable local React component in two decks without changing navigation or export orchestration, including a working static fallback. | Should | Proposed maintainability check aligned with the owner's motivation; no marketplace/SDK commitment. |
| NFR-018 | Deterministic output | Three repeated exports of unchanged reference input have identical node/reveal order, page counts, annotations, and static content. | Must | Input includes captured version, options, annotation set/step assignments, canvas appendices, and runtime/static representations. Ignore metadata timestamps; later time/random/network results are not export input. |
| NFR-019 | LAN verification | Pass all published-URL, presenter-follow, late-join, reconnect, and stop-sharing fixtures with two separate LAN client devices for each supported host OS. | Must | Proposed minimum coverage, not audience limit. Include occupied/exhausted ranges, concurrent sessions, interfaces, unavailable LAN, and private-access rejection; verify full public-state parity and frozen-content isolation. |
| NFR-020 | Live output fidelity | 100% agreement in public content, layout, and settled state across presenter/local/LAN views in reference fixtures after synchronization. | Must | Check widgets, code results, media, annotations, reconnects, and external source/asset edits during presentation. Uniform stage scaling is allowed, not independent reflow; reduced motion may suppress effects without changing content/state. LAN latency/media-skew thresholds remain Proposed until the test profile is fixed. |

## 9. Constraints & Assumptions

### Confirmed Decisions

Confirmed behavior includes the lightweight local application, Markdown-based MDX, recursive traversal, requested v1 features, standalone distribution, LAN access, a default local deck directory with selected-location overrides, a gallery/pages view, and chrome-free public presentation/export surfaces. The owner's latest clarifications require draft-only hot reload, fixed content during presentation, identical public output for viewers, and both a presentation master and per-slide templates. PDF table-of-contents behavior is conditional on renderer support. These coexist with proposed catalog details, safeguards, and performance targets; sections 5-8 are not a blanket approval of every detail.

Annotations are temporary until explicitly saved: exporting asks Save/Clear/Cancel, and closing a live instance loses unsaved marks without recovery. Reveal-step mapping, transactional clear, and canvas appendices specify this workflow without changing default unannotated export order.

Changes to confirmed scope, including reducing themes or deferring editor/comments, require owner approval. No fixed deadline was given; keyboard/mouse use is important. Formal document sign-off remains pending; priority and decision status are separate as defined above.

Recorded revisions: LAN audience sharing supersedes the original no-LAN restriction; authoritative local files replace browser-storage-only ownership. Private host capabilities remain loopback-only. Packaging must not require a separate language-runtime installation or bundle a PDF browser by default.

### Assumptions to Validate

| Assumption | Validation |
| --- | --- |
| Author owns or may use source/assets. | Import/export ownership notices and representative content. |
| Notes/control stay on host; audiences use projection or LAN. | Local and two-device LAN rehearsals, including private-data isolation. |
| Trusted, mutually reachable LAN; owner can permit inbound traffic. | Two-device tests and firewall/VPN/guest-network guidance; no automatic router/firewall changes. |
| Installed browser for editor/preview/audience; compatible Chrome/Edge/Chromium for PDF. | Per-platform startup/export checks. |
| Default composition is widescreen 16:9; other presets considered later. | Owner review of visual prototype. |
| Authored hierarchy/reveals are reproducible independently of arbitrary widget state. | Navigation and repeated-export fixtures. |
| No mandatory paid service, existing integration, or industry-specific compliance regime. | Owner review; revisit before connected services. |
| Source stays local unless explicitly exported; LAN sends only public content/assets, not private notes/source; external components need separate permission. | LAN payload, network, and artifact inspection, not reliance on the "local-first" label. |

No personal-data jurisdiction/residency obligation was stated. WCAG is a quality target, not established legal compliance. Font/media redistribution rights and embed terms still constrain exports.

## 10. Prior Art & Research

Documentation reviewed on 2026-09-21; no comparative benchmarks or exhaustive extension evaluation. Deckrun is the primary workflow reference, not authority to replace confirmed requirements with its defaults.

| Product / reference | Relevant evidence | Fit and limitation |
| --- | --- | --- |
| [Deckrun](https://github.com/arpitbbhayani/deckrun) | Local CLI/browser editor, preview, presentation, file autosave, presenter tools, lint, PDF/HTML; installed Chromium for PDF. | Primary inspiration. Node.js/npm installation, loopback-only serving, and possible CDN/companion-asset HTML dependencies do not satisfy our standalone distribution, LAN, or offline guarantees; MDX/React and recursive trees are unestablished. |
| [Slidev](https://sli.dev/guide/) | Markdown components/layouts, editor, KaTeX/Mermaid; [drawing/sync](https://sli.dev/features/drawing), [headless/reveal-step export](https://sli.dev/guide/exporting). | Strong common-feature alternative; Vue differs from our optional React content. Recursive alternating trees and the complete executable/library workflow are unestablished. |
| [reveal.js hierarchy](https://revealjs.com/markup/) | Horizontal main/vertical nested stacks; [horizontal, vertical, linear navigation](https://revealjs.com/vertical-slides/). | Opposite default axes; arbitrary-depth alternating trees are not documented. Not merely a rotated two-level deck. |
| [reveal.js scroll view](https://revealjs.com/scroll-view/) | Flattens both axes into reading flow; configurable snapping. | Supports two consumption modes; compatibility with the tree/reveal ordering defined in section 6 needs validation. |
| [reveal.js speaker view](https://revealjs.com/speaker-view/) | Separate notes, next preview, clocks/timers, optional printed notes. | Useful conventions; hiding notes does not remove them from artifacts. |
| [Marp](https://marp.app/) | CommonMark, directives, CSS themes, editor tools, browser-rendered HTML/PDF/PPTX. | Smaller conversion/static-portability alternative; complete recursive interactive workflow not established. |
| [Quarto Revealjs](https://quarto.org/docs/presentations/revealjs/) | Scientific computed output/figures, code highlighting, notes, incremental content, themes; PDF shows only a tabset's first tab. | Relevant to data scientists; computed Python/R differs from live JavaScript/React. Hidden interactive content needs export rules. |

### Formats, Standards, and Platform Constraints

- [MDX](https://mdxjs.com/docs/what-is-mdx/): Markdown plus optional capabilities and syntax caveats in section 5; execution-permission/conversion limits concern added content, not file extension.
- [CommonMark](https://spec.commonmark.org/): portable Markdown baseline; slide boundaries, hierarchy, notes, reveals, and component syntax require a documented contract in technical design.
- [KaTeX functions](https://katex.org/docs/supported.html): equation compatibility boundary, not full TeX; potentially dangerous HTML commands are disabled by default.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/): keyboard, focus, contrast, text alternatives, readable documents, controllable motion. Reduced motion remains required beyond applicable AA checks.
- [Browser storage](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria): quotas, clearing, eviction, and port-scoped origins justify authoritative files independent of browser profile/port.

### Build / Adopt Conclusion

The original discovery left adoption versus custom implementation open. The companion technical design now records the owner-selected Bun + Astro + TypeScript/islands direction, with custom orchestration and established content renderers; Deckrun remains a workflow reference, not a selected fork. Discovery does not duplicate stack details. Packaging, live output delivery, code isolation, durable saves, session lifetime, and export fidelity remain unproven gates (G-01 through G-06) in that draft design; stack selection alone does not approve the full design.

## 11. Suggestions & Opportunities

- **Source safeguards (proposed Must)**: conflict protection, portable settings, visible save failures for dual-editor use.
- **Delivery privacy**: physically remove private data from public/LAN output; warn that private presenter files expose notes to recipients.
- **Explicit sharing**: distinguish private/audience URLs, interfaces, and ports; provide stop-sharing without firewall changes or implicit embed permission.
- **Hierarchy clarity**: parent navigation, numbering, quick-jump outline; test deep paths and long labels.
- **Preflight**: overflow, missing fonts/media, denied permissions, unsupported equations, and absent fallbacks before talks/exports.
- **Presenter extras (suggested Should, no FR yet)**: elapsed timer and next-slide preview later in v1 if practical; add numbered Should requirements if accepted. Not Must additions.
- **Mode separation (confirmed Must)**: draft-only editing/hot reload; active content/design stays frozen until presentation ends. No optional in-place publishing control.
- **Scientific charts (Could)**: histograms, box plots, heatmaps beyond the six-type commitment.
- **Reproducible demos**: stable defaults/static representations for code, asynchronous data, and media, not incidental widget state.
- **Verification sequence**: prove traversal, mode isolation, master inheritance, shared-output fidelity, cross-platform launch, permissions, and exports before catalog breadth; do not drop agreed themes/features.
- **Keep cuts**: retain section 5 non-goals, including Python/R, cloud collaboration, public broadcasting, remote control, marketplace, and a freeform object-placement editor. Read-only LAN viewing stays in scope.

## 12. Risks & Open Questions

### Risks and Failure Modes

| Risk / consequence | Response / validation |
| --- | --- |
| Full scope: large downloads, slow rendering, long delivery | Separate startup/plain-deck/rich-content budgets; no promised deadline. |
| Flattened tree: wrong arrows, missing descendants, misordered exports | Section 6 fixture plus deep branches/boundaries. |
| Reveal expansion: large/slow PDFs | Report page count; all states by default, final-only is a Should option (FR-070). |
| Failing/malicious code: freezes, data leaks, unsafe access | Separate execution/network/file permissions, isolation and resource limits; permission is not proof of safety or transferable device consent. |
| Draft/master edits or new strokes leak into a live export | Capture live inputs at request; only a new instance uses draft changes. Save/Clear affects captured marks, not newer strokes. |
| Export/close loses annotations unexpectedly | Explicit Save/Clear/Cancel; save completion before closing; failed/canceled jobs preserve open-session marks. No recovery after instance ends. |
| Marks appear before their content or drift across dynamic output | Record creation reveal step, snapshot annotated dynamic content, and save blank canvases as labeled appendices. |
| Invalid draft silently launches an older preview | Block normal launch; require explicit selection of a retained validated version, preserving current edits/conflicts. |
| Widgets, media, time/random results diverge between viewers | Match public output/state; preflight unsupported content, common fallback or block, and measure delivery delay/media skew. |
| Slide layouts override master properties | Test master edits across every slide template and output without replacing individual content/layout choices. |
| Blocked/unavailable/authenticated embeds: broken/offline claims | Permission and author fallback; no universal embedding or remote-service offline guarantee. |
| Fonts/codecs/delays: layout drift, empty media, incomplete captures | Preflight, explicit rendering readiness, unsupported-resource errors. |
| Concurrent edits/interrupted saves: lost source work | Conflict protection, acknowledged-save integrity, and source recovery tests; unsaved annotations still follow FR-062. |
| Notes/source/comments leak through public/LAN delivery | Inspect all payloads/files; deny private read/control/write access, not just hide UI. |
| Port collisions/exhaustion/concurrency: failed launch or wrong URL | Successful bind before advertising; bounded retries; preserve listeners. |
| Interfaces/IP changes/firewalls/VPNs/guest isolation: unreachable URLs | Approved interfaces, refreshed/invalidated stale URLs, connection guidance; discovery is not a reachability guarantee. |
| Shared/unintended network access: unwanted readers retaining content | Approved interfaces, clear sharing state; public content can be retained. Plain HTTP is not confidential; LAN is not authentication. |
| Input collisions/inertia: skipped slides while drawing/editing/chart interaction | Input ownership, deliberate gesture boundaries, keyboard equivalents. |
| OS packaging differences: warnings, browser prerequisites, startup failure | Tested support matrix, installation/export diagnostics, signing/notarization assessment. |
| Restore/window lifecycle confusion: premature annotation loss or retention | Owner close/end/application exit discards unsaved marks; viewer reconnect does not. Reopened sessions cannot recover them; this is not forensic secure erasure or revocation of saved/received copies. |
| Inaccessible themes/content: unreadable projection or unusable controls | Validate supplied themes/controls; report author-content issues, not blanket imported-content compliance. |

### Decisions Still Needed

- [ ] Formal owner approval, including proposed safeguards, catalogs, and numeric thresholds.
- [ ] Final product name and named owner.
- [ ] OS versions, CPU architectures, browsers, native prerequisites; all three OS families remain required. Includes whether live presenting (scoped stage capture) and rendered lint may require an installed desktop Chromium, beyond the accepted PDF prerequisite.
- [ ] Default presentation-port range, interface selection, LAN audience-size/latency/media-skew profile; automatic range allocation, IP URLs, and complete public-output parity remain required.
- [ ] Reference hardware and frozen performance/export-fidelity fixtures covering meaningful theme/template/content combinations.
- [ ] Hierarchy, notes, reveal, block, presentation-master, and slide-template syntax; behavior is specified, notation remains technical design.
- [ ] Packaging feasibility and signing/notarization; no assumed undisclosed paid-service budget.
- [ ] JavaScript/React permission lifetime (Proposed: an authored-code execution, network-origin, or file-capture grant lasts only for its draft session or presentation instance, is never persisted, and never travels in source or exports; persisted library file/directory selections are separate), execution limits, and fallback/delivery contract meeting live parity without unapproved viewer-side code; no blanket guarantee for unbounded code.
- [ ] Font/media catalog and redistribution rights; licensing review not yet performed.

Resolve technical questions in technical design with focused feasibility checks, without reopening scope. Material behavior changes require owner approval.

## 13. Glossary

| Term | Meaning |
| --- | --- |
| Deck | Source plus assets/settings, viewed as slides or a continuous document. |
| Slide node | Content-bearing tree position, optionally with children. |
| Main slide | Top-level node in the vertical sequence. |
| Detail / child slide | Nested explanation, such as `2.1` or `2.1.1`. |
| Depth-first preorder | Node, all descendants, next sibling; return through ancestors without redisplaying them. |
| Directional navigation | Sibling/branch movement on alternating axes, distinct from Next/Previous. |
| Reveal state | Visible step, including initial state; not a separately authored slide. |
| Canonical presentation sequence | Every node's ordered reveal states in depth-first preorder. |
| Annotation snapshot | Surviving slide/canvas marks and comment visibility captured at export request; not stroke history or later edits. |
| Presentation master | Deck-wide shared styling/background/elements, editable in draft mode and inherited by all slides. |
| Slide template | Per-slide content layout, such as two/three columns or picture/text; inherits master styling. |
| Theme | Palette/typography preset applied through the presentation master. |
| Draft mode | Creation/editing with live preview and hot reload. |
| Presentation mode | Fixed authored-content session with playback/navigation and temporary annotations, not authoring edits. |
| Presentation instance / live instance | One started presentation with its own captured version, annotations, and owner lifetime; it can be local-only or LAN-shared. Only LAN sharing binds an audience port; stopping sharing does not end the instance. |
| Public presentation output | Audience-visible content, layout, and runtime state; excludes private notes and presenter controls. |
| MDX | Markdown plus optional JSX, expressions, imports/exports; documented syntax rules still apply. |
| Executable slide content | Authored JavaScript/React, not the application launcher. |
| Code-execution permission | A user's permission to run document-supplied code on their device; separate from network/file permission, not needed for passive Markdown. |
| External embed | Content from another site, such as a video/demo. |
| Local-first | Local ownership/authoring, opt-in cloud-free LAN sharing, other external connections permissioned; not browser-only persistence. |
| Loopback | Same-machine access at `127.0.0.1` for private authoring/control, separate from LAN delivery. |
| LAN audience URL | Approved host IP plus actual presentation port; routing/firewalls govern reachability. |
| Presentation-port range | Configurable inclusive port range from which each LAN-shared instance binds one distinct audience port; not an IP range. |
| Offline HTML bundle | HTML/local assets independent of authoring app/remote services; local server may be needed. |
| Static fallback | Declared noninteractive substitute for unavailable live code/media/remote content. |
| Presenter-ready export | Private HTML with notes/tools; not audience-safe. Original source and converted Markdown are also not guaranteed public-safe. |
| Owning session | Draft session or individual live instance owning temporary marks. Owner close/reload/end/application exit, or owner-contact loss beyond the proposed reconnect window, discards unsaved marks without recovery; audience disconnect, transient owner disconnect, and in-document view changes are not session end. |

The companion technical design already exists as a draft. After explicit requirements/design approval and resolution of blocking feasibility gates, refine acceptance criteria as needed and create implementation work items; this document does not itself authorize implementation.