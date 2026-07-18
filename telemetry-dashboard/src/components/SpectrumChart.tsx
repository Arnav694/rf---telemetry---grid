import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { RF_BASE_FREQ_MHZ, RF_CHANNEL_COUNT } from '../lib/constants';

interface SpectrumChartProps {
  rfNoise: number[] | null;
  loudestChannel: number | null;
}

interface SpectrumPoint {
  ch: number;
  mhz: number;
  hits: number;
}

const TOOLTIP_STYLE = {
  background: '#0d1424',
  border: '1px solid rgba(148,163,184,0.2)',
  borderRadius: '8px',
  color: '#f1f5f9',
  fontSize: '12px',
  padding: '8px 12px',
};

export function SpectrumChart({ rfNoise, loudestChannel }: SpectrumChartProps) {
  if (!rfNoise || rfNoise.length === 0) {
    return (
      <div className="chart-empty">
        No RF scan data available for this node.
      </div>
    );
  }

  const data: SpectrumPoint[] = rfNoise
    .slice(0, RF_CHANNEL_COUNT)
    .map((hits, i) => ({ ch: i, mhz: RF_BASE_FREQ_MHZ + i, hits }));

  const maxHits = Math.max(...data.map((d) => d.hits), 1);

  return (
    <div className="spectrum-chart">
      <div className="spectrum-chart__peak" aria-live="polite">
        {loudestChannel != null && (
          <>
            Peak: <strong>Ch {loudestChannel}</strong> ·{' '}
            <strong>{RF_BASE_FREQ_MHZ + loudestChannel} MHz</strong>
            {' '}· <strong>{rfNoise[loudestChannel] ?? 0} hits</strong>
          </>
        )}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          barCategoryGap="0%"
          margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.07)" />
          <XAxis
            dataKey="mhz"
            tick={{ fill: '#64748b', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(148,163,184,0.12)' }}
            interval={Math.floor(data.length / 10) - 1}
            tickFormatter={(v: number) => `${v}`}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={28}
            domain={[0, maxHits + 2]}
          />
          <Tooltip
            cursor={{ fill: 'rgba(148,163,184,0.05)' }}
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: unknown) => {
              const v = typeof value === 'number' ? value : 0;
              return [`${v} hits`, 'Signal'];
            }}
            labelFormatter={(label: unknown) => {
              const m = Number(label);
              return `${m} MHz (Ch ${m - RF_BASE_FREQ_MHZ})`;
            }}
          />
          <Bar dataKey="hits" isAnimationActive={false} maxBarSize={8}>
            {data.map((entry) => {
              const isLoudest = entry.ch === loudestChannel;
              return (
                <Cell
                  key={`cell-${entry.ch}`}
                  fill={isLoudest ? '#22d3ee' : '#3b82f6'}
                  fillOpacity={isLoudest ? 1 : 0.55 + (entry.hits / maxHits) * 0.45}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="spectrum-chart__legend">
        <span className="spectrum-legend-peak" />Peak channel
        <span className="spectrum-legend-normal" />Other channels
      </div>
    </div>
  );
}
