import { layouts } from './source-edit';
import type { Slide } from './render';
import { sampleImageReference } from './sample-image-reference';

type Layout = typeof layouts[number];
interface SampleDefinition {
  section: string;
  title: string;
  layout: Layout;
  body: string;
  slots?: Record<string, string>;
}

const image = `![Illustrated mountain landscape](${sampleImageReference})`;
const samples: SampleDefinition[] = [
  { section: 'Blank slides', title: 'Blank', layout: 'blank', body: '' },
  { section: 'Title slides', title: 'Title and subtitle', layout: 'title-content', body: '# Presentation title\n\nA short subtitle or presenter name' },
  { section: 'Title slides', title: 'Title, subtitle and image', layout: 'title-content', body: `# Presentation title\n\nA short subtitle\n\n${image}` },
  { section: 'Title slides', title: 'Heading only', layout: 'title-content', body: '# Section heading' },
  { section: 'Content slides', title: 'Heading and content', layout: 'title-content', body: '# Heading and content\n\n- First point\n- Second point\n- Third point' },
  { section: 'Content slides', title: 'Heading and two text columns', layout: 'two-columns', body: '# Two columns', slots: { left: '## First idea\n\nShort explanation.', right: '## Second idea\n\nShort explanation.' } },
  { section: 'Content slides', title: 'Heading and three columns', layout: 'three-columns', body: '# Three columns', slots: { left: '**Plan**\n\nDiscover', center: '**Build**\n\nCreate', right: '**Share**\n\nPresent' } },
  { section: 'Image slides', title: 'Heading and two images', layout: 'two-columns', body: '# Two images', slots: { left: `![Left landscape](${sampleImageReference})`, right: `![Right landscape](${sampleImageReference})` } },
  { section: 'Image slides', title: 'Heading, image and text', layout: 'picture-text', body: '# Image and text', slots: { image, text: '## Description\n\nExplain the visual beside it.' } },
  { section: 'Image slides', title: 'Heading, text and image', layout: 'two-columns', body: '# Text and image', slots: { left: '## Description\n\nExplain the visual beside it.', right: image } },
  { section: 'Image slides', title: 'Image only', layout: 'image-full', body: image },
  { section: 'Image slides', title: 'Picture with caption', layout: 'picture-text', body: '# Picture with caption', slots: { image, text: '*Caption and attribution*' } },
  { section: 'Tables and code', title: 'Heading and table', layout: 'title-content', body: '# Comparison table\n\n| Option | Strength |\n| --- | --- |\n| A | Speed |\n| B | Reach |' },
  { section: 'Tables and code', title: 'Heading and code', layout: 'title-content', body: '# Code sample\n\n```typescript\nconst answer = 42;\n```' },
  { section: 'Charts', title: 'Heading and chart', layout: 'title-content', body: '# Chart\n\n```chart\n{"type":"bar","labels":["Before","After"],"series":[{"name":"Count","data":[2,5]}]}\n```' },
  { section: 'Charts', title: 'Line chart with two series', layout: 'title-content', body: '# Trends\n\n```chart\n{"type":"line","labels":["Jan","Feb","Mar"],"series":[{"name":"Plan","data":[2,4,6]},{"name":"Actual","data":[3,5,7]}]}\n```' },
  { section: 'Charts', title: 'Donut chart', layout: 'title-content', body: '# Breakdown\n\n```chart\n{"type":"donut","labels":["Design","Build","Review"],"series":[{"name":"Share","data":[25,50,25]}]}\n```' },
  { section: 'Diagrams', title: 'Heading and diagram', layout: 'title-content', body: '# Diagram\n\n```mermaid\nflowchart TD\n  Idea --> Draft\n  Draft --> Review\n  Review --> Present\n```' },
  { section: 'Math', title: 'Heading and equation', layout: 'title-content', body: '# Equation\n\n$$x^2 + y^2 = z^2$$' },
  { section: 'Image covers', title: 'Title with image on the left', layout: 'title-image-left', body: '# A bold opening\n\nImage on the left, title on the right.', slots: { image } },
  { section: 'Image covers', title: 'Title with image on the right', layout: 'title-image-right', body: '# A bold opening\n\nTitle on the left, image on the right.', slots: { image } }
];

export const masterSamples: Array<{ section: string; title: string; slide: Slide & { layout: Layout } }> = samples.map(({ section, title, layout, body, slots }, index) => ({
  section, title,
  slide: { id: `master-sample-${index + 1}`, index, layout, body, slots: slots ?? {}, reveals: [] }
}));
