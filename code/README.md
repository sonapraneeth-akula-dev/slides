# Slides bootstrap

Requires Bun 1.4+ and Node.js 24+ for the Astro build. From `code/`:

```sh
bun install --frozen-lockfile
bun run check
bun run test
bun run build
bun run start
```

Open the loopback URL printed by `start`. `bun run dev` runs Astro's UI-only development server on loopback; it does not represent the future Bun file service. This bootstrap has a placeholder page, a private loopback static host, and path-allowlist tests, **not** an editor or presentation implementation. Source documents are never served by this host. The implementation phase owns the remaining features and their acceptance evidence; see `ASSUMPTIONS.md`.
