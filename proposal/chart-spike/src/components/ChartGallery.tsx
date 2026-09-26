import { useState } from 'react';
import { Bar } from '@nivo/bar';
import { Line } from '@nivo/line';
import { Pie } from '@nivo/pie';
import { ScatterPlot } from '@nivo/scatterplot';

type Point = { name: string; value: number };
type Row = Point & { x: number; y: number };
type Kind = 'line' | 'bar' | 'area' | 'scatter' | 'pie' | 'donut';
type Props = { rows: Row[]; parts: Point[]; colors: string[] };
const kinds: Kind[] = ['line', 'bar', 'area', 'scatter', 'pie', 'donut'];
const margin = { top: 20, right: 30, bottom: 55, left: 55 };
function linePoint(result: { data: { x: string; y: number } } | { points: readonly { data: { x: string; y: number } }[] }): Point {
  const item = 'data' in result ? result.data : result.points[0]?.data;
  if (!item) throw new Error('Line event has no data point');
  return { name: item.x, value: item.y };
}

export default function ChartGallery({ rows, parts, colors }: Props) {
  const [selected, setSelected] = useState('None');
  const [hovered, setHovered] = useState('None');

  return <div className="gallery">
    {kinds.map((kind) => {
      const data = kind === 'pie' || kind === 'donut' ? parts : rows;
      const detail = (item: Point) => `${kind}: ${item.name} ${item.value}`;
      const choose = (item: Point) => setSelected(detail(item));
      const hover = (item: Point) => setHovered(detail(item));
      // ponytail: O(n) hit lookup at <= 1000 points; index by x/y if hover profiling warrants it.
      const scatterPoint = (node: { data: { x: number | string; y: number | string } }) => {
        const row = rows.find(({ x, y }) => x === node.data.x && y === node.data.y);
        if (!row) throw new Error('Scatter point is missing from the data');
        return row;
      };
      return <figure data-chart={kind} key={kind} aria-label={`${kind} chart`}>
        <figcaption>{kind[0].toUpperCase() + kind.slice(1)} chart</figcaption>
        {(kind === 'line' || kind === 'area') && <Line width={500} height={240}
          data={[{ id: 'values', data: rows.map(({ name, value }) => ({ x: name, y: value })) }]}
          margin={margin} xScale={{ type: 'point' }} yScale={{ type: 'linear', min: 0, max: 'auto' }}
          colors={[colors[0]]} enableArea={kind === 'area'} areaOpacity={0.35} pointSize={12}
          enableGridX={false} useMesh animate={false}
          onClick={(point) => choose(linePoint(point))}
          onMouseEnter={(point) => hover(linePoint(point))} />}
        {kind === 'bar' && <Bar width={500} height={240} data={rows}
          keys={['value']} indexBy="name" margin={margin} colors={[colors[0]]} animate={false}
          onClick={(bar) => choose({ name: String(bar.indexValue), value: Number(bar.value) })}
          onMouseEnter={(bar) => hover({ name: String(bar.indexValue), value: Number(bar.value) })} />}
        {kind === 'scatter' && <ScatterPlot width={500} height={240}
          data={[{ id: 'scatter', data: rows.map(({ x, y }) => ({ x, y })) }]}
          margin={margin} colors={[colors[2]]} animate={false}
          onClick={(node) => choose(scatterPoint(node))}
          onMouseEnter={(node) => hover(scatterPoint(node))} />}
        {(kind === 'pie' || kind === 'donut') && <Pie width={500} height={240}
          data={parts.map(({ name, value }) => ({ id: name, label: name, value }))}
          margin={margin} colors={colors} innerRadius={kind === 'donut' ? 0.55 : 0}
          padAngle={1} animate={false}
          onClick={(slice) => choose({ name: String(slice.id), value: slice.value })}
          onMouseEnter={(slice) => hover({ name: String(slice.id), value: slice.value })} />}
        <p className="interactions" role="status" data-testid={`${kind}-status`}>Selected: {selected}; Hovered: {hovered}</p>
        <details>
          <summary>Accessible chart data</summary>
          <table>
            <thead><tr><th scope="col">Name</th><th scope="col">Value</th></tr></thead>
            <tbody>{data.map((item) => <tr key={item.name}>
              <th scope="row">{item.name}</th>
              <td><button type="button" onClick={() => choose(item)} aria-label={`Select ${kind} ${item.name}: ${item.value}`}>{item.value}</button></td>
            </tr>)}</tbody>
          </table>
        </details>
      </figure>;
    })}
  </div>;
}
