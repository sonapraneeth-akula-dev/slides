# Charting proposal (2026-09-26)

**Decision:** The owner chose Apache ECharts for now. This spike records a
tested alternative, not the selected MVP chart stack.

## Recommendation

**Try Nivo's SVG React components for built-in charts; do not replace ECharts in the draft design yet.** Astro has an official [React integration](https://docs.astro.build/en/guides/integrations-guide/react/) and [islands](https://docs.astro.build/en/guides/framework-components/), but no built-in chart catalog. Keep the page shell and text-only exports in Astro with no React payload; load the trusted chart island only on pages containing interactive charts. This is a better *React/Astro integration fit* than ECharts, not a claim that Nivo is universally faster or smaller.

| Candidate | Fit for this product | Verdict |
| --- | --- | --- |
| Astro native HTML/SVG | No chart dependency, ideal for static illustrations. Six interactive chart types, hover, and static representations would become application code. | Use native elements for simple blocks, not a second chart engine. |
| [Recharts](https://recharts.github.io/en-US/examples/) | Familiar React API; line/bar/area/scatter/pie/donut and interaction. | **Not as-is:** with Recharts 3.10.1, the Astro 7.3.3 static build emitted empty `.recharts-wrapper` containers for all six charts, with no SVG before hydration. PDF/no-JS needs an additional static renderer or a proven alternative render path. |
| [Nivo SVG](https://nivo.rocks/about/) | React components with server-rendered SVG; line, bar, scatter and pie cover all six catalog types (area/donut are options). Optional [box plot](https://nivo.rocks/boxplot/) and [heat map](https://nivo.rocks/heatmap/) packages exist for later. | **Prototype choice.** Explicit fixed dimensions produce usable SVG without client JS; hydration adds hover and selection. Avoid Nivo Canvas for required static SVG exports. |
| [visx](https://airbnb.io/visx/) | React/D3 low-level primitives offer maximal custom control. | More custom interaction, axis, and export logic than the six-type requirement warrants. |
| [ECharts](https://echarts.apache.org/handbook/en/how-to/cross-platform/server/) | Framework-independent alternative with SVG and mature interaction. | Retain as fallback if Nivo misses the performance, portability, or output gates. A React wrapper around ECharts does not make it React-native. |

## Runnable evidence

`chart-spike\` is a **separate disposable prototype**, not application source. From this directory, run:

```powershell
cd chart-spike
bun install --frozen-lockfile
bun run check
bun run build
bun run test
```

The smoke test uses an installed Edge or Chrome (no browser downloaded). The 2026-09-26 run used Astro 7.3.3, `@astrojs/react` 6.0.6, React 19.3.0, Nivo 0.99.0, Bun 1.4.2, and Edge on Windows. `astro check` passed with zero errors or warnings; the static build and browser smoke test passed.

| Requirement/question | Prototype observation |
| --- | --- |
| Six Must chart types | Line, bar, area, scatter, pie, donut all generated SVG in static Astro HTML; Edge selected data from the chart in all six. Hover details were exercised on a bar. An accessible data table and keyboard-selectable values accompany every SVG. Full accessibility testing remains open. |
| Local sources and unsafe labels | Quoted-comma CSV, local JSON, and inline generated data rendered; a markup-shaped CSV label remained escaped. Build rejects missing/invalid numbers and CSV over 1 MiB/1,000 rows. This does **not** test the application's authorized-file resolution or guest-code boundary. |
| Theme, print, offline | Two supplied color palettes changed SVG; six SVGs remained present with JavaScript disabled and Edge generated a PDF. The browser observed no off-origin requests or page errors while hydrating normal and dense chart pages. PDF layout, page count, repeated export fidelity and live audience parity remain unproved. |
| Static/no-chart output | The `plain` page emitted no script, React island, or chart asset. This does not measure the full app's text-only export size. |
| Larger data | A 1,000-point scatter and line/area fixture rendered and hydrated. One Edge navigation-plus-hydration sample took **562 ms** on this host. Dense HTML was **2,735,712 bytes raw / 139,988 gzip**. The sample is *not* the required edit-to-preview p95 of <= 200 ms or the ten-chart reference workload. |
| Download cost | Chart page's three emitted JS assets totaled **597,779 bytes raw / 188,618 gzip**; the plain page's HTML was 201 bytes and had no JS. Re-measure for the final deck player, not only this demo. |

## Boundaries before changing the main design

1. **Astro compiles these known pages at build time.** It will not compile the user's newly opened `.mdx` deck at runtime. Prove a single runtime content pipeline and the Bun executable's inclusion of the actual chart dependencies, assets and fonts (G-01); do not interpret this static build as packaging proof.
2. **These are trusted built-in chart islands, not permissioned authored React.** An audience receiver must not ship React merely to mirror the presenter's state. Prove G-02 output/state/accessibility parity and G-03 execution isolation independently; never execute arbitrary deck JSX in the trusted chart component.
3. **Export and performance gates remain.** Verify static fallbacks for incomplete/denied data, 10 charts of up to 1,000 points, <= 200 ms edit-to-preview p95, precise saved chart state in PDF, offline export, 320px reading, keyboard/screen-reader access, and clean Windows/macOS/Linux packaging. A 1,000-point HTML result or one PDF is not those gates.
4. **Future chart types:** histogram can bin data into bars; install Nivo heat map or box plot only if those Could requirements are accepted. Do not preinstall future packages or switch to Canvas without an SVG export path.

Keep ECharts for the MVP. Revisit Nivo SVG only if the owner reopens the choice
and the remaining gates pass; do not replace the draft chart catalog based on
this spike alone.
