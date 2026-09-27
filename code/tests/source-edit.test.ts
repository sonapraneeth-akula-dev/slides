import { describe, expect, test } from 'bun:test';
import { addSlide, clearTheme, editableLine, replacePlainLine, setLayout, setMaster, setTheme } from '../src/source-edit';

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
    const line = editableLine(source, 'intro', '## Welcome\n\nPlain paragraph');
    expect(line).not.toBeNull();
    const updated = replacePlainLine(source, line!, 'A *literal* paragraph');
    expect(updated).toContain('A \\*literal\\* paragraph');
    expect(updated).toContain('::slide{id="detail" parent="intro"}');
    expect(() => replacePlainLine(source, line!, 'Two\nlines')).toThrow('newline');
    expect(() => replacePlainLine(source.replace('Plain paragraph', 'Changed paragraph'), line!, 'Stale')).toThrow('stale');
  });

  test('disables preview writeback for complex or mismatched content', () => {
    expect(editableLine(source, 'intro', 'Different paragraph')).toBeNull();
    expect(editableLine(source.replace('Plain paragraph', '[link](https://example.com)'), 'intro', 'link')).toBeNull();
    expect(editableLine(source.replace('Plain paragraph', 'One\n\nTwo'), 'intro', 'One\n\nTwo')).toBeNull();
  });
});
