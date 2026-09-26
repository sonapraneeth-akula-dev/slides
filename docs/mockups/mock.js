// Shared mock data plus a tiny MDX-subset parser/renderer. Illustrative only, not the real compiler.

const FONTS = {
	'Segoe UI': "'Segoe UI', system-ui, sans-serif", Georgia: 'Georgia, serif', 'Trebuchet MS': "'Trebuchet MS', sans-serif",
	Verdana: 'Verdana, sans-serif', Palatino: "'Palatino Linotype', Palatino, serif",
	Consolas: 'Consolas, ui-monospace, monospace', 'Cascadia Code': "'Cascadia Code', Consolas, monospace", 'Courier New': "'Courier New', monospace",
};
// Theme presets supply master styling; the deck stores only `theme` plus sparse overrides (design section 3.5).
const THEMES = {
	signal: { name: 'Signal', surface: '#ffffff', text: '#1b1f24', accent: '#2563eb', muted: '#5b6470', headingFont: 'Segoe UI', bodyFont: 'Segoe UI' },
	paper: { name: 'Paper', surface: '#fbf7ef', text: '#2b2620', accent: '#b4532a', muted: '#7a6f60', headingFont: 'Georgia', bodyFont: 'Georgia' },
	midnight: { name: 'Midnight', surface: '#0f172a', text: '#e2e8f0', accent: '#38bdf8', muted: '#94a3b8', headingFont: 'Segoe UI', bodyFont: 'Segoe UI', background: 'gradient' },
	forest: { name: 'Forest', surface: '#f1f6f0', text: '#1d2b1f', accent: '#2f7d4a', muted: '#5d6f60', headingFont: 'Trebuchet MS', bodyFont: 'Trebuchet MS', background: 'band' },
};
const MASTER_BASE = { codeFont: 'Consolas', headingSize: 62, bodySize: 36, codeSize: 28, background: 'solid', backdrop: 'off', logo: '', footer: '', footerNumber: true };
const MASTER_FIELDS = {
	surface: 'color', text: 'color', accent: 'color', muted: 'color', headingFont: 'font', bodyFont: 'font', codeFont: 'font',
	headingSize: 'size', bodySize: 'size', codeSize: 'size', background: ['solid', 'gradient', 'band'], backdrop: ['off', 'drift'],
	logo: 'text', footer: 'text', footerNumber: 'bool',
};
const presetMaster = theme => { const { name, ...t } = THEMES[theme] || THEMES.signal; return { ...MASTER_BASE, ...t }; };
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

::slide{id="retry-flow" parent="retries"}

## Should we retry?

${FENCE}mermaid
flowchart LR
  call([Call service]) --> ok{Succeeded?}
  ok -->|yes| done([Return result])
  ok -->|no| transient{Transient?}
  transient -->|no| fail([Fail fast])
  transient -->|yes| budget{Attempts left?}
  budget -->|no| fail
  budget -->|yes| wait[Backoff + jitter]
  wait -.-> call
${FENCE}

:::notes
Walk left to right. The dashed arrow is the loop that backoff and jitter slow down.
:::

::slide{id="breakers" parent="patterns"}

## Circuit breakers

- **Closed**: calls flow normally
- **Open**: fail fast for a cool-down period
- **Half-open**: let one trial call through

::slide{id="breaker-demo" parent="breakers"}

## A breaker in action

${FENCE}mermaid
sequenceDiagram
  participant C as Client
  participant B as Breaker
  participant S as Service
  C->>B: request
  B->>S: forward
  S-->>B: timeout (third in a row)
  Note over B: Closed → Open
  C->>B: request
  B-->>C: fail fast, no call made
  Note over B: cool-down ends → Half-open
  B->>S: one trial call
  S-->>B: 200 OK
  Note over B: Half-open → Closed
${FENCE}

::slide{id="closing"}

## Thank you

![Team photo](team.jpg)

:::slot{name="text"}
- Questions?
- Exported HTML is in the shared folder
:::
`;

const Q3_SAMPLE = `---
slides:
  formatVersion: 1
  title: Q3 Architecture Review
  master: { theme: forest }
  layouts: { mix: two-columns }
---

::slide{id="t"}

# Q3 Architecture Review

Latency, traffic, and reliability in numbers

::slide{id="goals"}

## Goals

- Cut p95 latency by 30%
- Retire the legacy queue

::slide{id="plan" parent="goals"}

## Plan

- Migrate producers first
- Dual-write for two weeks

::slide{id="numbers"}

## The quarter in numbers

- One slide per chart type: bar, line, area, scatter, pie, donut
- Hover any bar, point, or slice for exact values

::slide{id="latency" parent="numbers"}

## p95 latency by service

${FENCE}chart
{
  "type": "bar", "unit": "ms", "y": "p95 latency (ms)",
  "labels": ["API", "Search", "Checkout", "Auth", "Media"],
  "series": [
    { "name": "Q2", "data": [420, 380, 510, 190, 460] },
    { "name": "Q3", "data": [290, 250, 330, 140, 350] }
  ]
}
${FENCE}

::slide{id="trend" parent="numbers"}

## Weekly p95 trend

${FENCE}chart
{
  "type": "line", "unit": "ms", "y": "p95 latency (ms)",
  "labels": ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9", "W10", "W11", "W12"],
  "series": [
    { "name": "p95", "data": [412, 405, 398, 371, 366, 342, 330, 318, 305, 297, 289, 284] },
    { "name": "Target", "data": [300, 300, 300, 300, 300, 300, 300, 300, 300, 300, 300, 300] }
  ]
}
${FENCE}

:::notes
We crossed the target in week 10 and stayed under it.
:::

::slide{id="traffic" parent="numbers"}

## Requests per hour

${FENCE}chart
{
  "type": "area", "unit": "k req", "y": "Requests (thousands)",
  "labels": ["00", "02", "04", "06", "08", "10", "12", "14", "16", "18", "20", "22"],
  "series": [
    { "name": "Weekday", "data": [42, 30, 24, 38, 96, 128, 134, 131, 122, 104, 80, 58] },
    { "name": "Weekend", "data": [48, 36, 26, 28, 44, 70, 88, 92, 90, 84, 72, 60] }
  ]
}
${FENCE}

::slide{id="payload" parent="numbers"}

## Payload size vs latency

${FENCE}chart
{
  "type": "scatter", "unit": "ms", "x": "Payload size (KB)", "y": "Latency (ms)",
  "series": [
    { "name": "Legacy queue", "data": [[8, 120], [16, 150], [24, 210], [40, 260], [56, 330], [72, 410], [96, 520], [120, 610]] },
    { "name": "New queue", "data": [[8, 70], [16, 80], [24, 95], [40, 120], [56, 140], [72, 170], [96, 205], [120, 240]] }
  ]
}
${FENCE}

::slide{id="mix" parent="numbers"}

## Where traffic and errors come from

:::slot{name="left"}
### Traffic by region
${FENCE}chart
{
  "type": "pie",
  "labels": ["North America", "Europe", "Asia Pacific", "Other"],
  "series": [{ "data": [46, 28, 19, 7] }]
}
${FENCE}
:::

:::slot{name="right"}
### Errors by cause
${FENCE}chart
{
  "type": "donut", "unit": "errors",
  "labels": ["Timeouts", "Upstream 5xx", "Throttled", "Other"],
  "series": [{ "data": [1240, 860, 410, 190] }]
}
${FENCE}
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
	{ id: 'q3', file: 'q3-architecture.mdx', dir: '~/Work/talks', updated: 'Sep 18', source: Q3_SAMPLE },
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
// Browser copies of edited decks hide sample changes; bump the version whenever sample decks change.
const MOCK_VERSION = '2026-09-26-charts';
const resetMock = () => Object.keys(localStorage).filter(k => k.startsWith('mock-')).forEach(k => localStorage.removeItem(k));
if (localStorage.getItem('mock-version') !== MOCK_VERSION) { resetMock(); localStorage.setItem('mock-version', MOCK_VERSION); }

const fit = new ResizeObserver(es => es.forEach(e => { e.target.firstElementChild.style.transform = `scale(${e.contentRect.width / 1600})`; }));
const scaled = (inner, extra = '') => `<div class="scaler" ${extra}><div class="stage">${inner}</div></div>`;
const observeScalers = (root = document) => $$('.scaler', root).forEach(s => fit.observe(s));

// ---------- parser ----------
const attrs = s => Object.fromEntries([...(s || '').matchAll(/(\w+)="([^"]*)"/g)].map(m => [m[1], m[2]]));

function parseDeck(src) {
	const errors = [], warnings = [], meta = { title: '', theme: 'signal', overrides: {}, layouts: {} };
	const fm = src.match(/^---\n([\s\S]*?)\n---\n/);
	if (fm) {
		const t = fm[1];
		meta.title = (t.match(/title:\s*(.+)/) || [])[1] || '';
		const mo = rawMaster(src), mLine = src.split('\n').findIndex(l => /^\s*master:/.test(l)) + 1;
		meta.theme = mo.theme || 'signal';
		for (const [k, v] of Object.entries(mo)) {
			if (k === 'theme') continue;
			const r = checkMaster(k, v);
			if (r.error) errors.push({ line: mLine, msg: r.error });
			else { if (r.warning) warnings.push({ line: mLine, msg: r.warning }); meta.overrides[k] = r.value; }
		}
		const l = t.match(/layouts:\s*\{([^}]*)\}/);
		if (l) l[1].split(',').forEach(p => { const [k, v] = p.split(':').map(x => x.trim()); if (k && v) meta.layouts[k] = v; });
	}
	if (!THEMES[meta.theme]) errors.push({ line: 1, msg: `Unknown theme "${meta.theme}"` });
	meta.master = { ...presetMaster(meta.theme), ...meta.overrides };
	meta.footer = meta.master.footer;
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
		toBlocks(s.items).filter(b => RICH[b.type]).forEach(b => { try { RICH[b.type](b.text); } catch (e) { errors.push({ line: b.line + 1, msg: e.message }); } });
	});
	meta.title ||= slides[0]?.title || 'Untitled';
	return { meta, slides, roots, errors, warnings };
}

// Raw `master: { ... }` flow map from front matter, as ordered strings.
function rawMaster(src) {
	const fm = src.match(/^---\n([\s\S]*?)\n---\n/), m = fm && fm[1].match(/master:[ \t]*\{(.*)\}/), out = {};
	if (m) for (const [, k, v] of m[1].matchAll(/(\w+):\s*("(?:[^"\\]|\\.)*"|[^,]*)/g)) {
		const t = v.trim();
		try { out[k] = t.startsWith('"') ? JSON.parse(t) : t; } catch { out[k] = t; }
	}
	return out;
}

function checkMaster(k, v) {
	const f = MASTER_FIELDS[k];
	if (!f) return { error: `Unknown master setting "${k}"` };
	if (f === 'color') return /^#[0-9a-f]{6}$/i.test(v) ? { value: v.toLowerCase() } : { error: `${k} must be a #rrggbb color` };
	if (f === 'size') { const n = Number(v); return v !== '' && Number.isFinite(n) && n >= 8 && n <= 200 ? { value: n } : { error: `${k} must be a number from 8 to 200` }; }
	if (f === 'bool') return v === 'true' || v === 'false' ? { value: v === 'true' } : { error: `${k} must be true or false` };
	if (f === 'font') return { value: v, warning: FONTS[v] ? null : `Font "${v}" is not installed; slides use a fallback font` };
	if (Array.isArray(f)) return f.includes(v) ? { value: v } : { error: `${k} must be one of: ${f.join(', ')}` };
	return { value: v };
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
			out.push({ ...base, type: { mermaid: 'diagram', chart: 'chart' }[t.slice(3).trim()] || 'code', text: code.join('\n') }); i++; continue;
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
		case 'diagram': case 'chart': { let svg; try { svg = RICH[b.type](b.text); } catch (e) { svg = `<div class="diagram-error">⚠ ${esc(e.message)}</div>`; } return `<figure${rv}><div class="${b.type}">${svg}</div></figure>`; }
		case 'img': return `<div class="figure"${rv}>🖼 ${esc(b.text)}</div>`;
		case 'ul': return `<ul${rv}>${b.items.map(li => `<li${ed(li.line)}>${inline(li.text)}</li>`).join('')}</ul>`;
	}
	return '';
}

// ---------- diagrams: offline stand-in for Mermaid (flowchart + sequenceDiagram subset) ----------
const DFONT = 28, textW = (t, f = DFONT) => t.length * f * 0.56;
const svgText = (x, y, t, cls = '') => `<text x="${x}" y="${y}"${cls ? ` class="${cls}"` : ''} text-anchor="middle" dominant-baseline="central">${esc(t)}</text>`;
const arrowHead = (x, y, dx, dy) => {
	const l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, s = 18, w = s * .55;
	return `<path class="dg-head" d="M ${x} ${y} L ${x - ux * s - uy * w} ${y - uy * s + ux * w} L ${x - ux * s + uy * w} ${y - uy * s - ux * w} Z"/>`;
};
const edgeLabel = (x, y, t) => t ? `<rect class="dg-lblbg" x="${x - textW(t, 22) / 2 - 8}" y="${y - 16}" width="${textW(t, 22) + 16}" height="32" rx="6"/>${svgText(x, y, t, 'dg-elabel')}` : '';

function diagramSVG(src) {
	const lines = src.split('\n').map(l => l.replace(/%%.*$/, '').trim()).filter(Boolean), head = lines.shift() || '';
	const m = head.match(/^(?:flowchart|graph)\s+(LR|TD|TB)$/);
	if (m) return flowchartSVG(lines, m[1] === 'LR');
	if (head === 'sequenceDiagram') return sequenceSVG(lines);
	throw new Error(`Unsupported diagram "${head.split(/\s/)[0] || '(empty)'}" (this mock draws flowchart and sequenceDiagram)`);
}

const SHAPES = [[/^\(\[(.*)\]\)$/, 'stadium'], [/^\(\((.*)\)\)$/, 'circle'], [/^\[(.*)\]$/, 'rect'], [/^\{(.*)\}$/, 'diamond'], [/^\((.*)\)$/, 'round']];
function flowchartSVG(lines, lr) {
	const nodes = new Map(), edges = [];
	const node = tok => {
		const m = (tok || '').match(/^([A-Za-z_]\w*)(.*)$/);
		if (!m) throw new Error(`Flowchart: expected a node id, found "${tok || ''}"`);
		let n = nodes.get(m[1]);
		if (!n) nodes.set(m[1], n = { id: m[1], label: m[1], shape: 'rect', out: [], inn: [] });
		if (m[2]) {
			const s = SHAPES.find(([re]) => re.test(m[2]));
			if (!s) throw new Error(`Flowchart: unknown node shape "${tok}"`);
			n.label = m[2].match(s[0])[1].replace(/^"(.*)"$/, '$1'); n.shape = s[1];
		}
		return n;
	};
	for (const line of lines) {
		const p = line.split(/\s*(-->|-\.->|==>)\s*(?:\|([^|]*)\|)?\s*/);
		let prev = node(p[0]);
		for (let k = 1; k < p.length; k += 3) {
			const to = node(p[k + 2]), e = { from: prev, to, label: p[k + 1] || '', dashed: p[k] === '-.->', thick: p[k] === '==>' };
			edges.push(e); prev.out.push(e); to.inn.push(e); prev = to;
		}
	}
	if (!nodes.size) throw new Error('Flowchart has no nodes');
	// Layered layout: DFS marks back edges, longest path ranks, one barycenter ordering pass.
	const all = [...nodes.values()], seen = new Map(), rank = new Map();
	const dfs = n => { seen.set(n, 1); n.out.forEach(e => seen.get(e.to) === 1 ? (e.back = true) : !seen.has(e.to) && dfs(e.to)); seen.set(n, 2); };
	all.forEach(n => seen.has(n) || dfs(n));
	const rk = n => { if (!rank.has(n)) rank.set(n, Math.max(0, ...n.inn.filter(e => !e.back).map(e => rk(e.from) + 1))); return rank.get(n); };
	const R = []; all.forEach(n => (R[rk(n)] ||= []).push(n));
	const bc = n => { const p = n.inn.filter(e => !e.back).map(e => e.from.slot); return p.length ? p.reduce((a, b) => a + b) / p.length : 0; };
	R.forEach((row, r) => { if (r) row.sort((a, b) => bc(a) - bc(b)); row.forEach((n, i) => { n.slot = i - (row.length - 1) / 2; }); });
	all.forEach(n => {
		const t = textW(n.label);
		[n.w, n.h] = n.shape === 'diamond' ? [t + 64, 104] : n.shape === 'circle' ? Array(2).fill(Math.max(t + 40, 96)) : [t + 48, 72];
	});
	const along = n => lr ? n.w : n.h, gap = lr ? 64 : 70;
	const size = R.map(row => Math.max(...row.map(along)));
	const pitch = lr ? Math.max(...all.map(n => n.h)) + 56 : Math.max(...all.map(n => n.w)) + 48;
	let pos = 0;
	R.forEach((row, r) => { row.forEach(n => { const a = pos + size[r] / 2, c = n.slot * pitch; [n.x, n.y] = lr ? [a, c] : [c, a]; }); pos += size[r] + gap; });

	let body = '';
	const minTop = Math.min(...all.map(n => n.y - n.h / 2)), maxRight = Math.max(...all.map(n => n.x + n.w / 2));
	for (const e of edges) {
		const a = e.from, b = e.to, cls = `dg-edge${e.dashed ? ' dg-dashed' : ''}${e.thick ? ' dg-thick' : ''}`;
		let d, lx, ly, dir;
		if (e.back && lr) {
			const sx = a.x, sy = a.y - a.h / 2, ex = b.x, ey = b.y - b.h / 2, yt = minTop - 90;
			d = `M ${sx} ${sy} C ${sx} ${yt}, ${ex} ${yt}, ${ex} ${ey}`; lx = (sx + ex) / 2; ly = (sy + ey + 6 * yt) / 8; dir = [0, 1];
		} else if (e.back) {
			const sx = a.x + a.w / 2, sy = a.y, ex = b.x + b.w / 2, ey = b.y, xr = maxRight + 110;
			d = `M ${sx} ${sy} C ${xr} ${sy}, ${xr} ${ey}, ${ex} ${ey}`; lx = (sx + ex + 6 * xr) / 8; ly = (sy + ey) / 2; dir = [-1, 0];
		} else {
			const [sx, sy, ex, ey] = lr ? [a.x + a.w / 2, a.y, b.x - b.w / 2, b.y] : [a.x, a.y + a.h / 2, b.x, b.y - b.h / 2];
			const [c1, c2] = lr ? [`${(sx + ex) / 2} ${sy}`, `${(sx + ex) / 2} ${ey}`] : [`${sx} ${(sy + ey) / 2}`, `${ex} ${(sy + ey) / 2}`];
			d = `M ${sx} ${sy} C ${c1}, ${c2}, ${ex} ${ey}`; lx = (sx + ex) / 2; ly = (sy + ey) / 2; dir = lr ? [1, 0] : [0, 1];
		}
		const end = d.split(' ').slice(-2).map(Number);
		body += `<path class="${cls}" d="${d}"/>${arrowHead(end[0], end[1], ...dir)}`;
		e.lbl = [lx, ly];
	}
	for (const n of all) {
		const x0 = n.x - n.w / 2, y0 = n.y - n.h / 2;
		body += n.shape === 'diamond' ? `<polygon class="dg-node dg-decision" points="${n.x},${y0} ${x0 + n.w},${n.y} ${n.x},${y0 + n.h} ${x0},${n.y}"/>`
			: n.shape === 'circle' ? `<circle class="dg-node" cx="${n.x}" cy="${n.y}" r="${n.w / 2}"/>`
			: `<rect class="dg-node" x="${x0}" y="${y0}" width="${n.w}" height="${n.h}" rx="${{ rect: 10, round: 24, stadium: n.h / 2 }[n.shape]}"/>`;
		body += svgText(n.x, n.y, n.label);
	}
	edges.forEach(e => { body += edgeLabel(...e.lbl, e.label); });
	const hasBack = edges.some(e => e.back), pad = 24;
	const x1 = Math.min(...all.map(n => n.x - n.w / 2)) - pad, x2 = maxRight + pad + (hasBack && !lr ? 100 : 0);
	const y1 = minTop - pad - (hasBack && lr ? 70 : 0), y2 = Math.max(...all.map(n => n.y + n.h / 2)) + pad;
	return `<svg class="dg" viewBox="${x1} ${y1} ${x2 - x1} ${y2 - y1}" role="img" aria-label="Flowchart: ${esc(all.map(n => n.label).join(', '))}">${body}</svg>`;
}

function sequenceSVG(lines) {
	const parts = [], byId = new Map(), rows = [];
	const P = id => { let p = byId.get(id); if (!p) { byId.set(id, p = { id, label: id }); parts.push(p); } return p; };
	for (const l of lines) {
		let m;
		if ((m = l.match(/^(?:participant|actor)\s+(\S+)(?:\s+as\s+(.+))?$/))) P(m[1]).label = m[2] || m[1];
		else if ((m = l.match(/^Note\s+over\s+([^:]+):\s*(.*)$/i))) rows.push({ note: m[1].split(',').map(s => P(s.trim())), text: m[2] });
		else if ((m = l.match(/^([\w]+)\s*(-->>|->>)\s*([\w]+)\s*:\s*(.*)$/))) rows.push({ from: P(m[1]), to: P(m[3]), dashed: m[2] === '-->>', text: m[4] });
		else throw new Error(`Sequence diagram: cannot read "${l}"`);
	}
	if (!parts.length) throw new Error('Sequence diagram has no participants');
	const col = Math.max(1400 / parts.length, ...parts.map(p => textW(p.label) + 80), ...rows.filter(r => r.from && r.from !== r.to).map(r => textW(r.text, 24) + 60));
	const W = col * parts.length, headH = 68, top = headH + 44, step = 56, H = top + rows.length * step + 10;
	parts.forEach((p, i) => { p.x = col * (i + .5); });
	let body = parts.map(p => `<line class="dg-life" x1="${p.x}" y1="${headH}" x2="${p.x}" y2="${H}"/>`).join('');
	body += parts.map(p => { const w = Math.min(col - 30, textW(p.label) + 60); return `<rect class="dg-node" x="${p.x - w / 2}" y="0" width="${w}" height="${headH}" rx="10"/>${svgText(p.x, headH / 2, p.label)}`; }).join('');
	rows.forEach((r, i) => {
		const y = top + i * step;
		if (r.note) {
			const xs = r.note.map(p => p.x), w = Math.max(textW(r.text, 24) + 40, Math.max(...xs) - Math.min(...xs) + 120), cx = (Math.max(...xs) + Math.min(...xs)) / 2;
			body += `<rect class="dg-note" x="${cx - w / 2}" y="${y - 22}" width="${w}" height="44" rx="8"/>${svgText(cx, y, r.text, 'dg-ntext')}`;
		} else if (r.from === r.to) {
			const x = r.from.x;
			body += `<path class="dg-edge${r.dashed ? ' dg-dashed' : ''}" d="M ${x} ${y - 14} C ${x + 90} ${y - 14}, ${x + 90} ${y + 16}, ${x + 4} ${y + 16}"/>${arrowHead(x, y + 16, -1, 0)}` +
				`<text x="${x + 100}" y="${y}" class="dg-mtext" dominant-baseline="central">${esc(r.text)}</text>`;
		} else {
			const [a, b] = [r.from.x, r.to.x], dir = Math.sign(b - a);
			body += `<line class="dg-edge${r.dashed ? ' dg-dashed' : ''}" x1="${a}" y1="${y + 10}" x2="${b - dir * 2}" y2="${y + 10}"/>${arrowHead(b, y + 10, dir, 0)}${svgText((a + b) / 2, y - 12, r.text, 'dg-mtext')}`;
		}
	});
	return `<svg class="dg" viewBox="-10 -4 ${W + 20} ${H + 8}" role="img" aria-label="Sequence diagram between ${esc(parts.map(p => p.label).join(', '))}">${body}</svg>`;
}

// ---------- charts: offline stand-in for the chart adapter (data-only JSON, six required types) ----------
const CHART_TYPES = ['bar', 'line', 'area', 'scatter', 'pie', 'donut'];
const niceStep = x => { const m = 10 ** Math.floor(Math.log10(x)), f = x / m; return m * (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10); };
const fmtN = v => Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
const cfill = k => `style="fill:var(--c${k % 6})"`;
const ticks = (lo, hi) => { const st = niceStep((hi - lo) / 5 || 1), a = Math.floor(lo / st) * st, b = Math.ceil(hi / st) * st || st; return { a, b, list: Array.from({ length: Math.round((b - a) / st) + 1 }, (_, i) => a + i * st) }; };

function chartSVG(src) {
	let c;
	try { c = JSON.parse(src); } catch (e) { throw new Error(`Chart: invalid JSON (${e.message})`); }
	const { type, series } = c || {}, labels = c?.labels || [], xy = type === 'scatter', round = type === 'pie' || type === 'donut';
	if (!CHART_TYPES.includes(type)) throw new Error(`Chart: "type" must be one of ${CHART_TYPES.join(', ')}`);
	if (!Array.isArray(series) || !series.length) throw new Error('Chart: needs a non-empty "series" array');
	let pts = 0;
	series.forEach((s, k) => {
		const name = s?.name || k + 1, d = s?.data;
		if (!Array.isArray(d)) throw new Error(`Chart: series "${name}" needs a "data" array`);
		if (xy ? !d.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)) : d.length !== labels.length || !d.every(Number.isFinite))
			throw new Error(xy ? `Chart: scatter series "${name}" needs [x, y] number pairs` : `Chart: series "${name}" needs ${labels.length} numbers, one per label`);
		if (round && d.some(v => v < 0)) throw new Error(`Chart: ${type} values cannot be negative`);
		pts += d.length;
	});
	if (round && !(series[0].data.reduce((a, b) => a + b, 0) > 0)) throw new Error(`Chart: ${type} values must add up to more than zero`);
	if (pts > 1000) throw new Error(`Chart: ${fmtN(pts)} data points exceeds the 1,000 point limit`);
	const unit = c.unit ? ' ' + c.unit : '', aria = `${type} chart${c.title ? ': ' + c.title : ''}`;
	return round ? pieSVG(c, labels, series[0].data, unit, aria) : axisSVG(c, labels, series, unit, aria);
}

function axisSVG(c, labels, series, unit, aria) {
	const xy = c.type === 'scatter', W = 1400, H = 560, L = 110, R = 30, T = 76, B = c.x ? 96 : 64, pw = W - L - R, ph = H - T - B;
	const yv = series.flatMap(s => s.data.map(d => xy ? d[1] : d)), ya = ticks(Math.min(0, ...yv), Math.max(0, ...yv));
	const Y = v => T + ph - (v - ya.a) / (ya.b - ya.a) * ph;
	let X, body = '', tip = (s, lab, v) => `<title>${esc(s.name || '')}${s.name ? ' · ' : ''}${esc(lab)}: ${fmtN(v)}${esc(unit)}</title>`;
	body += ya.list.map(v => `<line class="ch-grid" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ch-tick" x="${L - 14}" y="${Y(v)}" text-anchor="end" dominant-baseline="central">${fmtN(v)}</text>`).join('');
	if (xy) {
		const xv = series.flatMap(s => s.data.map(d => d[0])), xa = ticks(Math.min(...xv), Math.max(...xv));
		X = v => L + (v - xa.a) / (xa.b - xa.a) * pw;
		body += xa.list.map(v => `<text class="ch-tick" x="${X(v)}" y="${H - B + 32}" text-anchor="middle">${fmtN(v)}</text>`).join('');
	} else {
		const band = pw / labels.length;
		X = i => L + (i + .5) * band;
		body += labels.map((l, i) => `<text class="ch-tick" x="${X(i)}" y="${H - B + 32}" text-anchor="middle">${esc(l)}</text>`).join('');
		if (c.type === 'bar') {
			const gw = band * .72, bw = gw / series.length;
			series.forEach((s, k) => s.data.forEach((v, i) => {
				const x = L + i * band + (band - gw) / 2 + k * bw, y = Y(Math.max(v, 0));
				body += `<g class="ch-mark">${tip(s, labels[i], v)}<rect ${cfill(k)} x="${x + 3}" y="${y}" width="${bw - 6}" height="${Math.abs(Y(v) - Y(0))}" rx="5"/></g>`;
			}));
		}
	}
	body += `<line class="ch-axis" x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}"/>`;
	let areas = '';
	if (c.type !== 'bar') series.forEach((s, k) => {
		const p = s.data.map((d, i) => xy ? [X(d[0]), Y(d[1]), `(${fmtN(d[0])}, ${fmtN(d[1])})`] : [X(i), Y(d), labels[i], d]);
		if (!xy) {
			const line = p.map(q => `${q[0]},${q[1]}`).join(' ');
			if (c.type === 'area') areas += `<polygon ${cfill(k)} class="ch-area" points="${p[0][0]},${Y(0)} ${line} ${p.at(-1)[0]},${Y(0)}"/>`;
			body += `<polyline class="ch-line" style="stroke:var(--c${k % 6})" points="${line}"/>`;
		}
		body += p.map(q => `<g class="ch-mark">${xy ? `<title>${esc(s.name || '')} ${q[2]}</title>` : tip(s, q[2], q[3])}<circle ${cfill(k)} class="${xy ? 'ch-dot' : 'ch-pt'}" cx="${q[0]}" cy="${q[1]}" r="${xy ? 10 : 8}"/></g>`).join('');
	});
	let lx = W - R;
	const leg = series.map((s, k) => ({ k, name: s.name || `Series ${k + 1}` })).reverse().map(({ k, name }) => { lx -= textW(name, 22) + 50; return `<rect ${cfill(k)} x="${lx}" y="14" width="22" height="22" rx="5"/><text class="ch-legend" x="${lx + 32}" y="25" dominant-baseline="central">${esc(name)}</text>`; }).join('');
	if (c.y) body += `<text class="ch-tick ch-title" x="${L}" y="25" dominant-baseline="central">${esc(c.y)}</text>`;
	if (c.x) body += `<text class="ch-tick ch-title" x="${L + pw / 2}" y="${H - 16}" text-anchor="middle">${esc(c.x)}</text>`;
	return `<svg class="ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}">${areas}${body}${leg}</svg>`;
}

function pieSVG(c, labels, data, unit, aria) {
	const W = 840, H = 520, cx = 260, cy = 260, r = 236, ri = c.type === 'donut' ? 138 : 0, sum = data.reduce((a, b) => a + b, 0);
	const pt = (a, rad) => `${cx + rad * Math.cos(a)} ${cy + rad * Math.sin(a)}`;
	let a = -Math.PI / 2, body = '';
	data.forEach((v, i) => {
		const sweep = Math.min(v / sum * 2 * Math.PI, 2 * Math.PI - 1e-4), b = a + sweep, lg = sweep > Math.PI ? 1 : 0, mid = a + sweep / 2, pct = v / sum * 100;
		const d = ri ? `M ${pt(a, r)} A ${r} ${r} 0 ${lg} 1 ${pt(b, r)} L ${pt(b, ri)} A ${ri} ${ri} 0 ${lg} 0 ${pt(a, ri)} Z` : `M ${cx} ${cy} L ${pt(a, r)} A ${r} ${r} 0 ${lg} 1 ${pt(b, r)} Z`;
		const [tx, ty] = pt(mid, ri ? (r + ri) / 2 : r * .62).split(' ');
		body += `<g class="ch-mark"><title>${esc(labels[i])}: ${fmtN(v)}${esc(unit)} (${fmtN(pct.toFixed(1))}%)</title><path class="ch-slice" ${cfill(i)} d="${d}"/>` +
			(pct >= 6 ? `<text class="ch-pct" x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="central">${Math.round(pct)}%</text>` : '') + '</g>';
		a = b;
	});
	if (ri) body += svgText(cx, cy - 16, fmtN(sum), 'ch-total') + svgText(cx, cy + 30, c.unit || 'total', 'ch-tick');
	const y0 = cy - (data.length - 1) * 23;
	body += labels.map((l, i) => `<rect ${cfill(i)} x="560" y="${y0 + i * 46 - 11}" width="22" height="22" rx="5"/><text class="ch-legend" x="594" y="${y0 + i * 46}" dominant-baseline="central">${esc(l)}</text>`).join('');
	return `<svg class="ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}">${body}</svg>`;
}

const RICH = { diagram: diagramSVG, chart: chartSVG };

const SLOTS = { 'title-content': ['content'], 'two-columns': ['left', 'right'], 'three-columns': ['left', 'center', 'right'], 'picture-text': ['picture', 'text'] };

const fontCSS = f => FONTS[f] || `'${String(f).replace(/[^\w -]/g, '')}', system-ui, sans-serif`;
// Accepts parsed deck meta (resolved master) or a bare theme id.
function themeStyle(m) {
	const r = typeof m === 'string' ? presetMaster(m) : m.master || presetMaster(m.theme);
	return `--s-bg:${r.surface};--s-fg:${r.text};--s-accent:${r.accent};--s-muted:${r.muted};--s-head:${fontCSS(r.headingFont)};--s-body:${fontCSS(r.bodyFont)};--s-code:${fontCSS(r.codeFont)};` +
		`--s-hsize:${r.headingSize}px;--s-bsize:${r.bodySize}px;--s-csize:${r.codeSize}px`;
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
	const r = meta.master || presetMaster(meta.theme);
	const bg = ` bg-${r.background}${r.backdrop === 'drift' && r.background === 'gradient' ? ' backdrop-drift' : ''}`;
	return `<div class="slide layout-${s.layout}${isTitle ? ' is-title' : ''}${bg}" data-id="${esc(s.id)}" style="${themeStyle(meta)}">` +
		`${r.logo ? `<div class="logo">${esc(r.logo)}</div>` : ''}${title ? blockHTML(title, o) : ''}<div class="body">${body}</div>` +
		`<div class="footer"><span>${esc(r.footer || meta.title)}</span><span>${r.footerNumber ? s.num : ''}</span></div></div>`;
}

const notesHTML = s => s.notes.length ? toBlocks(s.notes).map(b => blockHTML(b)).join('') : '<p class="muted">No notes for this slide.</p>';

const inkSVG = (marks = [], step = Infinity) => `<svg class="ink" viewBox="0 0 1600 900">${marks.filter(m => m.step <= step).map(m =>
	`<path d="${m.d}" fill="none" stroke="${m.color}" stroke-width="${m.width}" stroke-opacity="${m.opacity}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;

// Source edits used by the draft UI (master and per-slide templates live in front matter).
const ensureFM = src => src.startsWith('---\n') ? src : `---\nslides:\n  formatVersion: 1\n---\n\n${src}`;
function writeMaster(src, mo) {
	const val = v => typeof v !== 'string' || /^-?\d+(\.\d+)?$|^(true|false)$|^[a-z][\w-]*$/i.test(v) ? String(v) : JSON.stringify(v);
	const line = `  master: { ${Object.entries(mo).map(([k, v]) => `${k}: ${val(v)}`).join(', ')} }`, re = /\n[ \t]*master:[ \t]*\{.*\}/;
	return re.test(src) ? src.replace(re, '\n' + line) : ensureFM(src).replace(/\n---\n/, `\n${line}\n---\n`);
}
// Sparse overrides: a value equal to the preset (or undefined) removes the override. Switching theme keeps overrides.
function setMaster(src, key, value) {
	const { theme = 'signal', ...rest } = rawMaster(src), mo = { theme, ...rest }, preset = presetMaster(mo.theme);
	if (key === 'theme') mo.theme = value;
	else if (value === undefined || String(value).toLowerCase() === String(preset[key]).toLowerCase()) delete mo[key];
	else mo[key] = value;
	return writeMaster(src, mo);
}
const resetMaster = src => writeMaster(src, { theme: rawMaster(src).theme || 'signal' });
const setTheme = (src, theme) => setMaster(src, 'theme', theme);
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
// Forward along-axis at the last sibling leaves the branch: the nearest ancestor's next sibling.
// The perpendicular backward direction enters the end of the previous sibling's branch (its last descendant).
function arrowTargets(s) {
	const k = s.siblings.indexOf(s), back = s.siblings[k - 1] || s.parentRef, child = s.children[0];
	let a = s, end = s.siblings[k - 1]?.children.length ? s.siblings[k - 1] : null;
	while (a && !a.siblings[a.siblings.indexOf(a) + 1]) a = a.parentRef;
	while (end?.children.length) end = end.children.at(-1);
	const fwd = a && a.siblings[a.siblings.indexOf(a) + 1];
	return s.depth % 2 === 0 ? { ArrowUp: back, ArrowDown: fwd, ArrowRight: child, ArrowLeft: end } : { ArrowLeft: back, ArrowRight: fwd, ArrowDown: child, ArrowUp: end };
}
