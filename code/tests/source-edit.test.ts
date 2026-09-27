import { describe, expect, test } from 'bun:test';
import { compileDeck } from '../src/deck';
import { addSlide, clearTheme, editableLines, hasUniqueSlideIds, insertSlide, propagateSlideIdChange, replacePlainLine, setDeckTitle, setLayout, setMaster, setTheme } from '../src/source-edit';

const source = `---
slides:
  formatVersion: 1
  master:
    theme: "signal"
    accent: "#123456"
---

::slide{id="intro"}

## Welcome

Plain paragraph

::slide{id="detail" parent="intro"}

## Detail
`;

describe('source-backed editing', () => {
  test('updates theme without replacing unrelated master fields', () => {
    const updated = setTheme(source, 'forest');
    expect(updated).toContain('    theme: "forest"');
    expect(updated).toContain('    accent: "#123456"');
    expect(clearTheme(updated)).not.toContain('    theme:');
    expect(() => setTheme(source, 'unknown')).toThrow('Unknown theme');
  });

  test('creates settings front matter and retains CRLF', () => {
    const updated = setMaster('::slide{id="intro"}\r\n\r\nHello\r\n', 'footer', 'Last call');
    expect(updated).toContain('---\r\nslides:\r\n  master: { footer: "Last call" }\r\n  formatVersion: 1\r\n---');
    expect(updated).toContain('Hello\r\n');
    expect(updated).not.toMatch(/(?<!\r)\n/);
    expect(() => setMaster('---\nname: Test\n---\n', 'footer', 'Test')).toThrow('slides:');
  });

  test('edits the presentation title without changing the rest of the deck', () => {
    const updated = setDeckTitle(source, 'Release notes');
    expect(updated).toContain('  title: "Release notes"');
    expect(updated).toContain('    accent: "#123456"');
    expect(setDeckTitle(updated, 'Next "quarter"')).toContain('  title: "Next \\"quarter\\""');
    expect(setDeckTitle('::slide{id="intro"}\r\n# Intro\r\n', 'New')).toContain('  title: "New"\r\n');
    expect(() => setDeckTitle(source, ' ')).toThrow('title');
  });

  test('edits inline settings without splitting quoted comma values', () => {
    const inline = '---\nslides:\n  master: { footer: "First, second", theme: "signal" }\n---\n';
    const updated = setTheme(inline, 'paper');
    expect(updated).toContain('footer: "First, second"');
    expect(updated).toContain('theme: "paper"');
  });

  test('persists heading and spacing independently and keeps a valid empty master on reset', () => {
    const heading = setMaster(source, 'headingPlacement', 'right');
    const spaced = setMaster(setMaster(heading, 'marginTop', 8), 'paddingLeft', 2.5);
    expect(spaced).toContain('    headingPlacement: "right"');
    expect(spaced).toContain('    marginTop: 8');
    expect(spaced).toContain('    paddingLeft: 2.5');
    expect(spaced).toContain('    accent: "#123456"');
    expect(setMaster(spaced, 'marginTop')).not.toContain('    marginTop:');
    expect(() => setMaster(source, 'marginDiagonal', 4)).toThrow('Unknown master field');
    const reset = clearTheme('---\nslides:\n  master:\n    theme: "signal"\n---\n::slide{id="intro"}\n# Intro');
    expect(reset).toContain('  master: {}');
    expect(reset).not.toContain('    theme:');
  });

  test('writes metadata in its own subsection and migrates edited legacy placements', () => {
    const legacy = source.replace('    accent: "#123456"', '    accent: "#123456"\n    metadataBottomRight: slideNumber');
    const updated = setMaster(legacy, 'metadataBottomRight', 'none');
    expect(updated).toContain('    metadata:\n      metadataBottomRight: "none"');
    expect(updated).not.toMatch(/^    metadataBottomRight:/m);
    expect(updated).toContain('    accent: "#123456"');
    const next = setMaster(updated, 'metadataBottomCenter', 'slideNumber');
    expect(next).toContain('      metadataBottomCenter: "slideNumber"');
    expect(compileDeck(next).diagnostics).toEqual([]);
    expect(compileDeck(next).deck?.master.metadataBottomCenter).toBe('slideNumber');
    expect(setMaster(next, 'metadataBottomRight')).not.toContain('metadataBottomRight:');
    expect(setMaster(setMaster(next, 'metadataBottomRight'), 'metadataBottomCenter')).not.toContain('    metadata:');
    const cleared = setMaster('---\nslides:\n  master:\n    metadata:\n      metadataBottomRight: none\n---\n',
      'metadataBottomRight');
    expect(cleared).toContain('  master: {}');
    expect(compileDeck(`${cleared}::slide{id="first"}\n# First\n`).diagnostics).toEqual([]);
  });

  test('preserves inline mappings and CRLF while editing and clearing placements', () => {
    const inline = '---\r\nslides:\r\n  master: { footer: "First, second", metadataBottomRight: slideNumber, theme: paper }\r\n---\r\n';
    const migrated = setMaster(inline, 'metadataBottomRight', 'none');
    expect(migrated).toContain('master: { footer: "First, second", theme: paper, metadata: { metadataBottomRight: "none" } }');
    const added = setMaster(migrated, 'metadataTopCenter', 'deckTitle');
    expect(added).toContain('metadata: { metadataBottomRight: "none", metadataTopCenter: "deckTitle" }');
    expect(compileDeck(`${added}::slide{id="first"}\r\n# First\r\n`).diagnostics).toEqual([]);
    expect(setMaster(setMaster(added, 'metadataBottomRight'), 'metadataTopCenter')).toContain('master: { footer: "First, second", theme: paper }');
    const block = '---\r\nslides:\r\n  master:\r\n    footer: "Hello"\r\n    metadata: { metadataBottomRight: none }\r\n---\r\n';
    expect(setMaster(block, 'metadataBottomCenter', 'slideNumber'))
      .toContain('metadata: { metadataBottomRight: none, metadataBottomCenter: "slideNumber" }');
    expect(added).not.toMatch(/(?<!\r)\n/);
    expect(setMaster('::slide{id="first"}\r\n', 'metadataBottomRight', 'none'))
      .toContain('    metadata:\r\n      metadataBottomRight: "none"\r\n');
    expect(() => setMaster(source.replace('    accent: "#123456"', '    metadata: none'), 'metadataBottomRight', 'none'))
      .toThrow('expected a mapping');
  });

  test('edits only the matching slide layout and rejects unknown IDs', () => {
    const updated = setLayout(source, 'detail', 'two-columns');
    expect(updated).toContain('::slide{id="detail" parent="intro" layout="two-columns"}');
    expect(updated).toContain('::slide{id="intro"}');
    expect(() => setLayout(source, 'absent', 'blank')).toThrow('not found');
  });

  test('inserts a child after its selected slide subtree, before unrelated slides', () => {
    const updated = addSlide(source, 'intro');
    expect(updated).toMatch(/::slide\{id="slide-[\da-f]{8}" parent="intro"\}/);
    expect(updated).toContain('## New slide');
    const tail = '::slide{id="next"}\n# Next\n';
    const nested = source.replace('## Detail', '## Detail\n\n::slide{id="grandchild" parent="detail"}\n# Grandchild') + '\n' + tail;
    const afterRoot = addSlide(nested, 'intro');
    const child = afterRoot.match(/::slide\{id="(slide-[\da-f]{8})" parent="intro"\}/)?.[1];
    expect(child).toBeDefined();
    expect(afterRoot.indexOf('::slide{id="grandchild"')).toBeLessThan(afterRoot.indexOf(`::slide{id="${child}"`));
    expect(afterRoot.indexOf(`::slide{id="${child}"`)).toBeLessThan(afterRoot.indexOf('::slide{id="next"'));
    const afterDetail = addSlide(nested, 'detail');
    expect(afterDetail).toMatch(/::slide\{id="grandchild" parent="detail"\}[\s\S]*::slide\{id="slide-[\da-f]{8}" parent="detail"\}[\s\S]*::slide\{id="next"\}/);
    const afterNext = addSlide(nested, 'next');
    expect(afterNext).toMatch(/::slide\{id="next"\}[\s\S]*::slide\{id="slide-[\da-f]{8}" parent="next"\}/);
    expect(addSlide(nested)).toMatch(/::slide\{id="next"\}[\s\S]*::slide\{id="slide-[\da-f]{8}"\}/);
    expect(() => addSlide(source, 'absent')).toThrow('was not found');
    expect(() => addSlide(source.replace('id="detail"', 'id=""'), 'intro')).toThrow('Fix slide directives');
    expect(() => addSlide(source, 'intro"}\nunsafe')).toThrow('Invalid parent');
  });

  test('inserts around fenced directives without modifying existing CRLF content', () => {
    const original = '::slide{id="first"}\r\n```text\r\n::slide{id="fake"}\r\n```\r\n\r\n::slide{id="second"}\r\nSecond\r\n';
    const updated = addSlide(original, 'first');
    expect(updated).toMatch(/::slide\{id="fake"\}\r\n```\r\n\r\n::slide\{id="slide-[\da-f]{8}" parent="first"\}\r\n\r\n## New slide\r\n\r\n::slide\{id="second"\}/);
    expect(updated).not.toMatch(/(?<!\r)\n/);
    expect(updated.slice(0, updated.indexOf('::slide{id="second"}')).replace(/::slide\{id="slide-[\da-f]{8}" parent="first"\}\r\n\r\n## New slide\r\n\r\n/, '')).toBe(original.slice(0, original.indexOf('::slide{id="second"}')));
  });

  test('repairs displaced children before placing a new child beside its subtree', () => {
    const displaced = `::slide{id="Welcome"}
# Welcome

::slide{id="first" parent="Welcome"}
# First

::slide{id="grandchild" parent="first"}
# Grandchild

::slide{id="sibling" parent="Welcome"}
# Sibling

::slide{id="late" parent="first"}
# Late child

::slide{id="last"}
# Last
`;
    const added = insertSlide(displaced, 'first');
    const ids = [...added.text.matchAll(/^::slide\{id="([^"]+)"/gm)].map(match => match[1]);
    expect(ids).toEqual(['Welcome', 'first', 'grandchild', 'late', added.id, 'sibling', 'last']);
    expect(added.text.slice(added.start)).toStartWith(`::slide{id="${added.id}" parent="first"}`);
    expect(added.text).toContain('::slide{id="late" parent="first"}\n# Late child');
    expect(added.text).toContain('::slide{id="sibling" parent="Welcome"}\n# Sibling');
    const root = insertSlide(displaced, undefined, 'first');
    expect([...root.text.matchAll(/^::slide\{id="([^"]+)"/gm)].map(match => match[1]))
      .toEqual(['Welcome', 'first', 'grandchild', 'late', 'sibling', root.id, 'last']);
    expect(root.text.slice(root.start)).toStartWith(`::slide{id="${root.id}"}`);
    const appended = addSlide(displaced);
    expect(appended.indexOf('::slide{id="last"}')).toBeLessThan(appended.lastIndexOf('::slide{id="slide-'));
  });

  test('renames slide references but leaves prose and fenced code unchanged', () => {
    const original = `---
slides:
  layouts:
    "intro": blank
---
::slide{id="intro"}
# Intro

intro and parent="intro" are prose

\`\`\`text
::slide{id="example" parent="intro"}
\`\`\`

::slide{id="detail" parent="intro"}
## Detail

::slide{id="last" layout="blank" parent="intro"}
`;
    const edited = original.replace('::slide{id="intro"}', '::slide{id="opening"}');
    const change = propagateSlideIdChange(original, edited);
    expect(change?.oldId).toBe('intro');
    expect(change?.newId).toBe('opening');
    expect(change?.text).toContain('"opening": blank');
    expect(change?.text).toContain('::slide{id="detail" parent="opening"}');
    expect(change?.text).toContain('::slide{id="last" layout="blank" parent="opening"}');
    expect(change?.text).toContain('intro and parent="intro" are prose');
    expect(change?.text).toContain('::slide{id="example" parent="intro"}');
    expect(propagateSlideIdChange(original, original)).toBeNull();
    expect(propagateSlideIdChange(original, original.replace('id="intro"', 'id="detail"'))).toBeNull();
    expect(hasUniqueSlideIds(original.replace('id="intro"', 'id=""'))).toBe(false);
    expect(propagateSlideIdChange(original, original.replace('id="intro"', 'id=""'))).toBeNull();
    expect(propagateSlideIdChange(original, original.replace('id="intro"', 'id="opening"').replace('id="last"', 'id="later"'))).toBeNull();
  });

  test('renames inline layout keys and retains CRLF while rejecting key collisions', () => {
    const original = '---\r\nslides: { layouts: { intro: blank, other: two-columns } }\r\n---\r\n::slide{layout="blank" id="intro"}\r\n::slide{parent="intro" id="detail"}\r\n';
    const change = propagateSlideIdChange(original, original.replace('id="intro"', 'id="start"'));
    expect(change?.text).toContain('{ start: blank, other: two-columns }');
    expect(change?.text).toContain('::slide{parent="start" id="detail"}\r\n');
    expect(change?.text).not.toMatch(/(?<!\r)\n/);
    expect(() => propagateSlideIdChange(original, original.replace('id="intro"', 'id="other"'))).toThrow('slides.layouts already has a key');
  });

  test('writes back only matching plain text without allowing Markdown syntax injection', () => {
    const [line] = editableLines(source, 'intro', '## Welcome\n\nPlain paragraph');
    expect(line).toBeDefined();
    const updated = replacePlainLine(source, line, 'A *literal* paragraph');
    expect(updated).toContain('A \\*literal\\* paragraph');
    expect(updated).toContain('::slide{id="detail" parent="intro"}');
    expect(replacePlainLine(source, line, ':::notes $x$')).toContain('\\:\\:\\:notes \\$x\\$');
    expect(() => replacePlainLine(source, line, 'Two\nlines')).toThrow('newline');
    expect(() => replacePlainLine(source.replace('Plain paragraph', 'Changed paragraph'), line, 'Stale')).toThrow('stale');
  });

  test('locates individual plain paragraphs and excludes rich content and containers', () => {
    const multi = source.replace('Plain paragraph', 'Plain paragraph\n\nAnother paragraph');
    const lines = editableLines(multi, 'intro', '## Welcome\n\nPlain paragraph\n\nAnother paragraph');
    expect(lines.map(line => line.display)).toEqual(['Plain paragraph', 'Another paragraph']);
    expect(replacePlainLine(multi, lines[1], 'Changed')).toContain('Plain paragraph\n\nChanged');
    const notes = source.replace('Plain paragraph', 'Plain paragraph\n\n:::notes\nPrivate\n:::\n\nAnother paragraph');
    expect(editableLines(notes, 'intro', '## Welcome\n\nPlain paragraph\n\n\nAnother paragraph')
      .map(line => line.display)).toEqual(['Plain paragraph', 'Another paragraph']);
    expect(editableLines(source, 'intro', 'Different paragraph')).toEqual([]);
    expect(editableLines(source.replace('Plain paragraph', '[link](https://example.com)'), 'intro', '## Welcome\n\n[link](https://example.com)')).toEqual([]);
    expect(editableLines(source, 'absent', '## Welcome\n\nPlain paragraph')).toEqual([]);
  });
});
