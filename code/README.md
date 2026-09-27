# Local slides

A local-first slide editor and presenter built with Astro, TypeScript, Bun, and ECharts. The Bun host serves the owner UI on loopback, writes deck source to local `.md`/`.mdx` files, and can open a separate read-only audience listener on a selected LAN interface. See [STATUS.md](STATUS.md) for implemented, limited, deferred, and unverified features.

## Run

Install Bun, then from this directory run the integrated development server:

```powershell
bun install
bun run dev
```

Open the `http://127.0.0.1:4321` URL printed as **Slides development** (or the printed port if `SLIDES_DEV_PORT` is set). This starts Astro with browser live reload and the loopback Bun API together, without a build. The UI shows a **DEV MODE** badge. API source edits hot-reload the Bun host automatically; reload the page after an API reload to obtain a fresh owner token, and save any draft first. Stop both servers with Ctrl+C. Running `astro dev` alone does not provide the application API.
The integrated command can run alongside another Astro dev server on a different port; use `SLIDES_DEV_PORT` to choose one if needed. LAN sharing in dev mode uses audience assets from the most recent `bun run build`; build once before testing LAN sharing.

For a built run without the development badge:

```powershell
bun run build
bun run start
```

Open the loopback URL printed by the host on the same machine. Keep the Bun process running while editing or presenting. For development checks, run `bun run check`, `bun run build`, `bun run test`, and `bun run test:e2e` (requires the Playwright Chromium browser; install it with `bunx playwright install chromium` if missing). No cloud account, export pipeline, or CI is configured.

The library can create a starter deck from a presentation name: `Test Presentation` becomes `Test-Presentation.md`, while the deck title remains `Test Presentation`. Spaces in new filenames become hyphens; enter a `.mdx` suffix to use that format instead of `.md`. Opened files without a title (or with the starter placeholder `Untitled presentation`) display their filename without its extension as the title. Use the pencil beside the title in the editor and press Enter to set an independent title in the source. The library can also open an existing absolute `.md`/`.mdx` file path, hide an entry without deleting its file, or relink a moved file.

By default the catalog (`.slides-library.json`) and newly created decks live in the home directory's `.slides` folder (on Windows, `%USERPROFILE%\.slides`), independent of this checkout. On startup the bundled example image is copied once to `.slides\assets\sample-landscape.svg` (or the configured library folder's `assets` directory); it is not overwritten if changed. Opening an existing deck elsewhere registers its absolute path in the catalog without moving the file. Set `SLIDES_LIBRARY` to an absolute path before starting the app to use a different folder (including for tests). On the first run without that override, decks and catalog entries from the old `code\library` folder are copied into `.slides`; external files remain at their original locations, and the old folder stays in place as a backup. If a deck in `.slides` has the same name but different contents, import stops with an error rather than overwriting either copy. Stop any older app process before upgrading. Save edits before presenting. Invalid source remains editable and reports diagnostics; presentation requires a current valid compiled deck.

## Deck source

The source is **declarative Markdown/MDX**, not executable MDX. Deck options live in YAML frontmatter. Each `::slide` directive has a stable ID; `parent` makes a nested section, and `layout` selects a supported layout. Body text accepts Markdown, fenced code, KaTeX math, a bounded Mermaid subset, and inline JSON charts. For example:

````markdown
---
slides:
  formatVersion: 1
  title: Example
  master:
    theme: signal
---

::slide{id="opening" layout="title-content"}
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

Use `:::slot{name="..."}` for layout-specific regions. Layouts: `blank`, `title-content`, `two-columns`, `three-columns`, `picture-text`. Themes: `signal`, `paper`, `midnight`, `forest`. Master settings are grouped by Theme, Heading, Body, Code, Placements, Margins, and Padding. Heading placement (`left`, `center`, `right`) aligns slide headings; each margin and padding side takes a number from 0 to 20 (CSS percentages of available width). Margins inset the slide content; padding adds space inside the content area. The compact settings view shows one live stage with a selectable list of 17 representative compositions using the five supported layouts: blank, title/subtitle, headings and content, two or three columns, images paired with text or other images, image-only, table, code, chart, diagram, and equation. Samples do not add slides or introduce new selectable layouts. The included image can also be used in an authored slide with `![Landscape](assets/sample-landscape.svg)`; other image paths still show an unavailable-image fallback (arbitrary local images remain unsupported). Slide layout types appear above both the sample stage and each normal editor preview without an enclosing card. Six metadata positions (top/bottom × left/center/right) can show the slide number / total, presentation title, slide title, footer text, logo text, or nothing. Configure slide numbers with a position selector; the old footer-number checkbox is no longer displayed. Existing `footerNumber: true` still shows the count at bottom right unless overridden there; footer text defaults to bottom left. Renaming one `::slide` ID in the source automatically updates its `parent` references and any `slides.layouts` key, then autosaves the resulting source; prose and code fences are left unchanged. Add child slide inserts after the highlighted slide's descendants; Add slide inserts a root slide after the highlighted top-level section. Both actions select the new slide and place the source caret at its directive, first bringing previously displaced slide blocks into outline order if needed. The preview supports direct edits to plain-text paragraphs when source is valid; edit Markdown structure and rich content in the source pane. Code fences display highlighted code but never run it; JSX, imports, and custom components are not supported.

## Present and share

Start a presentation from a valid saved deck. Presenter controls include slide/reveal navigation, notes, a timer, pointer, drawing, blank canvas, blackout, and a local audience window. The audience URL is read-only; it receives a sanitized projection of the frozen deck and live presentation state, not speaker notes, local file paths, or the owner token. Audience reconnect requests current state. Ending a talk with ink requires explicit confirmation to discard the marks.

To share over LAN, enter the machine's specific LAN address and a permitted port range in the presenter UI. The host starts a separate audience-only listener and returns its URL; allow that port through local firewall settings as needed. Reachability from another device is **not automatically verified**. Share links grant view access to the current session; use a trusted network, avoid posting the URL publicly, and stop sharing/end the session when finished. Owner editing/API access remains bound to loopback.

Save is enabled only while the deck has unsaved changes (including before autosave finishes). The Export dropdown is visible in editor and presenter modes with disabled PDF and HTML options; export is deferred by design. See [ASSUMPTIONS.md](ASSUMPTIONS.md) for scope decisions and [STATUS.md](STATUS.md) for evidence gaps.
