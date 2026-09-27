import { expect, test } from 'bun:test';
import { masterSamples } from '../src/master-samples';
import { layouts } from '../src/source-edit';
import { sampleImageReference } from '../src/sample-image-reference';

test('master gallery covers supported layouts and composition families without modifying a deck', () => {
  expect(masterSamples).toHaveLength(21);
  expect(new Set(masterSamples.map(sample => sample.slide.layout))).toEqual(new Set(layouts));
  expect(masterSamples.map(sample => sample.slide.id)).toEqual(
    masterSamples.map((_, index) => `master-sample-${index + 1}`)
  );
  expect(masterSamples.map(sample => sample.slide.index)).toEqual(
    masterSamples.map((_, index) => index)
  );
  expect(masterSamples[0].slide.body).toBe('');
  for (const { slide } of masterSamples) {
    expect(layouts).toContain(slide.layout);
    if (slide.layout === 'two-columns' || slide.layout === 'picture-text') expect(Object.keys(slide.slots)).toHaveLength(2);
    if (slide.layout === 'three-columns') expect(Object.keys(slide.slots)).toHaveLength(3);
    if (slide.layout.startsWith('title-image-')) expect(Object.keys(slide.slots)).toEqual(['image']);
  }
  expect(masterSamples.filter(sample => /!\[[^\]]+\]\(assets\/[^)]+\)/.test(
    `${sample.slide.body}\n${Object.values(sample.slide.slots).join('\n')}`
  ))).toHaveLength(8);
  expect(masterSamples.map(sample => sample.title)).toContain('Image only');
  expect(masterSamples.map(sample => sample.title)).toContain('Heading and chart');
  expect(masterSamples.filter(sample => sample.section === 'Charts')).toHaveLength(3);
  expect(masterSamples.find(sample => sample.title === 'Image only')?.slide.layout).toBe('image-full');
  expect(masterSamples.find(sample => sample.title === 'Heading and diagram')?.slide.body).toContain('Review --> Present');
  expect(masterSamples.every(sample => !!sample.section)).toBe(true);
  for (const sample of masterSamples) {
    for (const match of `${sample.slide.body}\n${Object.values(sample.slide.slots).join('\n')}`.matchAll(/!\[[^\]]+\]\(([^)]+)\)/g)) {
      expect(match[1]).toBe(sampleImageReference);
    }
  }
});
