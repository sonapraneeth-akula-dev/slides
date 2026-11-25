export interface ChartLine {
  x?: string | number;
  y?: number;
  label?: string;
  color?: string;
  style?: 'solid' | 'dashed' | 'dotted';
}

export interface ChartZone {
  xMin?: string;
  xMax?: string;
  yMin?: number;
  yMax?: number;
  label?: string;
  color?: string;
}

export interface ChartAnnotation {
  x: string | number;
  y: number;
  seriesIndex?: number;
  text: string;
  tone?: 'red' | 'amber' | 'green' | 'blue' | 'teal';
  dx?: number;
  dy?: number;
}

export interface ChartSeries {
  name: string;
  data: Array<number | [number, number]>;
  color?: string;
  style?: 'solid' | 'dashed' | 'dotted';
  area?: boolean;
  pointColors?: Array<string | null>;
}

export interface ChartData {
  type: 'line' | 'bar' | 'area' | 'scatter' | 'pie' | 'donut';
  labels: string[];
  series: ChartSeries[];
  unit?: string;
  x?: string;
  y?: string;
  yMax?: number;
  showValues?: boolean;
  valueSuffix?: string;
  lines?: ChartLine[];
  zones?: ChartZone[];
  annotations?: ChartAnnotation[];
}

const hexColor = /^#[\da-fA-F]{6}$/;
const lineStyles = new Set(['solid', 'dashed', 'dotted']);
const annotationTones = new Set(['red', 'amber', 'green', 'blue', 'teal']);
const mermaidHeader = /^(?:flowchart\s+(?:TB|TD|BT|RL|LR)|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram)\s*$/;

export function safeMermaid(source: string): boolean {
  return source.length <= 4000 && source.split('\n').length <= 100 &&
    mermaidHeader.test(source.trim().split('\n')[0]) &&
    !/(?:%%\{|<|>|&|click\b|href\b|linkStyle\b|style\b|classDef\b|script\b|https?:|javascript:|data:)/i.test(
      source.replace(/-->|--\|/g, '').replace(/->>/g, ''),
    );
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function parseChart(source: string): ChartData {
  if (source.length > 20000) throw new Error('Chart exceeds size limit.');
  const input: unknown = JSON.parse(source);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Chart must be an object.');
  const chart = input as Record<string, unknown>;
  const allowed = ['type', 'labels', 'series', 'unit', 'x', 'y', 'yMax', 'showValues', 'valueSuffix', 'lines', 'zones', 'annotations'];
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
  const allowedSeriesKeys = new Set(['name', 'data', 'color', 'style', 'area', 'pointColors']);
  if (!series.every(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const s = item as Record<string, unknown>;
    if (Object.keys(s).some(key => !allowedSeriesKeys.has(key))) return false;
    if (typeof s.name !== 'string' || s.name.length > 100 || !Array.isArray(s.data) || s.data.length > 120) return false;
    if (s.color !== undefined && (typeof s.color !== 'string' || !hexColor.test(s.color))) return false;
    if (s.style !== undefined && !lineStyles.has(String(s.style))) return false;
    if (s.area !== undefined && typeof s.area !== 'boolean') return false;
    if (s.pointColors !== undefined && (!Array.isArray(s.pointColors) || s.pointColors.length !== s.data.length ||
        !s.pointColors.every(c => c === null || (typeof c === 'string' && hexColor.test(c))))) return false;
    return type === 'scatter'
      ? s.data.every((point: unknown) => Array.isArray(point) && point.length === 2 && point.every(finiteNumber))
      : s.data.every(finiteNumber);
  })) {
    throw new Error('Chart series must contain valid numbers and styling options.');
  }
  if (type !== 'scatter' && series.some(item => item.data.length !== labels.length)) {
    throw new Error('Each series must match the label count.');
  }
  for (const key of ['unit', 'x', 'y'] as const) {
    if (chart[key] !== undefined && (typeof chart[key] !== 'string' || chart[key].length > 100)) {
      throw new Error(`Chart ${key} must be short text.`);
    }
  }
  if (chart.yMax !== undefined && (!finiteNumber(chart.yMax) || chart.yMax <= 0)) {
    throw new Error('Chart yMax must be a positive number.');
  }
  if (chart.showValues !== undefined && typeof chart.showValues !== 'boolean') {
    throw new Error('Chart showValues must be boolean.');
  }
  if (chart.valueSuffix !== undefined && (typeof chart.valueSuffix !== 'string' || chart.valueSuffix.length > 12 || /[{<>}]/.test(chart.valueSuffix))) {
    throw new Error('Chart valueSuffix must be short plain text.');
  }
  if (chart.lines !== undefined) {
    if (!Array.isArray(chart.lines) || chart.lines.length > 12 || !chart.lines.every(raw => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
      const line = raw as Record<string, unknown>;
      if (Object.keys(line).some(k => !['x', 'y', 'label', 'color', 'style'].includes(k))) return false;
      const hasX = typeof line.x === 'string' || finiteNumber(line.x);
      const hasY = finiteNumber(line.y);
      if (hasX === hasY) return false;
      if (line.label !== undefined && (typeof line.label !== 'string' || line.label.length > 80)) return false;
      if (line.color !== undefined && (typeof line.color !== 'string' || !hexColor.test(line.color))) return false;
      if (line.style !== undefined && !lineStyles.has(String(line.style))) return false;
      return true;
    })) throw new Error('Chart lines must specify x or y with optional label, color, and style.');
  }
  if (chart.zones !== undefined) {
    if (!Array.isArray(chart.zones) || chart.zones.length > 8 || !chart.zones.every(raw => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
      const zone = raw as Record<string, unknown>;
      if (Object.keys(zone).some(k => !['xMin', 'xMax', 'yMin', 'yMax', 'label', 'color'].includes(k))) return false;
      if (zone.xMin !== undefined && typeof zone.xMin !== 'string') return false;
      if (zone.xMax !== undefined && typeof zone.xMax !== 'string') return false;
      if (zone.yMin !== undefined && !finiteNumber(zone.yMin)) return false;
      if (zone.yMax !== undefined && !finiteNumber(zone.yMax)) return false;
      if (zone.label !== undefined && (typeof zone.label !== 'string' || zone.label.length > 80)) return false;
      if (zone.color !== undefined && (typeof zone.color !== 'string' || !hexColor.test(zone.color))) return false;
      return zone.yMin !== undefined || zone.yMax !== undefined || zone.xMin !== undefined || zone.xMax !== undefined;
    })) throw new Error('Chart zones must specify valid bounds.');
  }
  if (chart.annotations !== undefined) {
    if (!Array.isArray(chart.annotations) || chart.annotations.length > 12 || !chart.annotations.every(raw => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
      const ann = raw as Record<string, unknown>;
      if (Object.keys(ann).some(k => !['x', 'y', 'seriesIndex', 'text', 'tone', 'dx', 'dy'].includes(k))) return false;
      if (!(typeof ann.x === 'string' || finiteNumber(ann.x)) || !finiteNumber(ann.y)) return false;
      if (ann.seriesIndex !== undefined && (!Number.isInteger(ann.seriesIndex) || Number(ann.seriesIndex) < 0 || Number(ann.seriesIndex) >= series.length)) return false;
      if (typeof ann.text !== 'string' || !ann.text.trim() || ann.text.length > 100) return false;
      if (ann.tone !== undefined && !annotationTones.has(String(ann.tone))) return false;
      if (ann.dx !== undefined && !finiteNumber(ann.dx)) return false;
      if (ann.dy !== undefined && !finiteNumber(ann.dy)) return false;
      return true;
    })) throw new Error('Chart annotations must specify x, y, and text.');
  }
  return chart as unknown as ChartData;
}
