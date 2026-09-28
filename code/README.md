# Local slides

A local-first slide editor and presenter built with Astro, TypeScript, Bun, and ECharts. The Bun host serves the owner UI on loopback, writes deck source to local `.md`/`.mdx` files, and can open a separate read-only audience listener on a selected LAN interface. See [STATUS.md](STATUS.md) for implemented, limited, deferred, and unverified features.

## Run

Install Bun, then from this directory run the integrated development server:

```powershell
bun install
bun run dev
```

Open the URL printed as **Slides development** (normally `http://127.0.0.1:4321`; another free port if 4321 is busy). This starts Astro with browser live reload and the loopback Bun API together, without a build. The UI shows a **DEV MODE** badge. API source edits hot-reload the Bun host automatically. A backend restart rotates the owner token and ends active presentation sessions; the next owner request refreshes the token once, and End returns to the editor if the session has already gone away. Save drafts before editing backend code, and start a new presentation after a restart. Stop both servers with Ctrl+C. Running `astro dev` alone does not provide the application API.
The integrated command can run alongside another Astro dev server on a different port; set `SLIDES_DEV_PORT` to require a specific free port. LAN sharing in dev mode uses audience assets from the most recent `bun run build`; build once before testing LAN sharing. **Share on LAN** offers the machine's non-loopback IPv4 interfaces (loopback such as `127.0.0.1` cannot reach other devices) and one port; if it is busy, the next free port up to 100 higher is used. Each LAN audience tab can set an optional name (saved in that browser; blank shows as `Guest`, at most 40 characters). While sharing, everyone sees connected viewers as initial-letter circles with the name on hover; only the presenter's hover also shows the viewer's IP. Viewers drop off five seconds after their tab stops polling. Names are self-reported and unverified. The local Audience window is not counted.

For a built run without the development badge:

```powershell
bun run build
bun run start
```

Open the loopback URL printed by the host on the same machine. Keep the Bun process running while editing or presenting. For development checks, run `bun run check`, `bun run build`, `bun run test`, and `bun run test:e2e` (requires the Playwright Chromium browser; install it with `bunx playwright install chromium` if missing). No cloud account, export pipeline, or CI is configured.

The library can create a starter deck from a presentation name: `Test Presentation` becomes `Test-Presentation.mdx`, while the deck title remains `Test Presentation`. Spaces in new filenames become hyphens; enter a `.md` suffix to use that format instead of the default `.mdx`. Opened files without a title (or with the starter placeholder `Untitled presentation`) display their filename without its extension as the title. Use the pencil beside the title in the editor and press Enter to set an independent title in the source. The library can also open an existing absolute `.md`/`.mdx` file path, hide an entry without deleting its file, or relink a moved file. The library shows **Your presentations** and **Feature tours** separately. **Explore latest feature tour** opens the bundled edition in the feature-tour folder. When the bundle changes, an unchanged installed copy is updated and other provably unchanged obsolete copies are removed. An unchanged numbered copy moves back to `Slides-Feature-Tour.mdx` when that name is free. Edited tours are preserved; a numbered copy is used if the canonical filename belongs to an edited tour. The editable deck shows sections, layouts, images, code, terminal commands, cards, callouts, highlights, tables, charts, Mermaid, math, notes, reveals, and per-slide metadata. The bundled source is `public\feature-tour.mdx`; older unchanged `.md` tour copies are recognized and renamed; the app does not expose its source over the audience listener.

By default personal decks are created under `%USERPROFILE%\Presentations` (or `~/Presentations`), while app-managed tour copies, the catalog (`.slides-library.json`), and bundled assets live under `%USERPROFILE%\.slides`: tours in `.slides\feature-tours` and the sample image in `.slides\assets`. The example image is copied once and never overwritten if edited. Opening a deck outside the default folders registers its path without moving it. Set `SLIDES_LIBRARY` to an absolute path to use a different app-data folder; with this override, personal decks are placed in its `presentations` subfolder and tours in its `feature-tours` subfolder, keeping test and portable libraries self-contained. On first startup after upgrading, decks previously stored directly in `.slides` move safely into these separate folders; catalog entries and hidden status are retained. The earlier copy-first import from `code\library` still preserves that repository directory as a backup. If a destination contains different content, migration stops without overwriting either file; resolve the conflict before restarting. Stop any older app process before upgrading. Save edits before presenting. Invalid source remains editable and reports diagnostics; presentation requires a current valid compiled deck.

## Deck source

The source is **declarative Markdown/MDX**, not executable MDX. Deck options live in YAML frontmatter. Each `::slide` directive has a stable ID; `parent` makes a nested section, and `layout` selects a supported layout. Body text accepts Markdown, fenced code, KaTeX math, a bounded Mermaid subset, and inline JSON charts, plus the static built-in components described below. For example:

````markdown
---
slides:
  formatVersion: 1
  title: Example
  master:
    theme: signal
    metadata:
      metadataBottomRight: "none"
      metadataBottomCenter: "slideNumber"
---

::slide{id="opening" section="Introduction" layout="title-content" metadataBottomRight="none"}
# Opening

A **local** presentation.

:::notes
Private speaker notes.
:::

:::reveal{step="1"}
This appears after the first advance.
:::

```chart
{"type":"bar","labels":["Before","After"],"series":[{"name":"Count","data":[2,5]}]}
```
````

Built-in components render static HTML only: attributes are plain quoted strings, and anything else (other tags, `{expressions}`, spread props, imports) is a source diagnostic. Put block tags on their own lines; their content is ordinary Markdown.

````mdx
<Cards>
<Card title="Write">
Plain **Markdown** inside every card.
</Card>
</Cards>

<Callout type="tip" title="Optional title">
`type` is `note` (default), `tip`, or `warning`.
</Callout>

Inline <Mark note="optional note">highlighted text</Mark> with a visible note.

```typescript title="slides.ts" showLineNumbers {2,4-5}
// filename header, language badge, line numbers, highlighted lines 2 and 4-5
```

```terminal title="Setup"
$ bun install
Lines starting with "$ " are commands; the others are output.
```
````

Speaker notes are stored inside each deck's `.md` or `.mdx` file, between `:::notes` and `:::` under the relevant `::slide` (as above). The installed tour is normally `%USERPROFILE%\.slides\feature-tours\Slides-Feature-Tour.mdx`; a numbered copy is retained if that filename belongs to a user-edited tour. Notes are visible only in the presenter's **Speaker notes** panel, not on the slide or in the audience view. The tour button opens the current edition without overwriting edited copies.

Use `:::slot{name="..."}` for layout-specific regions. Layouts: `blank`, `title-content`, `two-columns`, `three-columns`, `picture-text`, `title-image-left`, `title-image-right`, and `image-full`. The two title-image layouts put Markdown heading/subtitle text in one half and an `image` slot in the other; the bundled image fills the full height of its half. `image-full` fills the entire 16:9 slide from an image in the body (cropping as needed). For example, `::slide{id="cover" layout="title-image-left"}` with `# Title` followed by `:::slot{name="image"}`, `![Landscape](assets/sample-landscape.svg)`, and `:::`. The same image can fill an entire slide via `::slide{id="photo" layout="image-full"}` followed by that image Markdown. The sample gallery groups 21 examples into collapsible types, including multiple title, content, image, bar/line/donut chart, table, code, diagram, and math compositions. Samples do not add slides to a deck.

The normal outline and preview group **adjacent** slides into collapsible sections without reordering them or changing `parent`-based slide navigation and insertion. Set `section="Introduction"` on each desired `::slide`, or use **Section and slide metadata** above the preview to edit the name; a blank section input chooses a slide-type category automatically. Repeating a section name later creates a new contiguous group rather than moving slides across the deck. Six metadata positions (top/bottom × left/center/right) can show the slide number / total, presentation title, slide title, footer text, logo text, or nothing. They are stored under `slides.master.metadata` as shown above; existing flat `slides.master.metadataBottomRight`-style fields remain readable and move into the subsection when edited in settings. Define an override on a slide directive, such as `metadataBottomRight="none"` or `metadataTopCenter="slideTitle"`, to replace the master position for **that slide only**. Choose **Inherit master setting** in its slide settings to remove the override. Defining the same master position both flat and nested reports a diagnostic; invalid section names and metadata values also report diagnostics. Configure slide numbers with a position selector; the old footer-number checkbox is no longer displayed. Existing `footerNumber: true` still shows the count at bottom right unless overridden there; footer text defaults to bottom left. These slide options persist in the source and also apply to presenter and audience views.

Themes: `signal`, `paper`, `midnight`, `forest`. Master settings are grouped by Theme, Heading, Body, Code, Placements, Margins, and Padding. The active Master settings button is highlighted in the outline while the source/split/preview buttons are deselected; selecting a slide or adding one returns to the editor. Heading placement (`left`, `center`, `right`) aligns slide headings; each margin and padding side takes a number from 0 to 20 (CSS percentages of available width). Margins inset the slide content; padding adds space inside the content area. The included image can also be used in an authored slide with `![Landscape](assets/sample-landscape.svg)`; other image paths still show an unavailable-image fallback (arbitrary local images remain unsupported). Slide layout types appear above both the sample stage and each normal editor preview without an enclosing card. Renaming one `::slide` ID in the source automatically updates its `parent` references and any `slides.layouts` key, then autosaves the resulting source; prose and code fences are left unchanged. Add child slide inserts after the highlighted slide's descendants; Add slide inserts a root slide after the highlighted top-level section. Both actions select the new slide and place the source caret at its directive, first bringing previously displaced slide blocks into outline order if needed. The preview supports direct edits to plain-text paragraphs when source is valid; edit Markdown structure and rich content in the source pane. Code fences display highlighted code but never run it; JSX, imports, expressions, and components other than the static built-ins are not supported. Tables have bold headers and alternating rows; the master Mermaid example uses a larger vertical flowchart for legibility.

The home screen groups new/open actions beside the feature-tour introduction rather than repeating a library title in the header. The editor and slides use system UI fonts by default; code uses the system monospace font. In **Master settings**, choose **Browse installed fonts** to grant the browser access to local font families, then select a heading, body, or code font from the lists. After permission is granted once, the lists refill automatically each time Master settings opens. This needs a browser with Local Font Access support (Chromium-based, such as Edge or Chrome) and permission from the user; if unavailable or denied, system defaults and existing saved font selections remain usable. Font names are saved in the deck source, but another device needs the same fonts installed to render them identically. Size controls offer 12–120 and margin/padding controls offer 0–20 as dropdowns. Existing fractional values remain selected as saved options and can still be edited in the source.

## Present and share

Start a presentation from a valid saved deck. Presenter controls include slide/reveal navigation, notes, a timer, pointer, drawing, blank canvas, blackout, and a local audience window. The audience URL is read-only; it receives a sanitized projection of the frozen deck and live presentation state, not speaker notes, local file paths, or the owner token. Audience reconnect requests current state. Ending a talk with ink requires explicit confirmation to discard the marks.

To share over LAN, enter the machine's specific LAN address and a permitted port range in the presenter UI. The host starts a separate audience-only listener and returns its URL; allow that port through local firewall settings as needed. Reachability from another device is **not automatically verified**. Share links grant view access to the current session; use a trusted network, avoid posting the URL publicly, and stop sharing/end the session when finished. Owner editing/API access remains bound to loopback.

Theme, view selection, Save, Present, and Export form one editor toolbar that wraps together on narrow screens. Save is enabled only while the deck has unsaved changes (including before autosave finishes). The Export dropdown is visible in editor and presenter modes with disabled PDF and HTML options; export is deferred by design. See [ASSUMPTIONS.md](ASSUMPTIONS.md) for scope decisions and [STATUS.md](STATUS.md) for evidence gaps.

Gallery images, charts, and Mermaid diagrams are sized to fit inside the 16:9 settings preview; these gallery-specific limits do not change authored slide or presentation rendering. In presenter and audience views, a standalone Mermaid diagram uses the space remaining beneath its heading and above the footer rather than a height based on browser width.
