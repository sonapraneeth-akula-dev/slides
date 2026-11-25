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
  { section: 'Image covers', title: 'Title with image on the right', layout: 'title-image-right', body: '# A bold opening\n\nTitle on the left, image on the right.', slots: { image } },
  { section: 'Architecture', title: 'Four-plane architecture flow', layout: 'title-content', body: `# Service-Level Machine Capacity — End-to-End 4-Plane Flow\n\n[Runner PR #104](https://example.com/runner) · [Scheduler PR #105](https://example.com/scheduler) · [Live Capacity UI](https://example.com/capacity)\n\n<Flow>\n<Lane title="1 · Workflow Plane">\n<Step id="s1" title="U1 · Batch Submit">\nWeekly cron · skips baseline\n</Step>\n<Step id="s2" title="U2 · TriggerTask (3.3s)" tone="accent">\nFresh \`.bin\` + bindings\n\n<Status tone="ok">Exits immediately (async)</Status>\n</Step>\n<Step id="s3" title="U9 · Webhook Unlock">\n<Status tone="ok">Green Pass · 0 stuck locks</Status>\n</Step>\n</Lane>\n<Lane title="2 · Orchestration">\n<Step id="s4" title="U4 · POST CapacityTests">\nStores JSON scenario\n</Step>\n<Step id="s5" title="U6 · Step Ramp">\n<Status tone="accent">StopOnBreach saves locks</Status>\n</Step>\n<Step id="s6" title="U8 · Counter Isolation" tone="accent">\nValidates locked host metrics\n</Step>\n</Lane>\n<Lane title="3 · Replay & Telemetry">\n<Step id="s7" title="U7 · Replay Agents" tone="accent">\n<Status tone="ok">Retail speed · exact count</Status>\n</Step>\n<Step id="s8" title="Health Counters">\n\`AppStore\` → \`app-node-01\`\n</Step>\n</Lane>\n<Lane title="4 · Locked Hosts">\n<Step id="s9" title="Client Host (Lock)" tone="accent">\n<Status tone="accent">89.6% CPU @ 5,160 QPS</Status>\n</Step>\n<Step id="s10" title="Downstream GPU Host">\nPinned 1:1 from config\n</Step>\n</Lane>\n<Arrow from="s2" to="s4" />\n<Arrow from="s5" to="s7" />\n<Arrow from="s7" to="s9" />\n<Arrow from="s9" to="s10" />\n<Arrow from="s10" to="s8" style="dashed" />\n<Arrow from="s8" to="s6" />\n<Arrow from="s6" to="s3" />\n</Flow>\n\n<Cards>\n<Card title="DB Schema">\n<Status tone="accent">Zero (0 DDL)</Status>\n</Card>\n<Card title="Hold Time">\n<Status tone="accent">3.3 Seconds</Status>\n</Card>\n<Card title="QuerySet">\n<Status tone="accent">1 Fresh .bin</Status>\n</Card>\n<Card title="Verdict">\n<Status tone="accent">Completed = Pass</Status>\n</Card>\n</Cards>` }
];

export const masterSamples: Array<{ section: string; title: string; slide: Slide & { layout: Layout } }> = samples.map(({ section, title, layout, body, slots }, index) => ({
  section, title,
  slide: { id: `master-sample-${index + 1}`, index, layout, body, slots: slots ?? {}, reveals: [] }
}));
