import { layouts } from './source-edit';
import type { Slide } from './render';

type Layout = typeof layouts[number];
interface SampleDefinition {
  title: string;
  layout: Layout;
  body: string;
  slots?: Record<string, string>;
}

const image = '![Image placeholder](assets/example.png)';
const samples: SampleDefinition[] = [
  { title: 'Blank', layout: 'blank', body: '' },
  { title: 'Title and subtitle', layout: 'title-content', body: '# Presentation title\n\nA short subtitle or presenter name' },
  { title: 'Title, subtitle and image', layout: 'title-content', body: `# Presentation title\n\nA short subtitle\n\n${image}` },
  { title: 'Heading only', layout: 'title-content', body: '# Section heading' },
  { title: 'Heading and content', layout: 'title-content', body: '# Heading and content\n\n- First point\n- Second point\n- Third point' },
  { title: 'Heading and two text columns', layout: 'two-columns', body: '# Two columns', slots: { left: '## First idea\n\nShort explanation.', right: '## Second idea\n\nShort explanation.' } },
  { title: 'Heading and three columns', layout: 'three-columns', body: '# Three columns', slots: { left: '**Plan**\n\nDiscover', center: '**Build**\n\nCreate', right: '**Share**\n\nPresent' } },
  { title: 'Heading and two images', layout: 'two-columns', body: '# Two images', slots: { left: '![Left image placeholder](assets/left.png)', right: '![Right image placeholder](assets/right.png)' } },
  { title: 'Heading, image and text', layout: 'picture-text', body: '# Image and text', slots: { image, text: '## Description\n\nExplain the visual beside it.' } },
  { title: 'Heading, text and image', layout: 'two-columns', body: '# Text and image', slots: { left: '## Description\n\nExplain the visual beside it.', right: image } },
  { title: 'Image only', layout: 'title-content', body: image },
  { title: 'Picture with caption', layout: 'picture-text', body: '# Picture with caption', slots: { image, text: '*Caption and attribution*' } },
  { title: 'Heading and table', layout: 'title-content', body: '# Comparison table\n\n| Option | Strength |\n| --- | --- |\n| A | Speed |\n| B | Reach |' },
  { title: 'Heading and code', layout: 'title-content', body: '# Code sample\n\n```typescript\nconst answer = 42;\n```' },
  { title: 'Heading and chart', layout: 'title-content', body: '# Chart\n\n```chart\n{"type":"bar","labels":["Before","After"],"series":[{"name":"Count","data":[2,5]}]}\n```' },
  { title: 'Heading and diagram', layout: 'title-content', body: '# Diagram\n\n```mermaid\nflowchart LR\n  A --> B\n```' },
  { title: 'Heading and equation', layout: 'title-content', body: '# Equation\n\n$$x^2 + y^2 = z^2$$' }
];

export const masterSamples: Array<{ title: string; slide: Slide & { layout: Layout } }> = samples.map(({ title, layout, body, slots }, index) => ({
  title,
  slide: { id: `master-sample-${index + 1}`, index, layout, body, slots: slots ?? {}, reveals: [] }
}));
