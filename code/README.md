# Local slides

A local-first slide editor and presenter built with Astro, TypeScript, Bun, and ECharts. The Bun host serves the owner UI on loopback, writes deck source to local `.md`/`.mdx` files, and can open a separate read-only audience listener on a selected LAN interface. See [STATUS.md](STATUS.md) for implemented, limited, deferred, and unverified features.

## Run

Install Bun, then from this directory run:

```powershell
bun install
bun run build
bun run start
```

Open the loopback URL printed by the host on the same machine. Keep the Bun process running while editing or presenting. `bun run dev` serves the Astro frontend for UI work; it does not replace the Bun host or its APIs. For development checks, run `bun run check` and `bun test`. No cloud account, export pipeline, or CI is configured.

The library can create a starter deck, open an existing absolute `.md`/`.mdx` file path, hide an entry without deleting its file, or relink a moved file. The local library index is stored under `library/`; the deck source stays at its chosen filesystem location. Save edits before presenting. Invalid source remains editable and reports diagnostics; presentation requires a current valid compiled deck.

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
