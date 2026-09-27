import { clearTheme, editableLines, hasUniqueSlideIds, insertSlide, layouts, propagateSlideIdChange, replacePlainLine, setDeckTitle, setLayout, setMaster, setSlideMetadata, setSlideSection, setTheme, themeNames } from './source-edit';
import { markdown, overlayMode, renderStage, themePresets, type Deck, type Slide, type Snapshot, type Stage, type Stroke } from './render';
import { drawStage } from './stage-view';
import { masterSamples } from './master-samples';
import { metadataPositions, metadataValues, type MetadataKey } from './slide-options';

type LibraryEntry = { id: string; name: string; path: string; missing?: boolean };
type Diagnostic = { severity: string; message: string; code?: string; sourceSpan?: { start?: number; end?: number }; slideId?: string };
type DeckResponse = { text: string; revision: string; deck: Deck | null; diagnostics: Diagnostic[] };
type SessionResponse = { sessionId: string; localKey: string; snapshot: Snapshot; notes: Record<string, string> };
type BootstrapResponse = { token: string; library: LibraryEntry[]; devMode: boolean };
type Page = 'library' | 'editor' | 'presentation';
type View = 'source' | 'split' | 'preview';

const $ = <T extends Element = HTMLElement>(id: string): T => {
  const element = document.querySelector<T>(`[id="${CSS.escape(id)}"]`);
  if (!element) throw new Error(`Missing interface element: ${id}`);
  return element;
};
const text = (id: string, value: string) => { $(id).textContent = value; };
const sourceInput = $<HTMLTextAreaElement>('source');
let page: Page = 'library';
let token = '';
let library: LibraryEntry[] = [];
let deckId = '';
let revision = '';
let savedText = '';
let lastRenamableSource = '';
let validText = '';
let compiled: Deck | null = null;
let selected = '';
let view: View = 'split';
let compileGeneration = 0;
let compileTimer: ReturnType<typeof setTimeout> | undefined;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let saving: Promise<boolean> | undefined;
let conflicted = false;
let diskConflict: { diskRevision: string; diskText: string; draftText: string } | null = null;
let session: SessionResponse | null = null;
let sharing = false;
let shareUrl = '';
let tool: 'pen' | 'highlighter' | 'laser' | null = null;
let drawing: { points: Array<{ x: number; y: number }>; pointer: number } | null = null;
let eventPending = false;
let sessionStart = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
const outlineCollapsed = new Set<string>();
const previewCollapsed = new Set<string>();

class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly data: unknown) { super(message); }
}

async function loadBootstrap(): Promise<BootstrapResponse> {
  const response = await fetch('/api/bootstrap', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Bootstrap failed (${response.status}). Start with bun run dev or bun run start.`);
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object' || !('token' in data) || typeof data.token !== 'string' ||
      !data.token || !('library' in data) || !Array.isArray(data.library) ||
      !('devMode' in data) || typeof data.devMode !== 'boolean') {
    throw new Error('Application bootstrap returned invalid data.');
  }
  return data as BootstrapResponse;
}

async function request<T>(path: string, method = 'GET', body?: object): Promise<T> {
  const payload = body ? JSON.stringify(body) : undefined;
  const send = () => fetch(path, {
    method,
    headers: { 'X-Slides-Token': token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(payload ? { body: payload } : {}),
  });
  const read = async (response: Response): Promise<unknown> => {
    if (response.status === 204) return null;
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error(`Application API returned a non-JSON response (${response.status}). Start the app with bun run dev or bun run start.`);
    }
    return response.json();
  };
  let response = await send();
  let data = await read(response);
  if (response.status === 403 && data && typeof data === 'object' && 'error' in data &&
      data.error === 'Owner token required') {
    token = (await loadBootstrap()).token;
    response = await send();
    data = await read(response);
  }
  if (!response.ok) {
    const detail = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
      ? data.error : `Request failed (${response.status}).`;
    throw new ApiError(response.status, detail, data);
  }
  return data as T;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
function notify(value: string): void {
  const toast = $('toast');
  toast.textContent = value;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 6000);
}
function show(next: Page): void {
  page = next;
  for (const name of ['library', 'editor', 'presentation'] as const) {
    $(`${name}-page`).hidden = name !== next;
  }
  $('editor-actions').hidden = next !== 'editor';
  $('presenter-actions').hidden = next !== 'presentation';
  $('edit-title').hidden = next !== 'editor';
  $('title-input').hidden = true;
  $('page-title').hidden = false;
  $('app').setAttribute('aria-busy', 'false');
}
function errorNotice(error: unknown): void { notify(message(error)); }
function dialog(id: string): HTMLDialogElement { return $<HTMLDialogElement>(id); }
function isDirty(): boolean { return !!deckId && sourceInput.value !== savedText; }
function updateSaveButton(): void {
  $('save').toggleAttribute('disabled', page !== 'editor' || !isDirty() || !!saving);
}
function optionLabel(value: string): string {
  return value.replace(/-/g, ' ').replace(/\b[a-z]/g, letter => letter.toUpperCase());
}
function status(value: string, warn = false): void {
  const pill = $('save-status');
  pill.hidden = false;
  pill.textContent = value;
  pill.classList.toggle('warning', warn);
}

function renderLibrary(): void {
  text('library-count', `${library.length} deck${library.length === 1 ? '' : 's'}`);
  const list = $('deck-list');
  list.replaceChildren();
  if (!library.length) list.textContent = 'No decks yet. Create or open a file to get started.';
  for (const entry of library) {
    const card = document.createElement('article');
    card.className = 'deck-card';
    const title = document.createElement('h3');
    title.textContent = entry.name;
    const path = document.createElement('p');
    path.className = 'deck-path';
    path.textContent = entry.path;
    const actions = document.createElement('div');
    actions.className = 'actions';
    const open = document.createElement('button');
    open.type = 'button';
    open.textContent = entry.missing ? 'Relink' : 'Edit deck';
    open.addEventListener('click', () => {
      if (entry.missing) {
        const input = $<HTMLInputElement>('deck-path');
        input.value = entry.path;
        input.focus();
        input.dataset.relinkId = entry.id;
        notify('Enter the new absolute path, then choose Relink file.');
        text('open', 'Relink file');
      } else void openDeck(entry.id);
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove from library';
    remove.setAttribute('aria-label', `Remove ${entry.name} from library (file remains on disk)`);
    remove.addEventListener('click', async () => {
      if (!confirm(`Remove "${entry.name}" from your library? The file stays on disk.`)) return;
      try {
        library = (await request<{ library: LibraryEntry[] }>('/api/library', 'POST', { action: 'remove', id: entry.id })).library;
        renderLibrary();
      } catch (error) { errorNotice(error); }
    });
    actions.append(open, remove);
    card.append(title, path);
    if (entry.missing) {
      const missing = document.createElement('p');
      missing.className = 'warning-text';
      missing.textContent = 'File missing — relink to its new location.';
      card.append(missing);
    }
    card.append(actions);
    list.append(card);
  }
}

async function libraryAction(payload: object): Promise<void> {
  try {
    const result = await request<{ library: LibraryEntry[]; id?: string }>('/api/library', 'POST', payload);
    library = result.library;
    renderLibrary();
    const entry = payload as { action: string; id?: string; name?: string; path?: string };
    if (entry.action === 'create' || entry.action === 'open' || entry.action === 'demo') {
      const added = library.find(item => item.id === result.id);
      if (added) await openDeck(added.id);
      else notify('Added to library. Select the deck to edit it.');
    } else if (entry.action === 'relink' && entry.id) await openDeck(entry.id);
  } catch (error) { errorNotice(error); }
}

async function openDeck(id: string): Promise<void> {
  if (isDirty() && !confirm('Your changes are not saved. Leave this deck?')) return;
  try {
    if (saving) await saving;
    const result = await request<DeckResponse>(`/api/decks/${encodeURIComponent(id)}`);
    clearTimeout(saveTimer);
    clearTimeout(compileTimer);
    ++compileGeneration;
    deckId = id;
    sourceInput.value = savedText = result.text;
    lastRenamableSource = result.text;
    revision = result.revision;
    compiled = result.deck;
    outlineCollapsed.clear();
    previewCollapsed.clear();
    validText = result.deck ? result.text : '';
    conflicted = false;
    diskConflict = null;
    selected = result.deck?.order[0] || result.deck?.slides[0]?.id || '';
    text('source-file', library.find(item => item.id === id)?.path || '');
    text('page-title', result.deck?.title || library.find(item => item.id === id)?.name || 'Editor');
    setView('split');
    show('editor');
    updateDiagnostics(result.diagnostics);
    updateEditor();
    updateSaveButton();
    if (result.deck) status('Saved');
    else status('Source has errors — edit to preview', true);
  } catch (error) { errorNotice(error); }
}

function setView(next: View): void {
  view = next;
  $('master-pane').hidden = true;
  $('editor-panes').hidden = false;
  $('editor-panes').dataset.view = next;
  syncEditorNavigation();
}
function syncEditorNavigation(): void {
  const settingsActive = !$('master-pane').hidden;
  for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-view]')) {
    button.setAttribute('aria-pressed', String(!settingsActive && button.dataset.view === view));
  }
  document.querySelector('#settings-button')?.setAttribute('aria-current', settingsActive ? 'page' : 'false');
  for (const button of document.querySelectorAll<HTMLButtonElement>('.outline-item')) {
    button.setAttribute('aria-current', String(!settingsActive && button.dataset.slideId === selected));
  }
}
function updateDiagnostics(diagnostics: Diagnostic[] = []): void {
  const area = $('diagnostics');
  area.replaceChildren();
  for (const item of diagnostics) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = item.severity === 'error' ? 'diagnostic error' : 'diagnostic warning-text';
    row.textContent = `${item.severity.toUpperCase()}${item.code ? ` ${item.code}` : ''}: ${item.message}`;
    row.addEventListener('click', () => {
      setView('source');
      if (item.slideId && compiled?.slides.some(slide => slide.id === item.slideId)) selectSlide(item.slideId);
      if (item.sourceSpan?.start !== undefined) {
        sourceInput.focus();
        sourceInput.setSelectionRange(item.sourceSpan.start, item.sourceSpan.end ?? item.sourceSpan.start);
      }
    });
    area.append(row);
  }
  if (!diagnostics.length) area.textContent = 'No diagnostics';
}

function selectSlide(id: string): void {
  if (!$('master-pane').hidden) setView(view);
  selected = id;
  const group = groupSlides(compiled?.slides || []).find(item => item.slides.some(slide => slide.id === id));
  if (group) {
    outlineCollapsed.delete(group.key);
    previewCollapsed.delete(group.key);
  }
  updateEditor();
  const card = [...document.querySelectorAll<HTMLElement>('.preview-card')].find(item => item.dataset.slideId === id);
  card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function sectionName(slide: Slide): string {
  if (slide.section) return slide.section;
  if (slide.layout === 'blank') return 'Blank slides';
  if (slide.layout.startsWith('title-image-')) return 'Title slides';
  if (slide.body.includes('```chart')) return 'Chart slides';
  if (slide.body.includes('```mermaid')) return 'Diagram slides';
  if (slide.layout === 'image-full' || slide.layout === 'picture-text' ||
      slide.body.includes('![') || Object.values(slide.slots).some(value => value.includes('!['))) return 'Image slides';
  if (slide.body.includes('```')) return 'Code slides';
  if (!Object.keys(slide.slots).length && !slide.reveals.length &&
      /^# [^\n]+(?:\n+\S[^\n]*)?\s*$/.test(slide.body.trim())) return 'Title slides';
  return 'Content slides';
}

function groupSlides(slides: Slide[]): Array<{ key: string; name: string; slides: Slide[] }> {
  const groups: Array<{ key: string; name: string; slides: Slide[] }> = [];
  for (const slide of slides) {
    const name = sectionName(slide);
    const previous = groups.at(-1);
    if (previous?.name === name) previous.slides.push(slide);
    else groups.push({ key: slide.id, name, slides: [slide] });
  }
  return groups;
}

function sectionGroup(name: string, count: number, key: string, collapsed: Set<string>): HTMLDetailsElement {
  const group = document.createElement('details');
  group.className = 'slide-group';
  group.open = !collapsed.has(key);
  const summary = document.createElement('summary');
  summary.textContent = `${name} · ${count} ${count === 1 ? 'slide' : 'slides'}`;
  group.append(summary);
  group.addEventListener('toggle', () => {
    if (group.open) collapsed.delete(key);
    else collapsed.add(key);
  });
  return group;
}

function updateOutline(): void {
  const outline = $('outline');
  outline.replaceChildren();
  const heading = document.createElement('h2');
  heading.textContent = 'Slide outline';
  outline.append(heading);
  const settings = document.createElement('button');
  settings.type = 'button';
  settings.id = 'settings-button';
  settings.textContent = 'Master settings';
  settings.addEventListener('click', () => {
    if ($('master-pane').hidden) openSettings();
    else setView(view);
  });
  outline.append(settings);
  const list = document.createElement('div');
  list.className = 'outline-slides';
  outline.append(list);
  const slides = compiled?.slides || [];
  const byId = new Map(slides.map(slide => [slide.id, slide]));
  for (const { key, name, slides: members } of groupSlides(slides)) {
    const group = sectionGroup(name, members.length, key, outlineCollapsed);
    list.append(group);
    for (const slide of members) {
      let depth = 0;
      let parent = slide.parent;
      const seen = new Set<string>();
      while (parent && byId.has(parent) && !seen.has(parent)) {
        seen.add(parent);
        depth++;
        parent = byId.get(parent)?.parent;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'outline-item';
      button.dataset.slideId = slide.id;
      button.style.paddingInlineStart = `${12 + Math.min(depth, 5) * 16}px`;
      button.textContent = `${slide.index + 1}. ${slide.body.match(/^#{1,3}\s+(.+)$/m)?.[1] || slide.id}`;
      button.addEventListener('click', () => selectSlide(slide.id));
      group.append(button);
    }
  }
  const actions = document.createElement('div');
  actions.className = 'outline-actions';
  const addButton = (label: string, parent?: string): HTMLButtonElement => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'add-slide';
    const icon = document.createElement('span');
    icon.className = 'add-slide-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>';
    button.append(icon, document.createTextNode(label));
    button.addEventListener('click', () => {
      try {
        const added = insertSlide(sourceInput.value, parent, parent ? undefined : selected || undefined);
        if (!$('master-pane').hidden) setView(view);
        editSource(added.text);
        selected = added.id;
        sourceInput.focus();
        sourceInput.setSelectionRange(added.start, added.start);
      }
      catch (error) { errorNotice(error); }
    });
    return button;
  };
  actions.append(addButton('Add slide'));
  if (selected) actions.append(addButton('Add child slide', selected));
  outline.append(actions);
  syncEditorNavigation();
}

async function updatePreview(): Promise<void> {
  const list = $('preview');
  if (document.activeElement instanceof HTMLElement &&
      document.activeElement.closest('#preview [contenteditable="plaintext-only"]')) return;
  const openOptions = new Set([...list.querySelectorAll<HTMLDetailsElement>('.slide-options[open]')]
    .map(item => item.dataset.slideId));
  list.replaceChildren();
  const deck = compiled;
  if (!deck) {
    list.textContent = 'Fix source diagnostics to restore preview.';
    return;
  }
  for (const { key, name, slides } of groupSlides(deck.slides)) {
    const group = sectionGroup(name, slides.length, key, previewCollapsed);
    const deferred: Array<() => void> = [];
    list.append(group);
    for (const slide of slides) {
      const card = document.createElement('article');
      card.className = 'preview-card';
      card.dataset.slideId = slide.id;
      if (slide.id === selected) card.classList.add('selected');
      const heading = document.createElement('div');
      heading.className = 'preview-heading';
      const label = document.createElement('strong');
      label.textContent = `${slide.index + 1} · ${slide.id}`;
      const type = document.createElement('span');
      type.className = 'layout-type';
      type.textContent = optionLabel(slide.layout);
      const layout = document.createElement('select');
      layout.setAttribute('aria-label', `Layout for slide ${slide.index + 1}`);
      for (const name of layouts) layout.add(new Option(optionLabel(name), name));
      layout.value = slide.layout;
      layout.disabled = !canEditPreview();
      layout.addEventListener('change', () => {
        try { editSource(setLayout(sourceInput.value, slide.id, layout.value)); }
        catch (error) { errorNotice(error); }
      });
      heading.append(label, type, layout);
      const options = document.createElement('details');
      options.className = 'slide-options';
      options.dataset.slideId = slide.id;
      options.open = openOptions.has(slide.id);
      const summary = document.createElement('summary');
      summary.textContent = 'Section and slide metadata';
      const fields = document.createElement('div');
      fields.className = 'slide-options-fields';
      const sectionLabel = document.createElement('label');
      sectionLabel.textContent = 'Section';
      const sectionInput = document.createElement('input');
      sectionInput.type = 'text';
      sectionInput.maxLength = 60;
      sectionInput.value = slide.section || '';
      sectionInput.placeholder = `Automatic: ${sectionName({ ...slide, section: undefined })}`;
      sectionInput.disabled = !canEditPreview();
      sectionInput.setAttribute('aria-label', `Section for slide ${slide.index + 1}`);
      sectionInput.addEventListener('change', () => {
        try { editSource(setSlideSection(sourceInput.value, slide.id, sectionInput.value || undefined)); }
        catch (error) { errorNotice(error); }
      });
      sectionLabel.append(sectionInput);
      fields.append(sectionLabel);
      for (const position of metadataPositions) {
        const field = `metadata${position}` as MetadataKey;
        const fieldLabel = document.createElement('label');
        fieldLabel.textContent = position.replace(/(Top|Bottom)(Left|Center|Right)/, '$1 $2');
        const select = document.createElement('select');
        select.setAttribute('aria-label', `Slide ${slide.index + 1} ${position.replace(/([a-z])([A-Z])/, '$1-$2').toLowerCase()} metadata override`);
        select.add(new Option('Inherit master setting', ''));
        for (const value of metadataValues) select.add(new Option(optionLabel(value), value));
        select.value = slide.metadata?.[field] || '';
        select.disabled = !canEditPreview();
        select.addEventListener('change', () => {
          try { editSource(setSlideMetadata(sourceInput.value, slide.id, field, select.value || undefined)); }
          catch (error) { errorNotice(error); }
        });
        fieldLabel.append(select);
        fields.append(fieldLabel);
      }
      options.append(summary, fields);
      const stage = document.createElement('div');
      stage.className = 'stage preview-stage';
      stage.addEventListener('click', () => { selected = slide.id; updateOutline(); });
      card.append(heading, options, stage);
      group.append(card);
      const draw = () => {
        if (stage.dataset.rendered) return;
        stage.dataset.rendered = 'true';
        void renderStage(stage, deck, slide, slide.reveals.length).then(() => {
          if (!card.isConnected || compiled !== deck || !canEditPreview()) return;
          const sourceLines = editableLines(sourceInput.value, slide.id, slide.body);
          const rendered = stage.querySelector('.slide-content > .slide-markdown');
          if (!rendered?.classList.contains('slide-markdown')) return;
          const paragraphs = new Map<string, HTMLElement[]>();
          for (const element of rendered.children) {
            if (!(element instanceof HTMLParagraphElement)) continue;
            const value = element.textContent || '';
            paragraphs.set(value, [...paragraphs.get(value) || [], element]);
          }
          const byText = new Map<string, typeof sourceLines>();
          for (const line of sourceLines) byText.set(line.display, [...byText.get(line.display) || [], line]);
          for (const [value, lines] of byText) {
            const matches = paragraphs.get(value);
            if (!matches || matches.length !== lines.length) continue;
            matches.forEach((paragraph, index) => {
              const line = lines[index];
              paragraph.contentEditable = 'plaintext-only';
              paragraph.setAttribute('role', 'textbox');
              paragraph.setAttribute('aria-label', `Edit plain text on slide ${slide.index + 1}, paragraph ${sourceLines.indexOf(line) + 1}`);
              paragraph.setAttribute('aria-multiline', 'false');
              paragraph.title = 'Click to edit this plain-text paragraph';
              let canceled = false;
              paragraph.addEventListener('keydown', event => {
                if (event.key === 'Escape') { canceled = true; paragraph.textContent = line.display; paragraph.blur(); }
                if (event.key === 'Enter') { event.preventDefault(); paragraph.blur(); }
                event.stopPropagation();
              });
              paragraph.addEventListener('blur', () => {
                if (canceled || paragraph.textContent === line.display) return;
                if (!canEditPreview() || sourceInput.value.slice(line.start, line.end) !== line.text) {
                  notify('Preview changed while editing; draft was not modified.');
                  return;
                }
                try { editSource(replacePlainLine(sourceInput.value, line, paragraph.textContent || '')); }
                catch (error) { errorNotice(error); }
              });
            });
          }
        }).catch(errorNotice);
      };
      deferred.push(draw);
      if (group.open) draw();
    }
    group.addEventListener('toggle', () => { if (group.open) deferred.forEach(draw => draw()); });
  }
}

function canEditPreview(): boolean { return !conflicted && !!compiled && validText === sourceInput.value; }
function updateEditor(): void {
  updateOutline();
  void updatePreview();
  const theme = $<HTMLSelectElement>('theme');
  theme.value = compiled?.theme || 'signal';
  $('present').toggleAttribute('disabled', !compiled || !compiled.slides.length || !canEditPreview());
  $('preview-label').textContent = canEditPreview()
    ? 'Plain-text paragraphs can be edited here'
    : 'Preview edits paused until source is valid and current';
}
function editSource(value: string): void {
  if (value === sourceInput.value) return;
  sourceInput.value = value;
  sourceInput.dispatchEvent(new Event('input', { bubbles: true }));
}
function scheduleCompile(): void {
  const generation = ++compileGeneration;
  validText = '';
  for (const paragraph of $('preview').querySelectorAll<HTMLElement>('[contenteditable="plaintext-only"]')) {
    paragraph.removeAttribute('contenteditable');
    paragraph.removeAttribute('role');
    paragraph.removeAttribute('aria-label');
    paragraph.removeAttribute('aria-multiline');
    paragraph.removeAttribute('title');
  }
  $('preview-label').textContent = 'Preview edits paused until source is valid and current';
  status('Compiling draft…', true);
  $('present').setAttribute('disabled', '');
  clearTimeout(compileTimer);
  compileTimer = setTimeout(async () => {
    const draft = sourceInput.value;
    try {
      const result = await request<{ deck: Deck | null; diagnostics: Diagnostic[] }>('/api/compile', 'POST', { text: draft, deckId });
      if (generation !== compileGeneration || draft !== sourceInput.value || page !== 'editor') return;
      updateDiagnostics(result.diagnostics);
      if (result.deck && !result.diagnostics.some(item => item.severity === 'error')) {
        compiled = result.deck;
        validText = draft;
        if (!compiled.slides.some(slide => slide.id === selected)) selected = compiled.order[0] || compiled.slides[0]?.id || '';
        text('page-title', compiled.title);
        status(isDirty() ? 'Unsaved draft' : 'Saved');
      } else {
        status('Invalid source — showing last valid preview; edits disabled', true);
      }
      updateEditor();
      if (!$('master-pane').hidden) openSettings();
    } catch (error) {
      if (generation !== compileGeneration) return;
      updateEditor();
      status(`Compile failed: ${message(error)}`, true);
    }
  }, 250);
}
async function save(): Promise<boolean> {
  if (saving) {
    if (!await saving) return false;
    return isDirty() ? save() : true;
  }
  if (!isDirty()) return true;
  if (conflicted) { dialog('conflict-dialog').showModal(); return false; }
  const draft = sourceInput.value;
  const baseRevision = revision;
  status('Saving…');
  saving = (async () => {
    try {
      const result = await request<{ revision: string; deck: Deck | null; diagnostics: Diagnostic[] }>(
        `/api/decks/${encodeURIComponent(deckId)}`, 'PUT', { baseRevision, text: draft });
      revision = result.revision;
      savedText = draft;
      if (sourceInput.value === draft) {
        if (result.deck) compiled = result.deck;
        validText = result.deck ? draft : '';
        updateDiagnostics(result.diagnostics);
        updateEditor();
      }
      status(result.deck ? (isDirty() ? 'Unsaved changes' : 'Saved') : 'Saved invalid source — showing last valid preview', !result.deck);
      return true;
    } catch (error) {
      const details = error instanceof ApiError && error.data && typeof error.data === 'object' && 'details' in error.data
        ? error.data.details : null;
      if (error instanceof ApiError && error.status === 409 && details && typeof details === 'object' &&
        'diskRevision' in details && typeof details.diskRevision === 'string' &&
        'diskText' in details && typeof details.diskText === 'string') {
        const body = { diskRevision: details.diskRevision, diskText: details.diskText, draftText: sourceInput.value };
        diskConflict = body;
        conflicted = true;
        $<HTMLTextAreaElement>('disk-text').value = body.diskText;
        $<HTMLTextAreaElement>('draft-text').value = sourceInput.value;
        dialog('conflict-dialog').showModal();
        status('Disk conflict — draft retained', true);
      } else status(`Save failed — draft retained: ${message(error)}`, true);
      return false;
    } finally {
      saving = undefined;
      updateSaveButton();
    }
  })();
  updateSaveButton();
  return saving;
}
function scheduleSave(): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { if (page === 'editor' && !conflicted) void save(); }, 1500);
}

const masterSections = ['Theme', 'Heading', 'Body', 'Code', 'Placements', 'Margins', 'Padding'] as const;
let selectedMasterSample = 4;
type MasterField = {
  section: typeof masterSections[number]; name: string; label: string;
  type: 'color' | 'text' | 'number' | 'select'; fallback?: string; min?: number; max?: number;
};
const masterFields: MasterField[] = [
  { section: 'Theme', name: 'theme', label: 'Theme', type: 'select' },
  { section: 'Theme', name: 'surface', label: 'Surface', type: 'color' },
  { section: 'Theme', name: 'text', label: 'Text color', type: 'color' },
  { section: 'Theme', name: 'accent', label: 'Accent', type: 'color' },
  { section: 'Theme', name: 'muted', label: 'Muted text', type: 'color' },
  { section: 'Heading', name: 'headingPlacement', label: 'Heading placement', type: 'select', fallback: 'left' },
  { section: 'Heading', name: 'headingFont', label: 'Heading font', type: 'text' },
  { section: 'Heading', name: 'headingSize', label: 'Heading size', type: 'number', min: 12, max: 120 },
  { section: 'Body', name: 'bodyFont', label: 'Body font', type: 'text' },
  { section: 'Body', name: 'bodySize', label: 'Body size', type: 'number', min: 12, max: 120 },
  { section: 'Code', name: 'codeFont', label: 'Code font', type: 'text' },
  { section: 'Code', name: 'codeSize', label: 'Code size', type: 'number', min: 12, max: 120 },
  { section: 'Placements', name: 'footer', label: 'Footer text', type: 'text' },
  { section: 'Placements', name: 'logo', label: 'Logo text', type: 'text' },
  ...(['TopLeft', 'TopCenter', 'TopRight', 'BottomLeft', 'BottomCenter', 'BottomRight'] as const)
    .map(position => ({
      section: 'Placements' as const, name: `metadata${position}`, label: position.replace(/(Top|Bottom)(Left|Center|Right)/, '$1 $2'),
      type: 'select' as const
    })),
  ...(['Top', 'Right', 'Bottom', 'Left'] as const).flatMap(direction => [
    { section: 'Margins' as const, name: `margin${direction}`, label: `${direction} margin (%)`, type: 'number' as const, min: 0, max: 20, fallback: '5' },
    { section: 'Padding' as const, name: `padding${direction}`, label: `${direction} padding (%)`, type: 'number' as const, min: 0, max: 20, fallback: '0' }
  ]),
];
function openSettings(): void {
  $('editor-panes').hidden = true;
  $('master-pane').hidden = false;
  syncEditorNavigation();
  const fields = $('settings-fields');
  fields.replaceChildren();
  const sections = new Map(masterSections.map(section => {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'settings-section';
    const legend = document.createElement('legend');
    legend.textContent = section;
    fieldset.append(legend);
    fields.append(fieldset);
    return [section, fieldset] as const;
  }));
  const master = compiled?.master || {};
  const preset = themePresets[compiled?.theme || 'signal'] || themePresets.signal;
  for (const field of masterFields) {
    const label = document.createElement('label');
    label.textContent = field.label;
    const input = field.type === 'select' ? document.createElement('select') : document.createElement('input');
    if (input instanceof HTMLSelectElement) {
      const options = field.name === 'theme' ? themeNames.map(name => [name, name])
        : field.name === 'headingPlacement' ? [['left', 'Left'], ['center', 'Center'], ['right', 'Right']]
        : [
          ['none', 'None'], ['slideNumber', 'Slide number / total'], ['deckTitle', 'Presentation title'],
          ['slideTitle', 'Slide title'], ['footer', 'Footer text'], ['logo', 'Logo text']
        ];
      for (const [name, caption] of options) input.add(new Option(optionLabel(caption), name));
    }
    if (input instanceof HTMLInputElement) {
      input.type = field.type;
      if (field.type === 'number') {
        input.min = String(field.min);
        input.max = String(field.max);
      }
    }
    input.value = String(master[field.name] ?? (
      field.name === 'theme' ? compiled?.theme || 'signal'
        : field.name === 'metadataBottomLeft' && master.footer &&
          !Object.entries(master).some(([key, value]) => key.startsWith('metadata') && value === 'footer') ? 'footer'
          : field.name === 'metadataBottomRight' && master.footerNumber &&
            !Object.entries(master).some(([key, value]) => key.startsWith('metadata') && value === 'slideNumber') ? 'slideNumber'
            : preset[field.name] ?? field.fallback ?? (field.type === 'select' ? 'none' : '')));
    input.addEventListener('change', () => {
      try {
        const value = field.type === 'number' ? Number(input.value) : input.value;
        if (field.type === 'number' && (!input.value.trim() || !Number.isFinite(value as number) ||
          Number(value) < field.min! || Number(value) > field.max!)) {
          throw new Error(`${field.label} must be between ${field.min} and ${field.max}.`);
        }
        editSource(field.name === 'theme' ? setTheme(sourceInput.value, String(value))
          : setMaster(sourceInput.value, field.name, value));
      } catch (error) { errorNotice(error); }
    });
    label.append(input);
    sections.get(field.section)!.append(label);
  }
  const preview = $('master-preview');
  preview.replaceChildren();
  const heading = document.createElement('h2');
  heading.textContent = 'Live layout samples';
  const caption = document.createElement('p');
  caption.textContent = 'Select a sample to see how master settings affect it. Samples do not change your deck.';
  preview.append(heading, caption);
  if (!compiled) {
    preview.append(document.createTextNode('Fix source diagnostics to see the preview.'));
    return;
  }
  const stage: Stage = { title: compiled.title, theme: compiled.theme, master, slides: masterSamples.map(sample => sample.slide) };
  const area = document.createElement('div');
  area.className = 'master-preview-body';
  const viewer = document.createElement('section');
  viewer.className = 'sample-viewer';
  viewer.setAttribute('aria-label', 'Selected layout sample');
  const list = document.createElement('nav');
  list.className = 'sample-list';
  list.setAttribute('aria-label', 'Sample slide layouts');
  let currentSection = '';
  let section: HTMLDetailsElement | undefined;
  const buttons = masterSamples.map(({ section: category, title }, index) => {
    if (category !== currentSection) {
      currentSection = category;
      const count = masterSamples.filter((sample, position) => position >= index && sample.section === category).length;
      section = sectionGroup(category, count, `sample-${index}`, new Set());
      list.append(section);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${index + 1}. ${title}`;
    button.addEventListener('click', () => selectSample(index));
    section!.append(button);
    return button;
  });
  const selectSample = (index: number): void => {
    selectedMasterSample = index;
    const { title: sampleTitle, slide } = masterSamples[index];
    const title = document.createElement('h3');
    title.textContent = sampleTitle;
    const layout = document.createElement('span');
    layout.className = 'layout-type';
    layout.textContent = optionLabel(slide.layout);
    const surface = document.createElement('div');
    surface.className = 'stage';
    viewer.replaceChildren(title, layout, surface);
    buttons.forEach((button, position) => button.setAttribute('aria-current', String(position === index)));
    void renderStage(surface, stage, slide, 0).catch(errorNotice);
  };
  area.append(viewer, list);
  preview.append(area);
  selectSample(selectedMasterSample);
}

function currentSlide(snapshot: Snapshot): Slide | undefined {
  return snapshot.stage.slides.find(slide => slide.id === snapshot.slideId);
}
function drawPresenter(): void {
  if (!session || page !== 'presentation') return;
  const snapshot = session.snapshot;
  const slide = currentSlide(snapshot);
  void drawStage(snapshot, $('stage'), $<SVGSVGElement>('ink'), $('stage-mode'), $('stage-frame')).catch(errorNotice);
  const slides = snapshot.stage.slides;
  const index = slides.findIndex(item => item.id === snapshot.slideId);
  text('slide-progress', `Slide ${index + 1} / ${slides.length}`);
  text('reveal-progress', slide?.reveals.length ? `Reveal ${snapshot.step} / ${slide.reveals.length}` : 'No reveals');
  $('previous').toggleAttribute('disabled', index <= 0 && snapshot.step === 0);
  $('next').toggleAttribute('disabled', index >= slides.length - 1 && snapshot.step >= (slide?.reveals.length || 0));
  const next = snapshot.step < (slide?.reveals.length || 0) ? `Next reveal on ${slide?.id}`
    : slides[index + 1]?.body.match(/^#{1,3}\s+(.+)$/m)?.[1] || slides[index + 1]?.id || 'End of deck';
  text('up-next', next);
  const notes = session.notes?.[snapshot.slideId] || slide?.notes || '';
  $('speaker-notes').replaceChildren(markdown(notes));
  const jump = $<HTMLSelectElement>('jump');
  jump.replaceChildren();
  slides.forEach((item, position) => jump.add(new Option(`${position + 1}. ${optionLabel(item.body.match(/^#{1,3}\s+(.+)$/m)?.[1] || item.id)}`, item.id)));
  jump.value = snapshot.slideId;
  const byId = new Map(slides.map(item => [item.id, item]));
  const children = slides.filter(item => item.parent === snapshot.slideId);
  const siblings = slides.filter(item => item.parent === slide?.parent);
  const siblingIndex = siblings.findIndex(item => item.id === snapshot.slideId);
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-nav]')) {
    const direction = button.dataset.nav;
    button.disabled = direction === 'parent' ? !slide?.parent || !byId.has(slide.parent)
      : direction === 'down' ? !children.length
      : direction === 'up' ? !slide?.parent || !byId.has(slide.parent)
      : direction === 'left' ? siblingIndex <= 0 : siblingIndex >= siblings.length - 1;
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-tool]')) {
    button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
  }
  $('blank').setAttribute('aria-pressed', String(overlayMode(snapshot.overlay?.mode) === 'canvas'));
  $('blackout').setAttribute('aria-pressed', String(overlayMode(snapshot.overlay?.mode) === 'blackout'));
  $('undo').toggleAttribute('disabled', !snapshot.overlay?.strokes?.length);
  $('clear').toggleAttribute('disabled', !snapshot.overlay?.strokes?.length);
  text('share-info', sharing
    ? `Audience URL: ${shareUrl} — network reachability unverified. Share only with trusted viewers.`
    : 'Local only. Sharing is off.');
  text('share', sharing ? 'Stop LAN sharing' : 'Share on LAN…');
}
async function sendEvent(action: string, extra: Record<string, unknown> = {}): Promise<void> {
  if (!session || eventPending) return;
  eventPending = true;
  try {
    const result = await request<{ snapshot: Snapshot; notes: Record<string, string> }>(
      `/api/sessions/${encodeURIComponent(session.sessionId)}/events`, 'POST',
      { sequence: session.snapshot.sequence, action, ...extra });
    session.snapshot = result.snapshot;
    session.notes = result.notes;
    drawPresenter();
  } catch (error) {
    errorNotice(error);
    try {
      const current = await request<{ snapshot: Snapshot; notes: Record<string, string> }>(`/api/sessions/${encodeURIComponent(session.sessionId)}`);
      session.snapshot = current.snapshot;
      session.notes = current.notes;
      drawPresenter();
    } catch (refreshError) { status(`Presentation disconnected: ${message(refreshError)}`, true); }
  } finally { eventPending = false; }
}
async function startPresentation(): Promise<void> {
  clearTimeout(saveTimer);
  clearTimeout(compileTimer);
  if (!canEditPreview()) { notify('Wait for a valid, current preview before presenting.'); return; }
  if (isDirty() && !(await save())) return;
  if (!canEditPreview()) { notify('Fix diagnostics before presenting.'); return; }
  try {
    session = await request<SessionResponse>('/api/sessions', 'POST', { deckId, revision });
    sharing = false;
    sessionStart = Date.now();
    text('page-title', session.snapshot.stage.title);
    show('presentation');
    drawPresenter();
  } catch (error) { errorNotice(error); }
}
function point(event: PointerEvent): { x: number; y: number } {
  const box = $('stage-frame').getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)),
    y: Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)),
  };
}
function toggleTool(value: typeof tool): void {
  tool = tool === value ? null : value;
  $('stage-frame').dataset.tool = tool || '';
  $('laser').hidden = true;
  drawPresenter();
}
function presenterKeys(event: KeyboardEvent): void {
  if (page !== 'presentation' || dialog('shortcuts-dialog').open || dialog('share-dialog').open ||
    dialog('end-dialog').open || drawing) return;
  if (event.target instanceof HTMLElement && (event.target.closest('input, textarea, select, button, [contenteditable]'))) return;
  const shortcut = event.key;
  if ((event.ctrlKey || event.metaKey) && shortcut.toLowerCase() === 'z') {
    event.preventDefault();
    void sendEvent('undo');
    return;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const navigation: Record<string, string> = {
    ' ': 'next', PageDown: 'next', PageUp: 'previous', Backspace: 'previous',
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  };
  if (navigation[shortcut]) {
    event.preventDefault();
    void sendEvent(navigation[shortcut]);
  } else if (shortcut.toLowerCase() === 'b') void sendEvent('mode', { mode: overlayMode(session?.snapshot.overlay?.mode) === 'blackout' ? 'normal' : 'blackout' });
  else if (shortcut.toLowerCase() === 'c') void sendEvent('mode', { mode: overlayMode(session?.snapshot.overlay?.mode) === 'canvas' ? 'normal' : 'canvas' });
  else if (shortcut.toLowerCase() === 'd') toggleTool('pen');
  else if (shortcut.toLowerCase() === 'h') toggleTool('highlighter');
  else if (shortcut.toLowerCase() === 'l') toggleTool('laser');
  else if (shortcut === 'Escape') toggleTool(null);
}

function wire(): void {
  $<HTMLSelectElement>('theme').replaceChildren(...themeNames.map(name => new Option(optionLabel(name), name)));
  $('create').addEventListener('click', () => {
    const name = $<HTMLInputElement>('deck-name').value.trim();
    if (!name) { notify('Enter a deck name.'); return; }
    if (/\.[A-Za-z0-9]+$/.test(name) && !/\.(?:md|mdx)$/i.test(name)) {
      notify('Deck filenames must end in .md or .mdx.');
      return;
    }
    void libraryAction({ action: 'create', name });
  });
  $('open-demo').addEventListener('click', () => void libraryAction({ action: 'demo' }));
  $('open').addEventListener('click', () => {
    const input = $<HTMLInputElement>('deck-path');
    const path = input.value.trim();
    if (!path) { notify('Enter an absolute path.'); return; }
    const id = input.dataset.relinkId;
    void libraryAction(id ? { action: 'relink', id, path } : { action: 'open', path });
    delete input.dataset.relinkId;
    text('open', 'Open file');
  });
  $('deck-path').addEventListener('keydown', event => { if (event.key === 'Enter') $('open').click(); });
  $('deck-name').addEventListener('keydown', event => { if (event.key === 'Enter') $('create').click(); });
  $('home').addEventListener('click', event => {
    event.preventDefault();
    if (page === 'presentation') { dialog('end-dialog').showModal(); return; }
    if (isDirty() && !confirm('Leave without saving your draft?')) return;
    clearTimeout(saveTimer);
    deckId = '';
    lastRenamableSource = '';
    show('library');
    updateSaveButton();
    text('page-title', 'Local presentations');
    $('save-status').hidden = true;
  });
  $('edit-title').addEventListener('click', () => {
    const input = $<HTMLInputElement>('title-input');
    input.value = compiled?.title || '';
    $('edit-title').hidden = true;
    $('page-title').hidden = true;
    input.hidden = false;
    input.focus();
    input.select();
  });
  $<HTMLInputElement>('title-input').addEventListener('keydown', event => {
    if (event.key === 'Escape') { $('title-input').hidden = true; $('page-title').hidden = false; $('edit-title').hidden = false; }
    if (event.key === 'Enter') {
      try {
        editSource(setDeckTitle(sourceInput.value, $<HTMLInputElement>('title-input').value));
        $('title-input').hidden = true;
        $('page-title').hidden = false;
        $('edit-title').hidden = false;
      } catch (error) { errorNotice(error); }
    }
  });
  for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-view]')) {
    button.addEventListener('click', () => setView(button.dataset.view as View));
  }
  $<HTMLSelectElement>('theme').addEventListener('change', event => {
    try { editSource(setTheme(sourceInput.value, (event.target as HTMLSelectElement).value)); }
    catch (error) { errorNotice(error); }
  });
  sourceInput.addEventListener('input', () => {
    try {
      const change = propagateSlideIdChange(lastRenamableSource, sourceInput.value);
      if (change) {
        if (change.text !== sourceInput.value) {
          const start = sourceInput.selectionStart;
          const end = sourceInput.selectionEnd;
          const shifted = (position: number) => position + change.replacements
            .filter(replacement => replacement.end <= position).length * (change.newId.length - change.oldId.length);
          sourceInput.value = change.text;
          if (document.activeElement === sourceInput) sourceInput.setSelectionRange(shifted(start), shifted(end));
        }
        if (selected === change.oldId) selected = change.newId;
      }
    } catch (error) { errorNotice(error); }
    if (hasUniqueSlideIds(sourceInput.value)) lastRenamableSource = sourceInput.value;
    updateSaveButton();
    scheduleCompile();
    scheduleSave();
  });
  sourceInput.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      clearTimeout(saveTimer);
      void save();
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      const start = sourceInput.selectionStart;
      sourceInput.setRangeText('  ', start, sourceInput.selectionEnd, 'end');
      sourceInput.dispatchEvent(new Event('input'));
    }
  });
  $('save').addEventListener('click', () => { clearTimeout(saveTimer); void save(); });
  $('present').addEventListener('click', () => { void startPresentation(); });
  $('use-disk').addEventListener('click', () => {
    if (!diskConflict) return;
    revision = diskConflict.diskRevision;
    savedText = diskConflict.diskText;
    sourceInput.value = savedText;
    lastRenamableSource = savedText;
    updateSaveButton();
    conflicted = false;
    diskConflict = null;
    dialog('conflict-dialog').close();
    scheduleCompile();
  });
  $('keep-draft').addEventListener('click', () => {
    if (!diskConflict) return;
    revision = diskConflict.diskRevision;
    savedText = diskConflict.diskText;
    conflicted = false;
    diskConflict = null;
    dialog('conflict-dialog').close();
    void save();
  });
  $('reset-master').addEventListener('click', () => {
    if (!confirm('Remove presentation master overrides from the source?')) return;
    try {
      let source = sourceInput.value;
      for (const field of masterFields) if (field.name !== 'theme') source = setMaster(source, field.name);
      source = setMaster(source, 'background');
      source = setMaster(source, 'backdrop');
      source = setMaster(source, 'footerNumber');
      source = clearTheme(source);
      editSource(source);
      openSettings();
    } catch (error) { errorNotice(error); }
  });
  $('outline').addEventListener('dblclick', () => openSettings());
  $('next').addEventListener('click', () => { void sendEvent('next'); });
  $('previous').addEventListener('click', () => { void sendEvent('previous'); });
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-nav]')) {
    button.addEventListener('click', () => { void sendEvent(button.dataset.nav!); });
  }
  $<HTMLSelectElement>('jump').addEventListener('change', event => {
    void sendEvent('jump', { slideId: (event.target as HTMLSelectElement).value });
  });
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-tool]')) {
    button.addEventListener('click', () => toggleTool(button.dataset.tool as typeof tool));
  }
  $('undo').addEventListener('click', () => { void sendEvent('undo'); });
  $('clear').addEventListener('click', () => { void sendEvent('clear'); });
  for (const [id, mode] of [['blank', 'canvas'], ['blackout', 'blackout']]) {
    $(id).addEventListener('click', () => {
      void sendEvent('mode', { mode: overlayMode(session?.snapshot.overlay?.mode) === mode ? 'normal' : mode });
    });
  }
  $('shortcuts').addEventListener('click', () => dialog('shortcuts-dialog').showModal());
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-close]')) {
    button.addEventListener('click', () => dialog(button.dataset.close!).close());
  }
  const frame = $('stage-frame');
  frame.addEventListener('pointerdown', event => {
    if (page !== 'presentation' || event.button !== 0 || !tool || eventPending) return;
    if (tool === 'laser') return;
    event.preventDefault();
    drawing = { points: [point(event)], pointer: event.pointerId };
    frame.setPointerCapture(event.pointerId);
  });
  frame.addEventListener('pointermove', event => {
    if (page !== 'presentation') return;
    if (tool === 'laser') {
      const laser = $('laser');
      laser.hidden = false;
      const position = point(event);
      laser.style.left = `${position.x * 100}%`;
      laser.style.top = `${position.y * 100}%`;
    }
    if (drawing?.pointer === event.pointerId && drawing.points.length < 2000) drawing.points.push(point(event));
  });
  frame.addEventListener('pointerleave', () => { $('laser').hidden = true; });
  frame.addEventListener('pointerup', event => {
    if (!drawing || drawing.pointer !== event.pointerId) return;
    const points = drawing.points;
    drawing = null;
    if (points.length < 2 || !session) return;
    const stroke: Stroke = {
      slideId: session.snapshot.slideId, step: session.snapshot.step,
      points, tool: tool || 'pen', color: $<HTMLInputElement>('ink-color').value,
      width: Number($<HTMLInputElement>('ink-width').value),
    };
    void sendEvent('stroke', { stroke });
  });
  frame.addEventListener('pointercancel', () => { drawing = null; });
  $('local-audience').addEventListener('click', () => {
    if (!session) return;
    window.open(`/audience/?session=${encodeURIComponent(session.sessionId)}#${encodeURIComponent(session.localKey)}`, '_blank', 'noopener');
  });
  $('share').addEventListener('click', async () => {
    if (!session) return;
    if (!sharing) { dialog('share-dialog').showModal(); return; }
    try {
      await request(`/api/sessions/${encodeURIComponent(session.sessionId)}/share`, 'DELETE');
      sharing = false;
      shareUrl = '';
      drawPresenter();
      notify('LAN sharing stopped.');
    } catch (error) { errorNotice(error); }
  });
  $('start-share').addEventListener('click', async () => {
    if (!session) return;
    const host = $<HTMLInputElement>('share-host').value.trim();
    const portStart = Number($<HTMLInputElement>('port-start').value);
    const portEnd = Number($<HTMLInputElement>('port-end').value);
    if (!host || !Number.isInteger(portStart) || !Number.isInteger(portEnd) ||
      portStart < 1024 || portEnd > 65535 || portStart > portEnd) {
      notify('Enter a host and a valid port range (1024–65535).');
      return;
    }
    try {
      const result = await request<{ url: string; port: number; reachability: 'unverified' }>(
        `/api/sessions/${encodeURIComponent(session.sessionId)}/share`, 'POST', { host, portStart, portEnd });
      sharing = true;
      shareUrl = result.url;
      dialog('share-dialog').close();
      drawPresenter();
    } catch (error) { errorNotice(error); }
  });
  $('end').addEventListener('click', () => {
    if (!session) return;
    text('end-warning', 'Audience windows will stop receiving updates. Any ink will be discarded; saving annotations is not available yet.');
    dialog('end-dialog').showModal();
  });
  $('confirm-end').addEventListener('click', async () => {
    if (!session) return;
    let alreadyStopped = false;
    try {
      await request(`/api/sessions/${encodeURIComponent(session.sessionId)}`, 'DELETE', { discardMarks: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404 && error.message === 'Presentation not found') {
        alreadyStopped = true;
      } else { errorNotice(error); return; }
    }
    session = null;
    sharing = false;
    shareUrl = '';
    tool = null;
    dialog('end-dialog').close();
    show('editor');
    text('page-title', compiled?.title || 'Editor');
    updateEditor();
    if (alreadyStopped) notify('Presentation is no longer active. Returned to the editor.');
  });
  document.addEventListener('keydown', presenterKeys);
  window.addEventListener('beforeunload', event => {
    if (isDirty() || session) { event.preventDefault(); event.returnValue = ''; }
  });
  setInterval(() => {
    if (page !== 'presentation' || !session) return;
    const seconds = Math.floor((Date.now() - sessionStart) / 1000);
    text('timer', `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`);
  }, 1000);
}

async function init(): Promise<void> {
  wire();
  try {
    const response = await loadBootstrap();
    token = response.token;
    library = response.library;
    $('dev-mode').hidden = response.devMode !== true;
    renderLibrary();
    show('library');
  } catch (error) {
    show('library');
    $<HTMLButtonElement>('create').disabled = true;
    $<HTMLButtonElement>('open').disabled = true;
    status(`Unable to load library: ${message(error)}`, true);
  }
}

void init();
