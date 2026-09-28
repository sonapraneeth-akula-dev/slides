import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { compileDeck, audienceProjection } from '../src/deck';
import { publicSnapshot } from '../src/presentation-model';

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
    const grouped = input.replace('    metadataTopCenter: slideTitle\n    metadataBottomRight: slideNumber',
      '    metadata:\n      metadataTopCenter: slideTitle\n      metadataBottomRight: slideNumber');
    const compiled = compileDeck(grouped);
    expect(compiled.diagnostics).toEqual([]);
    expect(compiled.deck?.master.metadataTopCenter).toBe('slideTitle');
    expect(compiled.deck?.master.metadataBottomRight).toBe('slideNumber');
    expect(compiled.deck?.master).not.toHaveProperty('metadata');
    expect(audienceProjection(compiled.deck!, 'one', 0).master.metadataBottomRight).toBe('slideNumber');
    for (const invalid of [
      grouped.replace('metadataTopCenter: slideTitle', 'metadataTopCenter: arbitrary'),
      grouped.replace('metadataTopCenter: slideTitle', 'metadataUnknown: slideTitle'),
      grouped.replace('metadata:\n      metadataTopCenter: slideTitle\n      metadataBottomRight: slideNumber', 'metadata: none'),
      grouped.replace('    metadata:\n', '    metadataTopCenter: slideTitle\n    metadata:\n')
    ]) expect(compileDeck(invalid).deck).toBeNull();
    expect(compileDeck(grouped.replace('    metadata:\n', '    metadataTopCenter: slideTitle\n    metadata:\n'))
      .diagnostics.some(diagnostic => diagnostic.message.includes('Duplicate metadata position'))).toBe(true);
  });

  test('validates slide-level sections and metadata and preserves overrides in audience snapshots', () => {
    const input = `---
slides:
  master:
    metadata:
      metadataBottomRight: slideNumber
---
::slide{id="one" section="Findings" metadataBottomRight="none" metadataTopLeft="slideTitle" layout="title-image-left"}
# First
:::slot{name="image"}
![Example](assets/sample-landscape.svg)
:::`;
    const compiled = compileDeck(input);
    expect(compiled.diagnostics).toEqual([]);
    expect(compiled.deck?.slides[0].section).toBe('Findings');
    expect(compiled.deck?.slides[0].metadata).toEqual({ metadataBottomRight: 'none', metadataTopLeft: 'slideTitle' });
    const projected = audienceProjection(compiled.deck!, 'one', 0);
    expect(projected.slide.metadata).toEqual(compiled.deck!.slides[0].metadata);
    const snapshot = publicSnapshot({
      schemaVersion: 1, sessionId: 'test', sequence: 1, slideId: 'one', step: 0,
      stage: { title: 'Demo', master: compiled.deck!.master, total: 1, slide: projected.slide },
      overlay: { marks: [], blackout: false, canvas: false },
    });
    expect(snapshot.stage.slides[0].metadata).toEqual({ metadataBottomRight: 'none', metadataTopLeft: 'slideTitle' });
    for (const directive of [
      'section=""', 'section="<script>"', 'metadataBottomRight="invalid"',
      'metadataUnknown="none"', 'metadataBottomRight="none" metadataBottomRight="slideNumber"'
    ]) expect(compileDeck(input.replace('section="Findings"', directive)).deck).toBeNull();
  });

  test('bundled feature tour is a valid comprehensive authored deck', async () => {
    const source = await readFile(join(process.cwd(), 'public', 'feature-tour.mdx'), 'utf8');
    const compiled = compileDeck(source);
    expect(compiled.diagnostics).toEqual([]);
    expect(compiled.deck?.slides.length).toBe(18);
    expect(new Set(compiled.deck?.slides.map(slide => slide.layout))).toEqual(new Set([
      'title-content', 'title-image-left', 'title-image-right', 'two-columns',
      'three-columns', 'picture-text', 'image-full', 'blank'
    ]));
    expect(compiled.deck?.slides.find(slide => slide.id === 'key-ideas')?.parent).toBe('story');
    expect(compiled.deck?.slides.find(slide => slide.id === 'image-only')?.metadata.metadataBottomRight).toBe('none');
  });

  test('accepts only static built-in components with string attributes', async () => {
    const source = await readFile(join(process.cwd(), 'public', 'feature-tour.mdx'), 'utf8');
    const line = 'Plain **Markdown** inside every card.';
    expect(compileDeck(source.replace(line, '<Mark note="tip">text</Mark> and <Mark>more</Mark>')).deck).not.toBeNull();
    for (const unsafe of ['<div>html</div>', '<Card onClick={run}>', '<Mark note={x}>text</Mark>', '<Callout type="tip" {...props}>'])
      expect(compileDeck(source.replace(line, unsafe)).deck, unsafe).toBeNull();
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

  test('accepts installed font family names without allowing malformed font values', () => {
    const input = `---
slides:
  master:
    headingFont: Aptos Display
    bodyFont: Noto Sans
    codeFont: Cascadia Code
---
::slide{id="one"}
# First`;
    expect(compileDeck(input).diagnostics).toEqual([]);
    for (const invalid of [
      'headingFont: "Aptos; color: red"',
      'headingFont: " Missing"',
      'headingFont: 42',
      `headingFont: ${'A'.repeat(121)}`
    ]) expect(compileDeck(input.replace('headingFont: Aptos Display', invalid)).deck).toBeNull();
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
  test('copies the bundled sample image once, serves it only at its fixed route, and rejects modifications', async () => {
    const { privateRouter } = await import('../src/host');
    const route = privateRouter(12345);
    const request = (path: string, method = 'GET') =>
      route(new Request(`http://127.0.0.1:12345${path}`, { method, headers: { host: '127.0.0.1:12345' } }));
    expect((await request('/api/bootstrap')).status).toBe(200);
    const bundled = await readFile(join(process.cwd(), 'public', 'sample-landscape.svg'));
    const installed = join(dir, 'assets', 'sample-landscape.svg');
    expect(await readFile(installed)).toEqual(bundled);
    const response = await request('/api/sample-image');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/svg+xml');
    expect(response.headers.get('content-security-policy')).toContain('sandbox');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bundled);
    expect((await request('/api/sample-image', 'HEAD')).status).toBe(200);
    expect((await request('/api/other.svg')).status).toBe(403);
    try {
      await writeFile(installed, '<svg onload="alert(1)"/>');
      expect((await request('/api/sample-image')).status).toBe(409);
      expect(await readFile(installed, 'utf8')).toContain('onload');
    } finally { await writeFile(installed, bundled); }
  });

  test('uses a home directory by default and preserves the explicit library override', () => {
    expect(library.defaultLibraryRoot).toBe(join(homedir(), '.slides'));
    expect(library.libraryRoot).toBe(dir);
    expect(library.presentationsRoot).toBe(join(dir, 'presentations'));
    expect(library.featureToursRoot).toBe(join(dir, 'feature-tours'));
  });

  test('organizes existing tours and personal decks without overwriting edits', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'slides-organize-'));
    const app = join(workspace, '.slides');
    const personal = join(workspace, 'Presentations');
    const tours = join(app, 'feature-tours');
    const oldTour = join(app, 'Slides-Feature-Tour.md');
    const oldDeck = join(app, 'My-Talk.md');
    const external = join(workspace, 'external.md');
    try {
      await mkdir(app);
      await writeFile(oldTour, source.replace('title: Journey', 'title: Edited tour'));
      await writeFile(oldDeck, source);
      await writeFile(external, source);
      const tourId = library.deckId('Slides-Feature-Tour.md');
      const deckId = library.deckId('My-Talk.md');
      await writeFile(join(app, '.slides-library.json'), JSON.stringify({
        entries: { [tourId]: oldTour, [deckId]: oldDeck, 'ext-example': external }, hidden: [tourId],
      }));
      await library.organizeLibrary(app, personal, tours);
      expect(await readFile(join(tours, 'Slides-Feature-Tour.md'), 'utf8')).toContain('Edited tour');
      expect(await readFile(join(personal, 'My-Talk.md'), 'utf8')).toBe(source);
      await expect(readFile(oldTour)).rejects.toMatchObject({ code: 'ENOENT' });
      await expect(readFile(oldDeck)).rejects.toMatchObject({ code: 'ENOENT' });
      const index = JSON.parse(await readFile(join(app, '.slides-library.json'), 'utf8')) as {
        entries: Record<string, string>; hidden: string[]
      };
      const newTourId = library.featureTourDeckId('Slides-Feature-Tour.md');
      expect(index.entries).toEqual({
        [newTourId]: join(tours, 'Slides-Feature-Tour.md'),
        [deckId]: join(personal, 'My-Talk.md'),
        'ext-example': external,
      });
      expect(index.hidden).toEqual([newTourId]);
      expect(await readFile(external, 'utf8')).toBe(source);
      await library.organizeLibrary(app, personal, tours);
      expect(await readFile(join(app, '.slides-library.json'), 'utf8')).toBe(JSON.stringify(index));
    } finally { await rm(workspace, { recursive: true, force: true }); }
  });

  test('does not move older decks when a different destination already exists', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'slides-organize-conflict-'));
    const app = join(workspace, '.slides');
    const personal = join(workspace, 'Presentations');
    try {
      await mkdir(app);
      await mkdir(personal);
      await writeFile(join(app, 'My-Talk.md'), source);
      await writeFile(join(personal, 'My-Talk.md'), '# Different');
      await expect(library.organizeLibrary(app, personal, join(app, 'feature-tours')))
        .rejects.toThrow('different contents');
      expect(await readFile(join(app, 'My-Talk.md'), 'utf8')).toBe(source);
      expect(await readFile(join(personal, 'My-Talk.md'), 'utf8')).toBe('# Different');
    } finally { await rm(workspace, { recursive: true, force: true }); }
  });

  test('duplicates a tour into presentations and keeps renamed tours in app storage', async () => {
    const tour = await library.createDeck('Slides-Feature-Tour.md', source, 'tour');
    expect(tour.id).toBe(library.featureTourDeckId('Slides-Feature-Tour.md'));
    const personal = await library.duplicateDeck(tour.id, 'My-Tour.md');
    expect(personal.id).toBe(library.deckId('My-Tour.md'));
    expect(await readFile(join(library.presentationsRoot, 'My-Tour.md'), 'utf8')).toBe(source);
    const renamed = await library.renameDeck(tour.id, 'Slides-Feature-Tour-Renamed.md', tour.revision);
    expect(renamed.id).toBe(library.featureTourDeckId('Slides-Feature-Tour-Renamed.md'));
    expect(await readFile(join(library.featureToursRoot, 'Slides-Feature-Tour-Renamed.md'), 'utf8')).toBe(source);
    const entries = await library.listDecks();
    expect(entries.find(entry => entry.id === personal.id)?.kind).toBe('presentation');
    expect(entries.find(entry => entry.id === renamed.id)?.kind).toBe('tour');
    await library.removeDeck(renamed.id);
    expect((await library.listDecks()).some(entry => entry.id === renamed.id)).toBe(false);
  });

  test('reuses unchanged tour files, removes redundant copies, and preserves edits', async () => {
    const current = (await readFile(join(process.cwd(), 'public', 'feature-tour.mdx'), 'utf8')).replace(/\r\n/g, '\n');
    const older = current.replace('# A reveal and private notes', '# A previous reveal and private notes');
    expect(older).not.toBe(current);
    const marker = createHash('sha256').update(older).digest('hex');
    const previous = older.replace('slides:\n', `slides:\n  # Bundled feature tour: ${marker}\n`);
    const original = await library.createDeck('Slides-Feature-Tour-10.md', previous, 'tour');
    const { privateRouter } = await import('../src/host');
    const route = privateRouter(12346);
    const url = 'http://127.0.0.1:12346/api';
    const headers = { host: '127.0.0.1:12346' };
    const { token } = await (await route(new Request(`${url}/bootstrap`, { headers }))).json() as { token: string };
    const demo = async () => {
      const response = await route(new Request(`${url}/library`, {
        method: 'POST',
        headers: { ...headers, 'X-Slides-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'demo' }),
      }));
      expect(response.status).toBe(201);
      return (await response.json()) as { id: string };
    };
    const canonicalId = library.featureTourDeckId('Slides-Feature-Tour.mdx');
    expect((await demo()).id).toBe(canonicalId);
    const refreshed = await library.openDeck(canonicalId);
    expect(refreshed.text).toContain('# A reveal and private notes');
    expect(refreshed.text).not.toContain('# A previous reveal and private notes');
    await expect(readFile(join(library.featureToursRoot, 'Slides-Feature-Tour-10.md')))
      .rejects.toMatchObject({ code: 'ENOENT' });
    const catalog = JSON.parse(await readFile(join(library.libraryRoot, '.slides-library.json'), 'utf8')) as {
      entries: Record<string, string>;
    };
    expect(catalog.entries[canonicalId]).toBe(join(library.featureToursRoot, 'Slides-Feature-Tour.mdx'));
    expect(catalog.entries[original.id]).toBeUndefined();

    const redundant = await library.createDeck('Slides-Feature-Tour-11.md', refreshed.text, 'tour');
    expect((await demo()).id).toBe(canonicalId);
    await expect(readFile(join(library.featureToursRoot, 'Slides-Feature-Tour-11.md')))
      .rejects.toMatchObject({ code: 'ENOENT' });
    expect((await library.listDecks()).some(entry => entry.id === redundant.id)).toBe(false);

    const edited = await library.createDeck('Slides-Feature-Tour-10.md',
      previous.replace('# A previous reveal and private notes', '# My personalized tour'), 'tour');
    expect((await demo()).id).toBe(canonicalId);
    expect((await library.openDeck(edited.id)).text).toContain('# My personalized tour');
    await library.deleteDeck(edited.id, edited.revision, true);
    const latest = await library.openDeck(canonicalId);
    await library.deleteDeck(canonicalId, latest.revision, true);
  });

  test('normalizes a markerless numbered tour without replacing an edited canonical tour', async () => {
    const current = await readFile(join(process.cwd(), 'public', 'feature-tour.mdx'), 'utf8');
    const numbered = await library.createDeck('Slides-Feature-Tour-2.md', current, 'tour');
    const { privateRouter } = await import('../src/host');
    const route = privateRouter(12347);
    const url = 'http://127.0.0.1:12347/api';
    const headers = { host: '127.0.0.1:12347' };
    const { token } = await (await route(new Request(`${url}/bootstrap`, { headers }))).json() as { token: string };
    const demo = async () => {
      const response = await route(new Request(`${url}/library`, {
        method: 'POST',
        headers: { ...headers, 'X-Slides-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'demo' }),
      }));
      expect(response.status).toBe(201);
      return (await response.json()) as { id: string };
    };
    const canonicalId = library.featureTourDeckId('Slides-Feature-Tour.mdx');
    expect((await demo()).id).toBe(canonicalId);
    expect((await demo()).id).toBe(canonicalId);
    await expect(readFile(join(library.featureToursRoot, 'Slides-Feature-Tour-2.md')))
      .rejects.toMatchObject({ code: 'ENOENT' });
    const refreshed = await library.openDeck(canonicalId);
    expect(refreshed.text).toContain('# Bundled feature tour:');
    expect((await library.listDecks()).some(entry => entry.id === numbered.id)).toBe(false);

    const edited = refreshed.text.replace('# A reveal and private notes', '# My personalized tour');
    await library.saveDeck(canonicalId, refreshed.revision, edited);
    expect((await demo()).id).toBe(canonicalId);
    expect((await library.openDeck(canonicalId)).text).toBe(edited);

    const next = (await library.openDeck(canonicalId)).text.replace(
      /(# Bundled feature tour: )[a-f0-9]{64}/, `$1${'0'.repeat(64)}`);
    const changed = await library.saveDeck(canonicalId, (await library.openDeck(canonicalId)).revision, next);
    const numberedId = library.featureTourDeckId('Slides-Feature-Tour-2.mdx');
    expect((await demo()).id).toBe(numberedId);
    expect((await library.openDeck(canonicalId)).text).toBe(next);
    expect((await library.openDeck(numberedId)).text).toContain('# A reveal and private notes');
    expect((await demo()).id).toBe(numberedId);
    await library.deleteDeck(canonicalId, changed.revision, true);
    const latest = await library.openDeck(numberedId);
    await library.deleteDeck(numberedId, latest.revision, true);
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
    expect(id).toBe(library.deckId('Quarterly-Review.mdx'));
    expect((await library.openDeck(id)).deck?.title).toBe('Quarterly  Review');
    expect(await readFile(join(library.presentationsRoot, 'Quarterly-Review.mdx'), 'utf8')).toContain('title: "Quarterly  Review"');
    const md = await create('Team Plan.md');
    expect(md.status).toBe(201);
    expect((await md.json()).id).toBe(library.deckId('Team-Plan.md'));
    expect((await library.openDeck(library.deckId('Team-Plan.md'))).deck?.title).toBe('Team Plan');
    expect((await create('Quarterly Review')).status).toBe(409);
    expect((await create('example.txt')).status).toBe(400);
  });

  test('creates/opens, saves confirmed bytes and detects external edit without data loss', async () => {
    const initial = await library.createDeck('study.md', source);
    expect((await library.listDecks()).map(d => d.name)).toContain('study.md');
    expect(initial.deck?.slides.length).toBe(3);
    const saved = await library.saveDeck(initial.id, initial.revision, source.replace('Paragraph **bold**', 'Edited'));
    expect((await readFile(join(library.presentationsRoot, 'study.md'), 'utf8'))).toContain('Edited');
    expect(saved.revision).not.toBe(initial.revision);
    await writeFile(join(library.presentationsRoot, 'study.md'), source);
    try {
      await library.saveDeck(initial.id, saved.revision, 'draft not lost');
      throw new Error('Expected conflict');
    } catch (error) {
      expect(error).toBeInstanceOf(library.LibraryError);
      expect((error as InstanceType<typeof library.LibraryError>).status).toBe(409);
      expect((error as InstanceType<typeof library.LibraryError>).details).toMatchObject({ diskText: source, draftText: 'draft not lost' });
    }
    expect(await readFile(join(library.presentationsRoot, 'study.md'), 'utf8')).toBe(source);
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
    await writeFile(join(library.presentationsRoot, 'study.md'), source.replace('Root', 'Changed'));
    expect(talk.deck.slides[0].title).toBe('Root');
    await expect(session.createTalk(opened.id, opened.revision)).rejects.toThrow();
    dispatch('stroke', { stroke: {
      slideId: talk.slideId, step: talk.step, tool: 'pen', color: '#ff00aa', width: 5,
      points: [{ x: 0.2, y: 0.3 }, { x: 0.4, y: 0.5 }]
    } });
    expect(() => session.endTalk(talk, false)).toThrow();
    session.endTalk(talk, true);
    expect(() => session.getTalk(talk.id)).toThrow();
    await writeFile(join(library.presentationsRoot, 'study.md'), source);
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
      const image = await get('/api/sample-image');
      expect(image.status).toBe(200);
      expect(image.headers.get('content-type')).toBe('image/svg+xml');
      expect(image.headers.get('content-security-policy')).toContain('sandbox');
      expect((await get('/api/other.svg')).status).toBe(404);
      expect((await get('/state')).status).toBe(403);
      expect((await get('/state', 'wrong')).status).toBe(403);
      expect(session.privateState(talk).share?.viewers).toEqual([]);
      const state = await (await get('/state', talk.share!.key)).text();
      expect(session.privateState(talk).share?.viewers).toEqual([address]);
      expect(session.activeViewers(talk.share!.viewers, Date.now() + 6000)).toEqual([]);
      expect(state).toContain('"sessionId"');
      expect(state).not.toContain('PRIVATE SECRET');
      expect(state).not.toContain(talk.localKey);
    } finally {
      session.endTalk(talk, true);
    }
  });
});
