export interface ChartData {
  type: 'line' | 'bar' | 'area' | 'scatter' | 'pie' | 'donut';
  labels: string[];
  series: Array<{ name: string; data: Array<number | [number, number]> }>;
  unit?: string;
  x?: string;
  y?: string;
}

const mermaidHeader = /^(?:flowchart\s+(?:TB|TD|BT|RL|LR)|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram)\s*$/;

export function safeMermaid(source: string): boolean {
  return source.length <= 4000 && source.split('\n').length <= 100 &&
    mermaidHeader.test(source.trim().split('\n')[0]) &&
    !/(?:%%\{|<|>|&|click\b|href\b|linkStyle\b|style\b|classDef\b|script\b|https?:|javascript:|data:)/i.test(
      source.replace(/-->|--\|/g, '').replace(/->>/g, ''),
    );
}

export function parseChart(source: string): ChartData {
  if (source.length > 20000) throw new Error('Chart exceeds size limit.');
  const input: unknown = JSON.parse(source);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Chart must be an object.');
  const chart = input as Record<string, unknown>;
  const allowed = ['type', 'labels', 'series', 'unit', 'x', 'y'];
  if (Object.keys(chart).some(key => !allowed.includes(key))) throw new Error('Unsupported chart option.');
  if (!['line', 'bar', 'area', 'scatter', 'pie', 'donut'].includes(String(chart.type))) {
    throw new Error('Unsupported chart type.');
  }
  const type = chart.type as ChartData['type'];
  const labels = chart.labels;
  const series = chart.series;
  if (!Array.isArray(labels) || labels.length > 120 ||
    !labels.every(label => typeof label === 'string' && label.length <= 100)) {
    throw new Error('Chart labels must be short text (up to 120).');
  }
  if (!Array.isArray(series) || !series.length || series.length > 4) throw new Error('Chart needs 1–4 series.');
  if (!series.every(item => item && typeof item === 'object' && !Array.isArray(item) &&
    Object.keys(item).every(key => key === 'name' || key === 'data') &&
    typeof item.name === 'string' && item.name.length <= 100 && Array.isArray(item.data) &&
    item.data.length <= 120 && (type === 'scatter'
      ? item.data.every((point: unknown) => Array.isArray(point) && point.length === 2 &&
          point.every((number: unknown) => typeof number === 'number' && Number.isFinite(number)))
      : item.data.every((number: unknown) => typeof number === 'number' && Number.isFinite(number))))) {
    throw new Error('Chart series must contain finite numbers or x/y pairs.');
  }
  if (type !== 'scatter' && series.some(item => item.data.length !== labels.length)) {
    throw new Error('Each series must match the label count.');
  }
  for (const key of ['unit', 'x', 'y'] as const) {
    if (chart[key] !== undefined && (typeof chart[key] !== 'string' || chart[key].length > 100)) {
      throw new Error(`Chart ${key} must be short text.`);
    }
  }
  return chart as unknown as ChartData;
}
