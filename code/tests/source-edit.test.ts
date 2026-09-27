import { describe, expect, test } from 'bun:test';
import { addSlide, clearTheme, editableLines, replacePlainLine, setDeckTitle, setLayout, setMaster, setTheme } from '../src/source-edit';

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

  test('edits only the matching slide layout and rejects unknown IDs', () => {
    const updated = setLayout(source, 'detail', 'two-columns');
    expect(updated).toContain('::slide{id="detail" parent="intro" layout="two-columns"}');
    expect(updated).toContain('::slide{id="intro"}');
    expect(() => setLayout(source, 'absent', 'blank')).toThrow('not found');
  });

  test('adds a validated child slide after the existing source', () => {
    const updated = addSlide(source, 'intro');
    expect(updated).toMatch(/::slide\{id="slide-[\da-f]{8}" parent="intro"\}/);
    expect(updated).toContain('## New slide');
    expect(() => addSlide(source, 'intro"}\nunsafe')).toThrow('Invalid parent');
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
