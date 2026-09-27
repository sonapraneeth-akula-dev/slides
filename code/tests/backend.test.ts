import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileDeck, audienceProjection } from '../src/deck';

const source = `---
slides:
  formatVersion: 1
  title: Journey
  master:
    theme: paper
---
::slide{id="root"}
# Root
Paragraph **bold**
:::notes
PRIVATE SECRET
:::
:::reveal{step="1"}
- Reveal
:::
::slide{id="child" parent="root" layout="two-columns"}
# Child
\`\`\`markdown
::slide{id="not-real"}
:::
\`\`\`
::slide{id="end"}
# End`;

describe('compiler and audience projection', () => {
  test('orders hierarchy, locates source and keeps fenced directives literal', () => {
    const { deck, diagnostics } = compileDeck(source);
    expect(diagnostics).toEqual([]);
    expect(deck?.slides.map(s => [s.id, s.number])).toEqual([['root', '1'], ['child', '1.1'], ['end', '2']]);
    expect(deck?.slides[1].items.some(item => item.text.includes('not-real'))).toBe(true);
    const publicSlide = audienceProjection(deck!, 'root', 0);
    expect(JSON.stringify(publicSlide)).not.toContain('PRIVATE SECRET');
    expect(JSON.stringify(publicSlide)).not.toContain('Reveal');
    expect(audienceProjection(deck!, 'root', 1).slide.items.some(item => item.text.includes('Reveal'))).toBe(true);
  });

  test('invalid metadata, cycles, ids, reveal gaps and unclosed fences report errors', () => {
    const inputs = [
      '::slide{id="a"}\n::slide{id="a"}',
      '::slide{id="a" parent="b"}\n::slide{id="b" parent="a"}',
      '::slide{id="a" parent="missing"}',
      '::slide{id="a"}\n:::reveal{step="2"}\ntext\n:::',
      '::slide{id="a"}\n```js\nalert(1)',
      '---\nslides:\n  master:\n    theme: imaginary\n---\n::slide{id="a"}'
    ];
    for (const input of inputs) {
      const result = compileDeck(input);
      expect(result.deck).toBeNull();
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics.every(d => d.line > 0 && d.column > 0)).toBe(true);
    }
  });

  test('rejects markup execution outside code fences', () => {
    expect(compileDeck('::slide{id="a"}\n<img src=x onerror="alert(1)">').deck).toBeNull();
    expect(compileDeck('::slide{id="a"}\n```html\n<img src=x onerror="alert(1)">\n```').deck).not.toBeNull();
  });

  test('uses filename for placeholder titles and validates metadata positions', () => {
    const input = `---
slides:
  title: Untitled presentation
  master:
    footerNumber: true
    metadataTopCenter: slideTitle
    metadataBottomRight: slideNumber
---
::slide{id="one"}
# First`;
    expect(compileDeck(input, 'Quarterly report').deck?.title).toBe('Quarterly report');
    expect(compileDeck(input.replace('Untitled presentation', 'My custom title'), 'Quarterly report').deck?.title).toBe('My custom title');
    expect(compileDeck(input.replace('metadataTopCenter: slideTitle', 'metadataTopCenter: arbitrary'), 'Quarterly report').deck).toBeNull();
  });

  test('validates heading alignment and bounded slide spacing while retaining legacy footer numbers', () => {
    const input = `---
slides:
  master:
    headingPlacement: center
    marginLeft: 0
    marginRight: 20
    paddingTop: 3.5
    footerNumber: true
---
::slide{id="one"}
# First`;
    expect(compileDeck(input).diagnostics).toEqual([]);
    for (const [original, invalid] of [
      ['headingPlacement: center', 'headingPlacement: bottom'],
      ['headingPlacement: center', 'headingPlacement: 42'],
      ['marginLeft: 0', 'marginLeft: -1'],
      ['marginLeft: 0', 'marginLeft: 21'],
      ['marginLeft: 0', 'marginLeft: "5"'],
      ['paddingTop: 3.5', 'paddingTop: 21'],
      ['footerNumber: true', 'footerNumber: yes']
    ]) {
      expect(compileDeck(input.replace(original, invalid)).deck).toBeNull();
    }
    expect(compileDeck(input.replace('    footerNumber: true\n', '')).deck).not.toBeNull();
  });
});

let dir: string;
let library: typeof import('../src/library');
let session: typeof import('../src/session');

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'slides-backend-'));
  process.env.SLIDES_LIBRARY = dir;
  library = await import('../src/library');
  session = await import('../src/session');
});
afterAll(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

describe('persistent library and presentation', () => {
  test('uses a home directory by default and preserves the explicit library override', () => {
    expect(library.defaultLibraryRoot).toBe(join(homedir(), '.slides'));
    expect(library.libraryRoot).toBe(dir);
  });

  test('imports legacy decks and catalog without removing or overwriting existing files', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'slides-migration-'));
    try {
      const legacy = join(workspace, 'legacy');
      const home = join(workspace, '.slides');
      const external = join(workspace, 'external.md');
      await mkdir(join(legacy, 'nested'), { recursive: true });
      await mkdir(home);
      await writeFile(join(legacy, 'nested', 'archive.mdx'), source);
      await writeFile(join(legacy, 'hidden.md'), source);
      await writeFile(join(home, 'existing.md'), '# Existing');
      await writeFile(external, '# External');
      const archiveId = library.deckId(join('nested', 'archive.mdx'));
      const hiddenId = library.deckId('hidden.md');
      const existingId = library.deckId('existing.md');
      await writeFile(join(legacy, '.slides-library.json'), JSON.stringify({
        entries: { [archiveId]: join(legacy, 'nested', 'archive.mdx'), [hiddenId]: join(legacy, 'hidden.md'), 'ext-example': external },
        hidden: [hiddenId]
      }));
      await writeFile(join(home, '.slides-library.json'), JSON.stringify({
        entries: { [existingId]: join(home, 'existing.md') }, hidden: []
      }));
      await library.migrateLegacyLibrary(legacy, home);
      expect(await readFile(join(home, 'nested', 'archive.mdx'), 'utf8')).toBe(source);
      expect(await readFile(join(legacy, 'nested', 'archive.mdx'), 'utf8')).toBe(source);
      const imported = JSON.parse(await readFile(join(home, '.slides-library.json'), 'utf8')) as {
        entries: Record<string, string>; hidden: string[]
      };
      expect(imported.entries).toEqual({
        [existingId]: join(home, 'existing.md'),
        [archiveId]: join(home, 'nested', 'archive.mdx'),
        [hiddenId]: join(home, 'hidden.md'),
        'ext-example': external
      });
      expect(imported.hidden).toEqual([hiddenId]);
      await library.migrateLegacyLibrary(legacy, home);
      expect(await readFile(join(home, '.slides-library.json'), 'utf8')).toBe(JSON.stringify(imported));
    } finally { await rm(workspace, { recursive: true, force: true }); }
  });

  test('refuses to overwrite a different deck during migration', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'slides-migration-conflict-'));
    try {
      const legacy = join(workspace, 'legacy');
      const home = join(workspace, '.slides');
      await mkdir(legacy);
      await mkdir(home);
      await writeFile(join(legacy, 'talk.md'), '# Old');
      await writeFile(join(home, 'talk.md'), '# New');
      await expect(library.migrateLegacyLibrary(legacy, home)).rejects.toThrow('different contents');
      expect(await readFile(join(home, 'talk.md'), 'utf8')).toBe('# New');
      expect(await readFile(join(legacy, 'talk.md'), 'utf8')).toBe('# Old');
    } finally { await rm(workspace, { recursive: true, force: true }); }
  });

  test('create API converts title spaces to filename hyphens without changing deck title', async () => {
    const { privateRouter } = await import('../src/host');
    const route = privateRouter(12345);
    const headers = { host: '127.0.0.1:12345', 'Content-Type': 'application/json' };
    const bootstrap = await (await route(new Request('http://127.0.0.1:12345/api/bootstrap', { headers }))).json();
    const create = (name: string) => route(new Request('http://127.0.0.1:12345/api/library', {
      method: 'POST', headers: { ...headers, 'X-Slides-Token': bootstrap.token },
      body: JSON.stringify({ action: 'create', name }),
    }));

    const result = await create('Quarterly  Review');
    expect(result.status).toBe(201);
    const { id } = await result.json();
    expect(id).toBe(library.deckId('Quarterly-Review.md'));
    expect((await library.openDeck(id)).deck?.title).toBe('Quarterly  Review');
    expect(await readFile(join(dir, 'Quarterly-Review.md'), 'utf8')).toContain('title: "Quarterly  Review"');
    const mdx = await create('Team Plan.mdx');
    expect(mdx.status).toBe(201);
    expect((await mdx.json()).id).toBe(library.deckId('Team-Plan.mdx'));
    expect((await library.openDeck(library.deckId('Team-Plan.mdx'))).deck?.title).toBe('Team Plan');
    expect((await create('Quarterly Review.md')).status).toBe(409);
    expect((await create('example.txt')).status).toBe(400);
  });

  test('creates/opens, saves confirmed bytes and detects external edit without data loss', async () => {
    const initial = await library.createDeck('study.md', source);
    expect((await library.listDecks()).map(d => d.name)).toContain('study.md');
    expect(initial.deck?.slides.length).toBe(3);
    const saved = await library.saveDeck(initial.id, initial.revision, source.replace('Paragraph **bold**', 'Edited'));
    expect((await readFile(join(dir, 'study.md'), 'utf8'))).toContain('Edited');
    expect(saved.revision).not.toBe(initial.revision);
    await writeFile(join(dir, 'study.md'), source);
    try {
      await library.saveDeck(initial.id, saved.revision, 'draft not lost');
      throw new Error('Expected conflict');
    } catch (error) {
      expect(error).toBeInstanceOf(library.LibraryError);
      expect((error as InstanceType<typeof library.LibraryError>).status).toBe(409);
      expect((error as InstanceType<typeof library.LibraryError>).details).toMatchObject({ diskText: source, draftText: 'draft not lost' });
    }
    expect(await readFile(join(dir, 'study.md'), 'utf8')).toBe(source);
  });

  test('names opened placeholder decks after their file', async () => {
    const opened = await library.createDeck('from-file.md', source.replace('title: Journey', 'title: Untitled presentation'));
    expect(opened.deck?.title).toBe('from-file');
    expect((await library.openDeck(opened.id)).deck?.title).toBe('from-file');
  });

  test('rejects traversal, unsupported extension and duplicate creates', async () => {
    expect(() => library.deckId('../escape.md')).not.toThrow();
    await expect(library.openDeck(library.deckId('../escape.md'))).rejects.toThrow();
    await expect(library.openDeck(library.deckId('x.js'))).rejects.toThrow();
    await expect(library.createDeck('../escape.md', source)).rejects.toThrow();
    await expect(library.createDeck('study.md', source)).rejects.toThrow();
  });

  test('duplicates, renames and deletes only the confirmed revision', async () => {
    const original = await library.openDeck(library.deckId('study.md'));
    const copy = await library.duplicateDeck(original.id, 'copy.md');
    expect(copy.text).toBe(original.text);
    await expect(library.duplicateDeck(original.id, 'copy.md')).rejects.toThrow();
    const renamed = await library.renameDeck(copy.id, 'renamed.md', copy.revision);
    expect(renamed.text).toBe(original.text);
    await expect(library.openDeck(copy.id)).rejects.toThrow();
    await expect(library.deleteDeck(renamed.id, 'outdated', true)).rejects.toThrow('Deck changed on disk');
    await expect(library.deleteDeck(renamed.id, renamed.revision, false)).rejects.toThrow('Confirmed revision required');
    expect(await library.deleteDeck(renamed.id, renamed.revision, true)).toEqual({ deleted: true });
    await expect(library.openDeck(renamed.id)).rejects.toThrow();
    expect((await library.openDeck(original.id)).text).toBe(original.text);
  });

  test('snapshots source revision; reveal/slide navigation reverses; public state excludes notes', async () => {
    const opened = await library.openDeck(library.deckId('study.md'));
    const talk = await session.createTalk(opened.id, opened.revision);
    const dispatch = (action: string, extra: Record<string, unknown> = {}) => session.event(talk, { action, sequence: talk.sequence, ...extra });
    expect(JSON.stringify(session.publicState(talk))).not.toContain('PRIVATE SECRET');
    dispatch('next'); expect([talk.slideId, talk.step]).toEqual(['root', 1]);
    dispatch('next'); expect([talk.slideId, talk.step]).toEqual(['child', 0]);
    dispatch('next'); expect([talk.slideId, talk.step]).toEqual(['end', 0]);
    dispatch('next'); expect(talk.slideId).toBe('end');
    dispatch('previous'); expect([talk.slideId, talk.step]).toEqual(['child', 0]);
    dispatch('previous'); expect([talk.slideId, talk.step]).toEqual(['root', 1]);
    dispatch('parent'); expect(talk.slideId).toBe('root');
    expect(() => session.event(talk, { action: 'next', sequence: 0 })).toThrow();
    await writeFile(join(dir, 'study.md'), source.replace('Root', 'Changed'));
    expect(talk.deck.slides[0].title).toBe('Root');
    await expect(session.createTalk(opened.id, opened.revision)).rejects.toThrow();
    dispatch('stroke', { stroke: {
      slideId: talk.slideId, step: talk.step, tool: 'pen', color: '#ff00aa', width: 5,
      points: [{ x: 0.2, y: 0.3 }, { x: 0.4, y: 0.5 }]
    } });
    expect(() => session.endTalk(talk, false)).toThrow();
    session.endTalk(talk, true);
    expect(() => session.getTalk(talk.id)).toThrow();
    await writeFile(join(dir, 'study.md'), source);
  });

  test('private API rejects forged host, origin, token, and malformed body', async () => {
    const { privateRouter } = await import('../src/host');
    const route = privateRouter(12345);
    const request = (path: string, headers: Record<string, string> = {}, method = 'GET', value?: unknown) =>
      new Request(`http://127.0.0.1:12345${path}`, {
        method, headers: { host: '127.0.0.1:12345', ...headers },
        body: value === undefined ? undefined : JSON.stringify(value)
      });
    expect((await route(request('/api/library'))).status).toBe(403);
    expect((await route(request('/api/bootstrap', { host: 'evil.test' }))).status).toBe(403);
    expect((await route(request('/api/bootstrap', { origin: 'http://evil.test' }))).status).toBe(403);
    const bootstrap = await (await route(request('/api/bootstrap'))).json();
    expect(typeof bootstrap.token).toBe('string');
    expect((await route(request('/api/compile', { 'X-Slides-Token': bootstrap.token, 'Content-Type': 'application/json' }, 'POST', { text: source }))).status).toBe(200);
    expect((await route(request('/api/compile', { 'X-Slides-Token': bootstrap.token }, 'POST', { text: source }))).status).toBe(415);
  });

  test('ending marked talk requires explicit discard over the private API', async () => {
    const { privateRouter } = await import('../src/host');
    const route = privateRouter(12345);
    const bootstrap = await (await route(new Request('http://127.0.0.1:12345/api/bootstrap',
      { headers: { host: '127.0.0.1:12345' } }))).json();
    const opened = await library.openDeck(library.deckId('study.md'));
    const talk = await session.createTalk(opened.id, opened.revision);
    const headers = { host: '127.0.0.1:12345', 'X-Slides-Token': bootstrap.token, 'Content-Type': 'application/json' };
    const end = (value: unknown) => route(new Request(`http://127.0.0.1:12345/api/sessions/${talk.id}`,
      { method: 'DELETE', headers, body: JSON.stringify(value) }));
    let ended = false;
    try {
      session.event(talk, { action: 'stroke', sequence: talk.sequence, stroke: {
        slideId: talk.slideId, step: 0, tool: 'pen', color: '#ff00aa', width: 5,
        points: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }]
      } });
      expect((await end({})).status).toBe(409);
      expect((await end({ discardMarks: 'true' })).status).toBe(409);
      expect(session.getTalk(talk.id).marks).toHaveLength(1);
      expect((await end({ discardMarks: true })).status).toBe(200);
      ended = true;
      expect(() => session.getTalk(talk.id)).toThrow();
    } finally {
      if (!ended) session.endTalk(talk, true);
    }
  });

  test('audience links and LAN server expose only public assets and state', async () => {
    const address = session.shareOptions()[0];
    if (!address) throw new Error('LAN interface required for audience integration test');
    const opened = await library.openDeck(library.deckId('study.md'));
    const talk = await session.createTalk(opened.id, opened.revision);
    try {
      const share = session.startShare(talk, address, 49152, 49252);
      expect(share?.url).toBe(`http://${address}:${share?.port}/audience/#${talk.share?.key}`);
      const base = `http://${address}:${share?.port}`;
      const manifest = JSON.parse(await readFile(join(process.cwd(), 'build', 'audience-assets.json'), 'utf8')) as string[];
      expect(manifest).toContain('audience/index.html');
      expect(manifest).not.toContain('index.html');
      const audienceScript = manifest.find(asset => asset.includes('audience.astro_astro_type_script'));
      const ownerScript = (await readFile(join(process.cwd(), 'dist', 'index.html'), 'utf8'))
        .match(/src="\/(_astro\/index\.astro_astro_type_script[^"]+)"/)?.[1];
      expect(audienceScript).toBeDefined();
      expect(ownerScript).toBeDefined();
      expect(manifest).not.toContain(ownerScript!);
      const get = (path: string, key?: string) => fetch(`${base}${path}`, key ? { headers: { 'X-Slides-Public': key } } : {});
      expect((await get('/audience/')).status).toBe(200);
      expect((await get(`/${audienceScript}`)).status).toBe(200);
      expect((await get('/')).status).toBe(404);
      expect((await get(`/${ownerScript}`)).status).toBe(404);
      expect((await get('/api/bootstrap')).status).toBe(404);
      expect((await get('/state')).status).toBe(403);
      expect((await get('/state', 'wrong')).status).toBe(403);
      const state = await (await get('/state', talk.share!.key)).text();
      expect(state).toContain('"sessionId"');
      expect(state).not.toContain('PRIVATE SECRET');
      expect(state).not.toContain(talk.localKey);
    } finally {
      session.endTalk(talk, true);
    }
  });
});
