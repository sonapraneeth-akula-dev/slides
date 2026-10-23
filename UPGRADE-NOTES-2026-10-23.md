# Dependency upgrade and Bun tooling observations

Date: 2026-10-23
Repository: `slides`
Branch: `chore/upgrade-astro-bun-2026-10` (created from local `main`)
Baseline commit: `9a7e2429218aec40b92f89f9e4be05010fc5d1ac`

## Scope and provenance

These observations describe the measured upgrade working tree, not a released version.
This documentation commit does not commit the dependency, Docker, formatter, or
typechecker edits described below. Those remain separate working-tree changes.
Pre-existing user edits were retained. No remote submodule update or push was performed.

Before: existing dependency lockfiles, Bun 1.4.3, Node 24.20.0.
After: upgraded lockfiles and project/container Bun 1.4.4; the system Bun was not changed.
Run the new commands with Bun 1.4.4 or newer, not an older executable on PATH.

## Dependency changes

| Manifest | Section | Package | Before | After |
| --- | --- | --- | --- | --- |
| `code\package.json` | dependencies | astro | 7.3.3 | 7.4.0 |
| `code\package.json` | dependencies | dompurify | ^3.4.15 | ^3.4.17 |
| `code\package.json` | dependencies | katex | ^0.18.7 | ^0.19.0 |
| `code\package.json` | dependencies | markdown-it | ^15.0.2 | ^15.0.3 |
| `code\package.json` | dependencies | mermaid | ^12.0.0 | ^12.2.0 |
| `code\package.json` | devDependencies | @playwright/test | 1.60.0 | 1.64.1 |
| `code\package.json` | devDependencies | @types/bun | 1.4.2 | 1.4.3 |
| `code\package.json` | devDependencies | typescript | 5.9.3 | ~6.0.3 |
| `code\package.json` | packageManager | bun | (none) | bun@1.4.4 |
| `proposal\chart-spike\package.json` | dependencies | @astrojs/react | 6.0.6 | 7.1.0 |
| `proposal\chart-spike\package.json` | dependencies | astro | 7.3.3 | 7.4.0 |
| `proposal\chart-spike\package.json` | dependencies | react | 19.3.0 | 19.3.1 |
| `proposal\chart-spike\package.json` | dependencies | react-dom | 19.3.0 | 19.3.1 |
| `proposal\chart-spike\package.json` | devDependencies | @types/papaparse | ^5.3.16 | ^5.5.2 |
| `proposal\chart-spike\package.json` | devDependencies | @types/react | ^19.0.0 | ^19.3.0 |
| `proposal\chart-spike\package.json` | devDependencies | @types/react-dom | ^19.0.0 | ^19.3.0 |
| `proposal\chart-spike\package.json` | devDependencies | playwright-core | 1.63.0 | 1.64.1 |
| `proposal\chart-spike\package.json` | devDependencies | typescript | ^5.9.3 | ~6.0.3 |
| `proposal\chart-spike\package.json` | packageManager | bun | (none) | bun@1.4.4 |

## Build observations

Wall-clock seconds; the second of two sequential runs. These are indicative
measurements, not confidence intervals. Negative change means faster.
These original dependency-upgrade measurements precede the separate Bun tooling trial below.

| Target | Before | Upgraded serial | After selected optimization | Change | HTML paths retained |
| --- | ---: | ---: | ---: | ---: | ---: |
| slides | 6.677 | 6.852 | 6.852 | +2.62% | 2 |
| slides-chart-spike | 6.693 | 6.910 | 6.910 | +3.24% | 3 |

Original and final HTML path sets matched. HTML is not claimed byte-identical:
syntax-highlighting spans and build metadata changed some text signatures.

## Bun formatter and typechecker trial

No formatter command was configured before this trial. Prettier below is a
candidate reference using the same new configuration, not a replaced existing formatter.
Initial checker and formatter comparisons show the second of two runs.
PDF follow-up checker rows show the third of three runs; its new build was run twice.

| Target | Check command | Warm seconds | Exit | Coverage / decision |
| --- | --- | ---: | ---: | --- |
| slides | `bun run check` | 10.901 | 0 | Full Astro checking retained. |
| slides | `bun check --no-script --timing` | 0.321 | 0 | Plain TS only; does not cover Astro templates. |
| slides | `node ..\..\packages\node_modules\prettier\bin\prettier.cjs "**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts,json,jsonc,json5,css,scss,less,html,astro,yml,yaml}" --check` | 1.828 | 1 | Same 34 files need formatting; no source rewrite. |
| slides | `bun fmt --no-script "**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts,json,jsonc,json5,css,scss,less,html,astro,yml,yaml}" --check` | 0.288 | 1 | Same 34 files need formatting; no source rewrite. |
| slides-chart-spike | `bun run check` | 9.083 | 0 | Full Astro checking retained. |
| slides-chart-spike | `bun check --no-script --timing` | 0.208 | 0 | Plain TS only; does not cover Astro templates. |
| slides-chart-spike | `node ..\..\..\packages\node_modules\prettier\bin\prettier.cjs "**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts,json,jsonc,json5,css,scss,less,html,astro,yml,yaml}" --check` | 0.600 | 1 | Same 8 files need formatting; no source rewrite. |
| slides-chart-spike | `bun fmt --no-script "**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts,json,jsonc,json5,css,scss,less,html,astro,yml,yaml}" --check` | 0.295 | 1 | Same 8 files need formatting; no source rewrite. |

Adopted Bun's built-in formatter as the opt-in source formatter in all ten active JavaScript projects. Prettier and its Astro plugin are retained only in the five projects that actually format Astro templates. Five projects use Bun without any formatter dependency. Formatting warning-file sets matched the reference. Sample output was identical except for equivalent simple CSS string-quote choices, which were checked with both formatters' semantic debug checks. Existing formatting debt remains; format:check is not claimed green and was not added as a new CI gate.

Adopted native checking as PDF Studio's build gate after source-coverage and negative-error tests. Added optional TS-only commands to homepage and both slides projects. Kept Astro checking everywhere: a controlled template error was rejected by Astro and missed by Bun.

### slides

Added optional `typecheck:ts: bun check --no-script` for fast plain-TS feedback. Kept the existing `check: astro check` command and build behavior unchanged. The native checker missed the injected Astro template error, so its shorter runtime is not an equal-coverage speedup over Astro checking.

- Added `format: bun fmt --no-script` and `format:check: bun fmt --no-script --check`.
- Added source-formatting configuration and exclusions; authored content and generated assets are not reformatted.
- Astro fallback devDependency `prettier`: (none) -> 3.9.10.
- Astro fallback devDependency `prettier-plugin-astro`: (none) -> 1.1.1.

### slides-chart-spike

Added optional `typecheck:ts: bun check --no-script` for fast plain-TS feedback. Kept the existing `check: astro check` command and build behavior unchanged. The native checker missed the injected Astro template error, so its shorter runtime is not an equal-coverage speedup over Astro checking.

- Added `format: bun fmt --no-script` and `format:check: bun fmt --no-script --check`.
- Added source-formatting configuration and exclusions; authored content and generated assets are not reformatted.
- Astro fallback devDependency `prettier`: (none) -> 3.9.10.
- Astro fallback devDependency `prettier-plugin-astro`: (none) -> 1.1.1.

Formatting is opt-in; no whole-repository formatting rewrite was performed.
Existing formatting debt is reported, not silently fixed or ignored.
Authored Markdown/MDX, content, public/generated assets, research sources and
nested submodules are excluded from source formatting. Where present, Astro templates
use Prettier 3.9.10 with prettier-plugin-astro 1.1.1 through Bun's fallback.
Formatting does not replace linting. Astro applications retain their template checks.

## Validation and existing failures

- `slides / check`: passed.
- `slides / test`: passed.
- `slides / test:e2e`: Same pre-existing dev-mode save assertion at e2e/dev.spec.ts:149..
- `slides-chart-spike / check`: passed.
- `slides-chart-spike / test`: passed.
- Slides browser suite: 23 passed, 1 baseline-existing dev-mode save failure.
  The LAN sharing test now waits for the actual URL before extracting it.

## Compatibility and reproduction

Astro Check requires compatible TypeScript 6.0.3; PDF Studio uses TypeScript 7.0.2.
All ten original upgraded builds and frozen installs passed; all nine Docker
runtime smoke checks and eight Compose configurations passed.
Do not compare Bun's plain TS/TSX checker speed with Astro checking as equal coverage.
A faster command is not adopted as a replacement if it drops template diagnostics.

Original build measurements: `bun install --frozen-lockfile`, then two sequential
`bun run build` executions with Bun 1.4.3 before / Bun 1.4.4 after.
Use the exact before/after manifests and locks; checking out the baseline commit
alone does not recreate pre-existing dirty work used in the original measurement.

References:
- https://astro.build/blog/astro-740/
- https://bun.sh/blog/bun-v1.4.4
- https://bun.sh/docs/format
- https://bun.sh/docs/runtime/check
