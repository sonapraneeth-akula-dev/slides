import { createHash, randomUUID } from 'node:crypto';
import { copyFile, link, mkdir, open, readFile, readdir, realpath, rename, stat, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { compileDeck } from './deck';

const extensions = new Set(['.md', '.mdx']);
export const defaultLibraryRoot = join(homedir(), '.slides');
const overriddenRoot = process.env.SLIDES_LIBRARY !== undefined;
export const libraryRoot = resolve(process.env.SLIDES_LIBRARY ?? defaultLibraryRoot);
const locks = new Map<string, Promise<unknown>>();
const indexPath = join(libraryRoot, '.slides-library.json');
type Catalog = { entries: Record<string, string>; hidden: string[] };
let indexLock: Promise<unknown> = Promise.resolve();
async function catalogAt(path: string): Promise<Catalog> {
  let content: string;
  try { content = await readFile(path, 'utf8'); }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return { entries: {}, hidden: [] };
    throw error;
  }
  const value: unknown = JSON.parse(content);
  if (!value || typeof value !== 'object' || !('entries' in value) || !('hidden' in value) ||
      !value.entries || typeof value.entries !== 'object' || Array.isArray(value.entries) ||
      !Array.isArray(value.hidden) ||
      !Object.entries(value.entries).every(([id, path]) => /^[A-Za-z0-9_-]+$/.test(id) && typeof path === 'string') ||
      !value.hidden.every(id => typeof id === 'string')) throw new LibraryError(500, 'Invalid library index');
  return value as Catalog;
}
async function catalog(): Promise<Catalog> { return catalogAt(indexPath); }

export async function migrateLegacyLibrary(legacyRoot: string, destination: string): Promise<void> {
  legacyRoot = resolve(legacyRoot);
  destination = resolve(destination);
  if (legacyRoot === destination) return;
  const marker = join(destination, '.legacy-library-imported');
  try { await stat(marker); return; }
  catch (error) { if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error; }
  let oldRoot: string;
  try { oldRoot = await realpath(legacyRoot); }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return;
    throw error;
  }
  if (oldRoot !== legacyRoot) throw new LibraryError(403, 'Legacy library is a symlink; import it manually');
  const previous = await catalogAt(join(legacyRoot, '.slides-library.json'));
  const current = await catalogAt(join(destination, '.slides-library.json'));
  const files = new Map<string, string>();
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 8) return;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path, depth + 1);
      else if (entry.isFile() && extensions.has(entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase())) {
        files.set(path, join(destination, relative(legacyRoot, path)));
      }
    }
  }
  await walk(legacyRoot, 0);
  const merged: Catalog = { entries: { ...current.entries }, hidden: [...current.hidden] };
  for (const [id, path] of Object.entries(previous.entries)) {
    const target = files.get(path) ?? path;
    if (merged.entries[id] && merged.entries[id] !== target) {
      throw new LibraryError(409, `Library entry conflict during import: ${id}`);
    }
    if (!merged.entries[id]) {
      merged.entries[id] = target;
      if (previous.hidden.includes(id)) merged.hidden.push(id);
    }
  }
  for (const [source, target] of files) {
    try {
      const existing = await readFile(target);
      if (!(await readFile(source)).equals(existing)) throw new LibraryError(409, `Deck already exists with different contents: ${target}`);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') continue;
      throw error;
    }
  }
  await mkdir(destination, { recursive: true });
  for (const [source, target] of files) {
    await mkdir(dirname(target), { recursive: true });
    try { await copyFile(source, target, constants.COPYFILE_EXCL); }
    catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST' ||
          !(await readFile(source)).equals(await readFile(target))) throw error;
    }
  }
  const temp = join(destination, `.slides-library.${randomUUID()}.tmp`);
  try { await writeIndex(temp, JSON.stringify(merged)); await rename(temp, join(destination, '.slides-library.json')); }
  catch (error) { await unlink(temp).catch(() => {}); throw error; }
  await writeIndex(marker, legacyRoot);
}

let migration: Promise<void> | undefined;
function prepareLibrary(): Promise<void> {
  if (overriddenRoot) return Promise.resolve();
  return migration ??= migrateLegacyLibrary(join(process.cwd(), 'library'), libraryRoot);
}
async function updateCatalog<T>(change: (value: Catalog) => T | Promise<T>): Promise<T> {
  const task = indexLock.catch(() => {}).then(async () => {
    await prepareLibrary();
    await mkdir(libraryRoot, { recursive: true });
    const value = await catalog();
    const result = await change(value);
    const temp = `${indexPath}.${randomUUID()}.tmp`;
    try { await writeIndex(temp, JSON.stringify(value)); await rename(temp, indexPath); }
    catch (error) { await unlink(temp).catch(() => {}); throw error; }
    return result;
  });
  indexLock = task;
  return task;
}
async function writeIndex(path: string, content: string): Promise<void> {
  const file = await open(path, 'wx');
  try { await file.writeFile(content); await file.sync(); }
  finally { await file.close(); }
}
function validName(name: string): boolean {
  return typeof name === 'string' && /^[\w][\w .-]*\.(md|mdx)$/i.test(name);
}

export function deckId(name: string): string {
  return Buffer.from(name, 'utf8').toString('base64url');
}

function decode(id: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new LibraryError(400, 'Invalid deck id');
  const name = Buffer.from(id, 'base64url').toString('utf8');
  if (deckId(name) !== id || !name || isAbsolute(name) || name.split(/[\\/]/).some(p => p === '..' || p === '.' || !p)) throw new LibraryError(400, 'Invalid deck id');
  return name;
}

export class LibraryError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}

async function pathFor(id: string, mustExist = true): Promise<string> {
  await prepareLibrary();
  if (mustExist) {
    const value = await catalog();
    const path = value.entries[id];
    if (!path || value.hidden.includes(id)) throw new LibraryError(404, 'File is not in the library');
    if (!isAbsolute(path) || !extensions.has(path.slice(path.lastIndexOf('.')).toLowerCase())) throw new LibraryError(500, 'Invalid library path');
    const canonical = await realpath(path);
    if (canonical !== path) throw new LibraryError(403, 'Granted file moved or became a symlink; relink it');
    return canonical;
  }
  const name = decode(id);
  if (!extensions.has(name.slice(name.lastIndexOf('.')).toLowerCase())) throw new LibraryError(400, 'Only .md and .mdx decks are supported');
  const root = await realpath(libraryRoot);
  const target = resolve(root, name);
  if (!relative(root, target) || relative(root, target).startsWith(`..${sep}`) || relative(root, target) === '..' || isAbsolute(relative(root, target))) throw new LibraryError(403, 'Outside library');
  const parent = await realpath(dirname(target));
  if (parent !== root && (!relative(root, parent) || relative(root, parent).startsWith(`..${sep}`) || relative(root, parent) === '..')) throw new LibraryError(403, 'Outside library');
  return target;
}

async function read(id: string) {
  const path = await pathFor(id);
  const info = await stat(path);
  if (!info.isFile() || info.size > 2_000_000) throw new LibraryError(400, 'Deck must be a file under 2 MB');
  const bytes = await readFile(path);
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const revision = createHash('sha256').update(bytes).update(`:${info.dev}:${info.ino}:${info.mtimeMs}`).digest('hex');
  return { text, revision, path, info };
}

export async function filenameTitle(id: string): Promise<string> {
  return basename(await pathFor(id)).replace(/\.(md|mdx)$/i, '');
}

export async function openDeck(id: string) {
  const { text, revision } = await read(id);
  return { id, text, revision, ...compileDeck(text, await filenameTitle(id)) };
}

export async function listDecks() {
  await prepareLibrary();
  await mkdir(libraryRoot, { recursive: true });
  const root = await realpath(libraryRoot);
  const found: Record<string, string> = {};
  async function walk(dir: string, depth: number) {
    if (depth > 8 || Object.keys(found).length >= 1000) return;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path, depth + 1);
      else if (entry.isFile() && extensions.has(entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase())) {
        const name = relative(root, path);
        found[deckId(name)] = path;
      }
    }
  }
  await walk(root, 0);
  return updateCatalog(async value => {
    for (const [id, path] of Object.entries(found)) {
      if (!value.entries[id]) value.entries[id] = path;
    }
    const decks: { id: string; name: string; title: string; path: string; missing: boolean }[] = [];
    for (const [id, path] of Object.entries(value.entries)) {
      if (value.hidden.includes(id)) continue;
      let missing = false;
      try {
        const file = await stat(path);
        missing = !file.isFile();
      } catch (error) {
        if (error instanceof Error && 'code' in error && ['ENOENT', 'ENOTDIR'].includes(String(error.code))) missing = true;
        else throw error;
      }
      const name = basename(path);
      decks.push({ id, name, title: name.replace(/\.(md|mdx)$/i, ''), path, missing });
    }
    return decks.sort((a, b) => a.name.localeCompare(b.name));
  });
}

export async function grantDeck(path: string, relinkId?: string) {
  if (typeof path !== 'string' || !isAbsolute(path) || !extensions.has(path.slice(path.lastIndexOf('.')).toLowerCase())) {
    throw new LibraryError(400, 'Enter an absolute .md or .mdx file path');
  }
  const canonical = await realpath(path);
  if (canonical !== resolve(path) || !(await stat(canonical)).isFile()) throw new LibraryError(403, 'Select a regular file, not a symlink');
  if ((await stat(canonical)).size > 2_000_000) throw new LibraryError(400, 'Deck exceeds 2 MB');
  await prepareLibrary();
  const root = await realpath(libraryRoot);
  const inside = relative(root, canonical);
  const id = inside && !inside.startsWith(`..${sep}`) && inside !== '..' && !isAbsolute(inside) && !relinkId
    ? deckId(inside) : relinkId || `ext-${randomUUID()}`;
  await updateCatalog(value => {
    if (relinkId && !Object.hasOwn(value.entries, relinkId)) throw new LibraryError(404, 'Library entry not found');
    if (Object.entries(value.entries).some(([other, item]) => other !== id && item === canonical && !value.hidden.includes(other))) {
      throw new LibraryError(409, 'File is already in the library');
    }
    value.entries[id] = canonical;
    value.hidden = value.hidden.filter(item => item !== id);
  });
  return { id };
}

export async function removeDeck(id: string) {
  await updateCatalog(value => {
    if (!Object.hasOwn(value.entries, id) || value.hidden.includes(id)) throw new LibraryError(404, 'Library entry not found');
    value.hidden.push(id);
  });
}

export async function createDeck(name: string, text: string) {
  if (!validName(name) || typeof text !== 'string') throw new LibraryError(400, 'Invalid deck name or source');
  const compiled = compileDeck(text);
  if (!compiled.deck) throw new LibraryError(422, 'Invalid source', compiled.diagnostics);
  await prepareLibrary();
  await mkdir(libraryRoot, { recursive: true });
  const path = await pathFor(deckId(name), false);
  const handle = await open(path, 'wx');
  try { await handle.writeFile(text); await handle.sync(); }
  finally { await handle.close(); }
  await updateCatalog(value => { value.entries[deckId(name)] = path; value.hidden = value.hidden.filter(id => id !== deckId(name)); });
  return openDeck(deckId(name));
}

export async function duplicateDeck(id: string, name: string) {
  if (!validName(name)) throw new LibraryError(400, 'Invalid deck name');
  const source = await read(id);
  const destination = await pathFor(deckId(name), false);
  await copyFile(source.path, destination, constants.COPYFILE_EXCL);
  await updateCatalog(value => { value.entries[deckId(name)] = destination; value.hidden = value.hidden.filter(item => item !== deckId(name)); });
  return openDeck(deckId(name));
}

export async function renameDeck(id: string, name: string, baseRevision: string) {
  if (!validName(name) || typeof baseRevision !== 'string') throw new LibraryError(400, 'Invalid rename request');
  const source = await read(id);
  if (source.revision !== baseRevision) throw new LibraryError(409, 'Deck changed on disk', {
    diskRevision: source.revision, diskText: source.text
  });
  const destination = await pathFor(deckId(name), false);
  if (destination.toLowerCase() === source.path.toLowerCase()) return openDeck(id);
  await link(source.path, destination);
  try { await unlink(source.path); }
  catch (error) {
    await unlink(destination).catch(cleanupError => console.error('Cannot clean up failed rename:', cleanupError));
    throw error;
  }
  await updateCatalog(value => {
    delete value.entries[id];
    value.entries[deckId(name)] = destination;
  });
  return openDeck(deckId(name));
}

export async function deleteDeck(id: string, baseRevision: string, confirm: boolean) {
  if (!confirm || typeof baseRevision !== 'string') throw new LibraryError(400, 'Confirmed revision required for delete');
  const disk = await read(id);
  if (disk.revision !== baseRevision) throw new LibraryError(409, 'Deck changed on disk', {
    diskRevision: disk.revision, diskText: disk.text
  });
  await unlink(disk.path);
  await updateCatalog(value => { delete value.entries[id]; });
  return { deleted: true };
}

export async function saveDeck(id: string, baseRevision: string, text: string) {
  if (typeof baseRevision !== 'string' || typeof text !== 'string' || text.length > 2_000_000) throw new LibraryError(400, 'Invalid save request');
  const predecessor = locks.get(id) ?? Promise.resolve();
  const task = predecessor.catch(() => {}).then(async () => {
    const disk = await read(id);
    if (disk.revision !== baseRevision) throw new LibraryError(409, 'Deck changed on disk', {
      diskRevision: disk.revision, diskText: disk.text, draftText: text
    });
    const path = await pathFor(id);
    if (path !== disk.path) throw new LibraryError(409, 'Deck path changed during save', {
      diskRevision: disk.revision, diskText: disk.text, draftText: text
    });
    const temp = join(dirname(path), `.${basename(path)}.${crypto.randomUUID()}.tmp`);
    const handle = await open(temp, 'wx', disk.info.mode);
    try {
      await handle.writeFile(text);
      await handle.sync();
    } finally { await handle.close(); }
    try {
      const latest = await read(id);
      if (latest.revision !== disk.revision || latest.path !== disk.path) throw new LibraryError(409, 'Deck changed on disk', {
        diskRevision: latest.revision, diskText: latest.text, draftText: text
      });
      await rename(temp, path);
      try {
        const parent = await open(dirname(path), 'r');
        try { await parent.sync(); } finally { await parent.close(); }
      } catch (error) {
        if (process.platform !== 'win32') throw error;
      }
    } catch (error) {
      await unlink(temp).catch(() => {});
      throw error;
    }
    const persisted = await read(id);
    if (persisted.text !== text) throw new LibraryError(500, 'Saved bytes differ from requested source');
    return { revision: persisted.revision, ...compileDeck(text, await filenameTitle(id)) };
  });
  locks.set(id, task);
  try { return await task; }
  finally { if (locks.get(id) === task) locks.delete(id); }
}
