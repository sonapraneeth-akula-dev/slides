# Local slides

A local-first slide editor and presenter built with Astro, TypeScript, Bun, and ECharts. The Bun host serves the owner UI on loopback, writes deck source to local `.md`/`.mdx` files, and can open a separate read-only audience listener on a selected LAN interface. See [STATUS.md](STATUS.md) for implemented, limited, deferred, and unverified features.

## Run

Install Bun, then from this directory run the integrated development server:

```powershell
bun install
bun run dev
```

Open the `http://127.0.0.1:4321` URL printed as **Slides development** (or the printed port if `SLIDES_DEV_PORT` is set). This starts Astro with browser live reload and the loopback Bun API together, without a build. The UI shows a **DEV MODE** badge. API source edits hot-reload the Bun host automatically; reload the page after an API reload to obtain a fresh owner token, and save any draft first. Stop both servers with Ctrl+C. Running `astro dev` alone does not provide the application API.
Stop any separately running Astro dev server in this project before starting the integrated command. LAN sharing in dev mode uses audience assets from the most recent `bun run build`; build once before testing LAN sharing.

For a built run without the development badge:

```powershell
bun run build
bun run start
```

Open the loopback URL printed by the host on the same machine. Keep the Bun process running while editing or presenting. For development checks, run `bun run check`, `bun run build`, `bun run test`, and `bun run test:e2e` (requires the Playwright Chromium browser; install it with `bunx playwright install chromium` if missing). No cloud account, export pipeline, or CI is configured.

The library can create a starter deck from a presentation name: `Test Presentation` becomes `Test-Presentation.md`, while the deck title remains `Test Presentation`. Spaces in new filenames become hyphens; enter a `.mdx` suffix to use that format instead of `.md`. The library can also open an existing absolute `.md`/`.mdx` file path, hide an entry without deleting its file, or relink a moved file. The local library index is stored under `library/`; the deck source stays at its chosen filesystem location. Save edits before presenting. Invalid source remains editable and reports diagnostics; presentation requires a current valid compiled deck.

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

Use `:::slot{name="..."}` for layout-specific regions. Layouts: `blank`, `title-content`, `two-columns`, `three-columns`, and `picture-text`. Themes: `signal`, `paper`, `midnight`, and `forest`. Master settings in the editor update theme, colors, typography, spacing, and footer fields in source. The preview supports direct edits to plain-text paragraphs when source is valid; edit Markdown structure and rich content in the source pane. Code fences display highlighted code but never run it; JSX, imports, and custom components are not supported.

## Present and share

Start a presentation from a valid saved deck. Presenter controls include slide/reveal navigation, notes, a timer, pointer, drawing, blank canvas, blackout, and a local audience window. The audience URL is read-only; it receives a sanitized projection of the frozen deck and live presentation state, not speaker notes, local file paths, or the owner token. Audience reconnect requests current state. Ending a talk with ink requires explicit confirmation to discard the marks.

To share over LAN, enter the machine's specific LAN address and a permitted port range in the presenter UI. The host starts a separate audience-only listener and returns its URL; allow that port through local firewall settings as needed. Reachability from another device is **not automatically verified**. Share links grant view access to the current session; use a trusted network, avoid posting the URL publicly, and stop sharing/end the session when finished. Owner editing/API access remains bound to loopback.

Export buttons remain visible but inactive by design. See [ASSUMPTIONS.md](ASSUMPTIONS.md) for scope decisions and [STATUS.md](STATUS.md) for evidence gaps.
