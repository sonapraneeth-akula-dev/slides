// Shared mock data plus a tiny MDX-subset parser/renderer. Illustrative only, not the real compiler.

const THEMES = {
	signal: { name: 'Signal', bg: '#ffffff', fg: '#1b1f24', accent: '#2563eb', muted: '#5b6470', head: "'Segoe UI', system-ui, sans-serif", body: "'Segoe UI', system-ui, sans-serif" },
	paper: { name: 'Paper', bg: '#fbf7ef', fg: '#2b2620', accent: '#b4532a', muted: '#7a6f60', head: 'Georgia, serif', body: 'Georgia, serif' },
	midnight: { name: 'Midnight', bg: '#0f172a', fg: '#e2e8f0', accent: '#38bdf8', muted: '#94a3b8', head: "'Segoe UI', system-ui, sans-serif", body: "'Segoe UI', system-ui, sans-serif" },
	forest: { name: 'Forest', bg: '#f1f6f0', fg: '#1d2b1f', accent: '#2f7d4a', muted: '#5d6f60', head: "'Trebuchet MS', sans-serif", body: "'Trebuchet MS', sans-serif" },
};
const LAYOUTS = { 'title-content': 'Title + content', 'two-columns': 'Two columns', 'three-columns': 'Three columns', 'picture-text': 'Picture + text' };

const FENCE = '```';
const SAMPLE = `---
slides:
  formatVersion: 1
  title: Building Reliable Systems
  master: { theme: signal, footer: "Reliability 101" }
  layouts: { why: two-columns, stories: two-columns, patterns: three-columns, closing: picture-text }
---

::slide{id="title"}

# Building Reliable Systems

A practical tour of failure, recovery, and trust

:::notes
Welcome everyone. 20 minutes, questions at the end.
Ask: who was paged this month?
:::

::slide{id="why"}

## Why reliability matters

:::slot{name="left"}
- Users notice every outage
- Incidents cost trust, not just money
- Reliability is a feature you ship
:::

:::slot{name="right"}
> Everything fails, all the time.
:::

:::notes
Keep this short; the stories slide carries the emotion.
:::

::slide{id="cost" parent="why"}

## The cost of downtime

- 99.9% uptime is still about 8.7 hours down per year

:::reveal{step="1"}
- 99.99% brings that to about 52 minutes
:::

:::reveal{step="2"}
- Each extra nine costs roughly **10x** more effort
:::

:::notes
Pause after each reveal. Ask what their current SLO is.
:::

::slide{id="stories" parent="why"}

## Two outage stories

:::slot{name="left"}
### The silent retry storm
Clients retried instantly and took the database down.
:::

:::slot{name="right"}
### The expired certificate
One forgotten certificate, three hours of downtime.
:::

::slide{id="patterns"}

## Resilience patterns

:::slot{name="left"}
### Retries
Recover from transient faults.
:::

:::slot{name="center"}
### Timeouts
Bound every remote call.
:::

:::slot{name="right"}
### Breakers
Stop hammering a failing service.
:::

::slide{id="retries" parent="patterns"}

## Retries done right

${FENCE}ts
async function withRetry(fn, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch { await sleep(backoff(i)); }
  }
  throw new Error("gave up");
}
${FENCE}

:::notes
Point at the sleep call: that is where backoff and jitter live.
:::

::slide{id="backoff" parent="retries"}

## Exponential backoff

- Wait 100 ms, 200 ms, 400 ms, ...
- Cap the delay so users are not left hanging

::slide{id="jitter" parent="retries"}

## Add jitter

- Randomize each delay to spread retries out
- Prevents synchronized retry storms

::slide{id="breakers" parent="patterns"}

## Circuit breakers

- **Closed**: calls flow normally
- **Open**: fail fast for a cool-down period
- **Half-open**: let one trial call through

::slide{id="closing"}

## Thank you

![Team photo](team.jpg)

:::slot{name="text"}
- Questions?
- Exported HTML is in the shared folder
:::
`;

const mini = (title, theme, slides) => `---\nslides:\n  title: ${title}\n  master: { theme: ${theme} }\n---\n\n` +
	slides.map(([id, parent, md]) => `::slide{id="${id}"${parent ? ` parent="${parent}"` : ''}}\n\n${md}\n`).join('\n');

const DECKS = [
	{ id: 'reliable', file: 'reliable-systems.mdx', dir: '~/Slides/Decks', updated: 'Today, 08:41', source: SAMPLE },
	{ id: 'rust', file: 'rust-ownership.mdx', dir: '~/Slides/Decks', updated: 'Yesterday', source: mini('Intro to Rust Ownership', 'midnight', [
		['t', null, '# Intro to Rust Ownership\n\nMemory safety without a garbage collector'],
		['rules', null, '## The three rules\n\n- Each value has one owner\n- One owner at a time\n- Value dropped when owner leaves scope'],
		['borrow', 'rules', '## Borrowing\n\n- `&T` shared, many readers\n- `&mut T` exclusive, one writer'],
		['end', null, '## Try it\n\n- play.rust-lang.org']]) },
	{ id: 'onboarding', file: 'team-onboarding.md', dir: '~/Slides/Decks', updated: 'Sep 20', source: mini('Team Onboarding', 'paper', [
		['t', null, '# Welcome to the team\n\nYour first two weeks'],
		['week1', null, '## Week one\n\n- Laptop and accounts\n- Meet your buddy\n- First small fix'],
		['week2', null, '## Week two\n\n- Shadow an on-call shift\n- Ship a feature flag']]) },
	{ id: 'q3', file: 'q3-architecture.mdx', dir: '~/Work/talks', updated: 'Sep 18', source: mini('Q3 Architecture Review', 'forest', [
		['t', null, '# Q3 Architecture Review'],
		['goals', null, '## Goals\n\n- Cut p95 latency by 30%\n- Retire the legacy queue'],
		['plan', 'goals', '## Plan\n\n- Migrate producers first\n- Dual-write for two weeks']]) },
	{ id: 'old', file: 'old-conference-talk.mdx', dir: '~/Desktop', updated: 'Mar 2', missing: true, title: 'Old Conference Talk' },
];

// Demo annotations for export previews opened without a live presenter window.
const DEMO_MARKS = {
	title: [{ d: 'M 90 590 C 300 520 1000 520 1180 600 S 400 700 110 640', color: '#e11d48', width: 7, opacity: 1, step: 0 }],
	cost: [{ d: 'M 150 452 L 900 452', color: '#facc15', width: 40, opacity: .45, step: 1 }],
	retries: [{ d: 'M 1480 470 L 1180 490 M 1180 490 L 1225 455 M 1180 490 L 1222 525', color: '#e11d48', width: 7, opacity: 1, step: 0 }],
	'canvas:patterns': [{ d: 'M 300 300 L 700 300 L 700 600 L 300 600 Z M 700 450 L 1100 450 M 1100 350 L 1400 350 L 1400 550 L 1100 550 Z', color: '#2563eb', width: 6, opacity: 1, step: 0 }],
};
const DEMO_COMMENTS = [{ slide: 'cost', text: 'Mention our Q2 incident here', visibility: 'private' }];

// ---------- helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const param = k => new URLSearchParams(location.search).get(k);
const getDeck = id => DECKS.find(d => d.id === id) || DECKS[0];
const loadSource = id => localStorage.getItem('mock-src-' + id) ?? getDeck(id).source;
const saveSource = (id, src) => localStorage.setItem('mock-src-' + id, src);
const loadValid = id => localStorage.getItem('mock-valid-' + id) ?? getDeck(id).source;

const fit = new ResizeObserver(es => es.forEach(e => { e.target.firstElementChild.style.transform = `scale(${e.contentRect.width / 1600})`; }));
const scaled = (inner, extra = '') => `<div class="scaler" ${extra}><div class="stage">${inner}</div></div>`;
const observeScalers = (root = document) => $$('.scaler', root).forEach(s => fit.observe(s));

// ---------- parser ----------
const attrs = s => Object.fromEntries([...(s || '').matchAll(/(\w+)="([^"]*)"/g)].map(m => [m[1], m[2]]));

function parseDeck(src) {
	const errors = [], meta = { title: '', theme: 'signal', footer: '', layouts: {} };
	const fm = src.match(/^---\n([\s\S]*?)\n---\n/);
	if (fm) {
		const t = fm[1];
		meta.title = (t.match(/title:\s*(.+)/) || [])[1] || '';
		meta.theme = (t.match(/theme:\s*([\w-]+)/) || [])[1] || 'signal';
		meta.footer = (t.match(/footer:\s*"([^"]*)"/) || [])[1] || '';
		const l = t.match(/layouts:\s*\{([^}]*)\}/);
		if (l) l[1].split(',').forEach(p => { const [k, v] = p.split(':').map(x => x.trim()); if (k && v) meta.layouts[k] = v; });
	}
	if (!THEMES[meta.theme]) errors.push({ line: 1, msg: `Unknown theme "${meta.theme}"` });
	const lines = src.split('\n'), first = fm ? fm[0].split('\n').length - 1 : 0;
	const raw = [];
	let cur = null, block = null, inCode = false;
	const newSlide = (a, line) => { cur = { id: a.id || 'slide-' + (raw.length + 1), parent: a.parent || null, line, items: [], notes: [], reveals: 0, children: [] }; raw.push(cur); };
	if (!/^::slide\{/m.test(src)) newSlide({}, first);
	for (let i = first; i < lines.length; i++) {
		const line = lines[i];
		if (!inCode) {
			const m = line.match(/^::slide\{([^}]*)\}\s*$/);
			if (m) { if (block) errors.push({ line: i + 1, msg: `Unclosed :::${block.kind} before new slide` }); block = null; newSlide(attrs(m[1]), i); continue; }
			if (cur) {
				const o = line.match(/^:::(notes|reveal|slot)(?:\{([^}]*)\})?\s*$/);
				if (o) {
					if (block) { errors.push({ line: i + 1, msg: 'Nested containers are not supported here' }); continue; }
					const a = attrs(o[2]);
					block = { kind: o[1], step: +a.step || 0, slot: a.name || null };
					if (o[1] === 'reveal') { if (!(block.step > 0)) errors.push({ line: i + 1, msg: 'reveal needs step="1" or higher' }); cur.reveals = Math.max(cur.reveals, block.step); }
					continue;
				}
				if (line.trim() === ':::' && block) { block = null; continue; }
			}
		}
		if (line.startsWith(FENCE)) inCode = !inCode;
		if (!cur) continue;
		const item = { text: line, line: i, step: block?.kind === 'reveal' ? block.step : 0, slot: block?.kind === 'slot' ? block.slot : null };
		(block?.kind === 'notes' ? cur.notes : cur.items).push(item);
	}
	if (block) errors.push({ line: lines.length, msg: `Unclosed :::${block.kind}` });
	if (inCode) errors.push({ line: lines.length, msg: 'Unclosed code fence' });

	const byId = new Map(), roots = [];
	raw.forEach(s => byId.has(s.id) ? errors.push({ line: s.line + 1, msg: `Duplicate slide id "${s.id}"` }) : byId.set(s.id, s));
	raw.forEach(s => {
		const p = s.parent && byId.get(s.parent);
		if (s.parent && !p) errors.push({ line: s.line + 1, msg: `Unknown parent "${s.parent}"` });
		if (p) { s.parentRef = p; p.children.push(s); } else roots.push(s);
	});
	const slides = [];
	const walk = (list, depth, prefix) => list.forEach((s, k) => {
		s.depth = depth; s.num = prefix ? `${prefix}.${k + 1}` : String(k + 1); s.siblings = list;
		slides.push(s); walk(s.children, depth + 1, s.num);
	});
	walk(roots, 0, '');
	if (slides.length < raw.length) errors.push({ line: 1, msg: 'Parent cycle detected' });
	slides.forEach((s, i) => {
		s.index = i;
		s.layout = LAYOUTS[meta.layouts[s.id]] ? meta.layouts[s.id] : 'title-content';
		const h = s.items.find(x => /^#{1,6}\s/.test(x.text));
		s.title = h ? h.text.replace(/^#+\s*/, '') : 'Slide ' + s.num;
	});
	meta.title ||= slides[0]?.title || 'Untitled';
	return { meta, slides, roots, errors };
}

// ---------- renderer ----------
const inline = t => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');

function toBlocks(items) {
	const out = [];
	for (let i = 0; i < items.length;) {
		const it = items[i], t = it.text, base = { line: it.line, step: it.step, slot: it.slot };
		let m;
		if (!t.trim()) { i++; continue; }
		if (t.startsWith(FENCE)) {
			const code = [];
			for (i++; i < items.length && !items[i].text.startsWith(FENCE); i++) code.push(items[i].text);
			out.push({ ...base, type: 'code', text: code.join('\n') }); i++; continue;
		}
		if ((m = t.match(/^(#{1,6})\s+(.*)/))) { out.push({ ...base, type: 'h', level: m[1].length, text: m[2] }); i++; continue; }
		if ((m = t.match(/^!\[([^\]]*)\]\(([^)]*)\)/))) { out.push({ ...base, type: 'img', text: m[1] }); i++; continue; }
		if (/^[-*]\s+/.test(t)) {
			const lis = [];
			for (; i < items.length && /^[-*]\s+/.test(items[i].text) && items[i].step === it.step && items[i].slot === it.slot; i++) lis.push({ line: items[i].line, text: items[i].text.replace(/^[-*]\s+/, '') });
			out.push({ ...base, type: 'ul', items: lis }); continue;
		}
		if (t.startsWith('>')) { out.push({ ...base, type: 'quote', text: t.replace(/^>\s?/, '') }); i++; continue; }
		out.push({ ...base, type: 'p', text: t }); i++;
	}
	return out;
}

function blockHTML(b, o = {}) {
	const ed = line => o.editable ? ` data-line="${line}" contenteditable="plaintext-only" spellcheck="false"` : '';
	const rv = !b.step ? '' : b.step > (o.step ?? Infinity) ? ' class="rv-hidden"' : o.markReveals ? ` class="rv-mark" data-step="${b.step}"` : '';
	switch (b.type) {
		case 'h': return `<h${b.level}${rv}${ed(b.line)}>${inline(b.text)}</h${b.level}>`;
		case 'p': return `<p${rv}${ed(b.line)}>${inline(b.text)}</p>`;
		case 'quote': return `<blockquote${rv}${ed(b.line)}>${inline(b.text)}</blockquote>`;
		case 'code': return `<pre${rv}><code>${esc(b.text)}</code></pre>`;
		case 'img': return `<div class="figure"${rv}>🖼 ${esc(b.text)}</div>`;
		case 'ul': return `<ul${rv}>${b.items.map(li => `<li${ed(li.line)}>${inline(li.text)}</li>`).join('')}</ul>`;
	}
	return '';
}

const SLOTS = { 'title-content': ['content'], 'two-columns': ['left', 'right'], 'three-columns': ['left', 'center', 'right'], 'picture-text': ['picture', 'text'] };

function themeStyle(theme) {
	const t = THEMES[theme] || THEMES.signal;
	return `--s-bg:${t.bg};--s-fg:${t.fg};--s-accent:${t.accent};--s-muted:${t.muted};--s-head:${t.head};--s-body:${t.body}`;
}

// o: { step (default fully revealed), editable, markReveals }
function slideHTML(s, meta, o = {}) {
	const blocks = toBlocks(s.items);
	const ti = blocks.findIndex(b => b.type === 'h' && !b.slot && !b.step);
	const title = ti >= 0 ? blocks.splice(ti, 1)[0] : null;
	const cols = SLOTS[s.layout], groups = Object.fromEntries(cols.map(c => [c, []])), loose = [];
	for (const b of blocks) {
		if (b.slot && groups[b.slot]) groups[b.slot].push(b);
		else if (s.layout === 'picture-text' && b.type === 'img' && !groups.picture.length) groups.picture.push(b);
		else loose.push(b);
	}
	const empty = cols.filter(c => !groups[c].length);
	if (loose.length) {
		if (!empty.length) groups[cols.at(-1)].push(...loose);
		else { const n = Math.ceil(loose.length / empty.length); empty.forEach((c, k) => groups[c].push(...loose.slice(k * n, (k + 1) * n))); }
	}
	const isTitle = title?.level === 1 && s.layout === 'title-content';
	const body = cols.map(c => `<div class="col">${groups[c].map(b => blockHTML(b, o)).join('')}</div>`).join('');
	return `<div class="slide layout-${s.layout}${isTitle ? ' is-title' : ''}" data-id="${esc(s.id)}" style="${themeStyle(meta.theme)}">` +
		`${title ? blockHTML(title, o) : ''}<div class="body">${body}</div>` +
		`<div class="footer"><span>${esc(meta.footer || meta.title)}</span><span>${s.num}</span></div></div>`;
}

const notesHTML = s => s.notes.length ? toBlocks(s.notes).map(b => blockHTML(b)).join('') : '<p class="muted">No notes for this slide.</p>';

const inkSVG = (marks = [], step = Infinity) => `<svg class="ink" viewBox="0 0 1600 900">${marks.filter(m => m.step <= step).map(m =>
	`<path d="${m.d}" fill="none" stroke="${m.color}" stroke-width="${m.width}" stroke-opacity="${m.opacity}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;

// Source edits used by the draft UI (theme and per-slide template live in front matter).
const ensureFM = src => src.startsWith('---\n') ? src : `---\nslides:\n  formatVersion: 1\n---\n\n${src}`;
function setTheme(src, theme) {
	return /theme:\s*[\w-]+/.test(src) ? src.replace(/theme:\s*[\w-]+/, 'theme: ' + theme) : ensureFM(src).replace(/\n---\n/, `\n  master: { theme: ${theme} }\n---\n`);
}
function setLayout(src, id, layout) {
	const map = { ...parseDeck(src).meta.layouts };
	if (layout === 'title-content') delete map[id]; else map[id] = layout;
	const entries = Object.entries(map), line = entries.length ? `  layouts: { ${entries.map(([k, v]) => `${k}: ${v}`).join(', ')} }` : '';
	if (/\n[ \t]*layouts:\s*\{[^}]*\}/.test(src)) return src.replace(/\n[ \t]*layouts:\s*\{[^}]*\}/, line ? '\n' + line : '');
	return line ? ensureFM(src).replace(/\n---\n/, `\n${line}\n---\n`) : src;
}

// Canonical navigation (design section 3.3).
function nextPos(deck, p) { const s = deck.slides[p.i]; return p.step < s.reveals ? { i: p.i, step: p.step + 1 } : p.i < deck.slides.length - 1 ? { i: p.i + 1, step: 0 } : p; }
function prevPos(deck, p) { return p.step > 0 ? { i: p.i, step: p.step - 1 } : p.i > 0 ? { i: p.i - 1, step: deck.slides[p.i - 1].reveals } : p; }
function arrowTargets(s) {
	const k = s.siblings.indexOf(s), back = s.siblings[k - 1] || s.parentRef, fwd = s.siblings[k + 1], child = s.children[0];
	return s.depth % 2 === 0 ? { ArrowUp: back, ArrowDown: fwd, ArrowRight: child, ArrowLeft: null } : { ArrowLeft: back, ArrowRight: fwd, ArrowDown: child, ArrowUp: null };
}
