import { Activity, Droplets, Lock, Radio, Thermometer, Wifi, WifiOff } from 'lucide-react';
import type { NodeData, WsStatus } from '../types';
import { avg, fmtCongestion, fmtHumidity, fmtTemp } from '../lib/format';
import { getNodeStatus } from '../lib/status';

interface OverviewStatsProps {
  nodes: NodeData[];
  wsStatus: WsStatus;
  backendError: boolean;
}

export function OverviewStats({ nodes, wsStatus, backendError }: OverviewStatsProps) {
  const liveCount = nodes.filter((n) => getNodeStatus(n) === 'live').length;
  const avgTemp = avg(nodes.map((n) => n.temperature));
  const avgHumidity = avg(nodes.map((n) => n.humidity));
  const avgCongestion = avg(nodes.map((n) => n.congestion_score));
  const encryptedCount = nodes.filter((n) => n.encrypted === true).length;

  const wsConnected = wsStatus === 'connected';

  return (
    <section className="overview-stats" aria-label="Overview statistics">
      <div className="stat-card">
        <div className="stat-card__header">
          <Activity size={14} />
          <span>Active Nodes</span>
        </div>
        <div className="stat-card__value">{liveCount}</div>
        <div className="stat-card__sub">{nodes.length} total</div>
      </div>

      <div className="stat-card">
        <div className="stat-card__header">
          <Thermometer size={14} />
          <span>Avg Temperature</span>
        </div>
        <div className={`stat-card__value${avgTemp == null ? ' stat-card__value--dim' : ''}`}>
          {fmtTemp(avgTemp)}
        </div>
        <div className="stat-card__sub">
          {avgTemp == null ? 'No data available' : 'across reporting nodes'}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-card__header">
          <Droplets size={14} />
          <span>Avg Humidity</span>
        </div>
        <div className={`stat-card__value${avgHumidity == null ? ' stat-card__value--dim' : ''}`}>
          {fmtHumidity(avgHumidity)}
        </div>
        <div className="stat-card__sub">
          {avgHumidity == null ? 'No data available' : 'across reporting nodes'}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-card__header">
          <Radio size={14} />
          <span>Avg Congestion</span>
        </div>
        <div className={`stat-card__value${avgCongestion == null ? ' stat-card__value--dim' : ''}`}>
          {fmtCongestion(avgCongestion)}
        </div>
        <div className="stat-card__sub">
          {avgCongestion == null ? 'No data available' : 'congestion score'}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-card__header">
          <Lock size={14} />
          <span>Encrypted</span>
        </div>
        <div className="stat-card__value">{encryptedCount}</div>
        <div className="stat-card__sub">of {nodes.length} nodes</div>
      </div>

      {/* Connection status banner */}
      {(wsStatus !== 'connected' || backendError) && (
        <div className={`connection-banner${backendError ? ' connection-banner--error' : ''}`} role="alert">
          <WifiOff size={14} />
          {backendError
            ? 'Backend unreachable — showing cached data'
            : wsConnected
            ? null
            : `WebSocket ${wsStatus} — data may be stale`}
        </div>
      )}

      {wsConnected && !backendError && (
        <div className="connection-banner connection-banner--ok">
          <Wifi size={14} />
          Live telemetry active
        </div>
      )}
    </section>
  );
}
