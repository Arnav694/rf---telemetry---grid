import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useNodeHistory } from '../hooks/useNodeHistory';
import { SkeletonLine } from './ui/LoadingSkeleton';

interface HistoryChartsProps {
  nodeId: string;
}

interface HistoryPoint {
  time: string;
  temperature: number | null;
  humidity: number | null;
  congestion: number | null;
}

const TOOLTIP_STYLE = {
  background: '#0d1424',
  border: '1px solid rgba(148,163,184,0.2)',
  borderRadius: '8px',
  color: '#f1f5f9',
  fontSize: '12px',
  padding: '8px 12px',
};

function formatAxisTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatTooltipTime(iso: string | number): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

interface MiniChartProps {
  data: HistoryPoint[];
  dataKey: keyof HistoryPoint;
  color: string;
  label: string;
  unit: string;
}

function MiniChart({ data, dataKey, color, label, unit }: MiniChartProps) {
  const hasData = data.some((d) => d[dataKey] != null);

  if (!hasData) {
    return (
      <div className="history-chart">
        <div className="history-chart__title">{label}</div>
        <div className="chart-empty">No {label.toLowerCase()} history available.</div>
      </div>
    );
  }

  return (
    <div className="history-chart">
      <div className="history-chart__title">{label}</div>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(148,163,184,0.07)" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fill: '#64748b', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(148,163,184,0.12)' }}
            tickFormatter={formatAxisTime}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={36}
            tickFormatter={(v: number) => `${v.toFixed(1)}`}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={(lbl: unknown) => formatTooltipTime(lbl as string | number)}
            formatter={(value: unknown) => {
              const v = typeof value === 'number' ? value : Number(value ?? 0);
              return [`${v.toFixed(2)}${unit}`, label];
            }}
          />
          <Area
            type="monotone"
            dataKey={dataKey as string}
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#grad-${dataKey})`}
            connectNulls={false}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HistoryCharts({ nodeId }: HistoryChartsProps) {
  const { history, loading, error } = useNodeHistory(nodeId);

  if (loading) {
    return (
      <div className="history-charts-loading">
        <SkeletonLine height={140} />
        <SkeletonLine height={140} />
        <SkeletonLine height={140} />
      </div>
    );
  }

  if (error) {
    return <div className="chart-empty">Failed to load historical data.</div>;
  }

  if (history.length === 0) {
    return <div className="chart-empty">No historical data available yet.</div>;
  }

  // Oldest-first, filter to items with a valid timestamp
  const points: HistoryPoint[] = history
    .filter((h) => h.received_at != null)
    .map((h) => ({
      time: h.received_at!,
      temperature: h.temperature,
      humidity: h.humidity,
      congestion: h.congestion_score,
    }))
    .reverse();

  return (
    <div className="history-charts">
      <MiniChart data={points} dataKey="temperature" color="#f97316" label="Temperature" unit=" °C" />
      <MiniChart data={points} dataKey="humidity" color="#38bdf8" label="Humidity" unit=" %" />
      <MiniChart data={points} dataKey="congestion" color="#a78bfa" label="Congestion" unit="" />
    </div>
  );
}
