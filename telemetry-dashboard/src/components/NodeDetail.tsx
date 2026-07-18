import { ArrowLeft, CheckCircle, Clock, Cpu, Droplets, Lock, Radio, Tag, Thermometer, Unlock, XCircle, Zap } from 'lucide-react';
import type { NodeData } from '../types';
import {
  fmtChannel,
  fmtCongestion,
  fmtHumidity,
  fmtRelative,
  fmtTemp,
  fmtUptime,
} from '../lib/format';
import { getNodeStatus } from '../lib/status';
import { StatusBadge } from './ui/StatusBadge';
import { SpectrumChart } from './SpectrumChart';
import { HistoryCharts } from './HistoryCharts';

interface NodeDetailProps {
  node: NodeData;
  onBack: () => void;
}

function HealthIndicator({ label, ok }: { label: string; ok: boolean | null }) {
  if (ok === null) {
    return (
      <div className="health-item health-item--unknown">
        <span className="health-dot" />
        {label}: <span>Unavailable</span>
      </div>
    );
  }
  return (
    <div className={`health-item${ok ? ' health-item--ok' : ' health-item--fail'}`}>
      {ok ? <CheckCircle size={12} /> : <XCircle size={12} />}
      {label}: <span>{ok ? 'OK' : 'Fault'}</span>
    </div>
  );
}

export function NodeDetail({ node, onBack }: NodeDetailProps) {
  const status = getNodeStatus(node);
  const noSensorData =
    (node.temperature == null || !Number.isFinite(node.temperature)) &&
    (node.humidity == null || !Number.isFinite(node.humidity));

  return (
    <div className="node-detail">
      <header className="node-detail__header">
        <button className="btn btn--ghost" onClick={onBack} aria-label="Back to overview">
          <ArrowLeft size={14} />
          Overview
        </button>
        <div className="node-detail__title">
          <h2>{node.node_id}</h2>
          <StatusBadge status={status} />
        </div>
        <div className="node-detail__encrypt">
          {node.encrypted ? <Lock size={14} /> : <Unlock size={14} />}
          <code>{node.algorithm ?? (node.encrypted ? 'Encrypted' : 'Plaintext')}</code>
        </div>
      </header>

      {noSensorData && (
        <div className="node-detail__notice" role="alert">
          {node.encrypted && node.algorithm == null
            ? 'This node uses an unsupported encrypted payload — telemetry values unavailable.'
            : 'Sensor data not yet available for this node.'}
        </div>
      )}

      {/* Primary metrics */}
      <section className="node-detail__metrics" aria-label="Telemetry metrics">
        <div className="detail-metric">
          <Thermometer size={18} className="detail-metric__icon" />
          <span className="detail-metric__label">Temperature</span>
          <span className={`detail-metric__value${noSensorData ? ' detail-metric__value--dim' : ''}`}>
            {fmtTemp(node.temperature)}
          </span>
        </div>
        <div className="detail-metric">
          <Droplets size={18} className="detail-metric__icon" />
          <span className="detail-metric__label">Humidity</span>
          <span className={`detail-metric__value${noSensorData ? ' detail-metric__value--dim' : ''}`}>
            {fmtHumidity(node.humidity)}
          </span>
        </div>
        <div className="detail-metric">
          <Zap size={18} className="detail-metric__icon" />
          <span className="detail-metric__label">Congestion Score</span>
          <span className={`detail-metric__value${node.congestion_score == null ? ' detail-metric__value--dim' : ''}`}>
            {fmtCongestion(node.congestion_score)}
          </span>
        </div>
        <div className="detail-metric">
          <Radio size={18} className="detail-metric__icon" />
          <span className="detail-metric__label">Loudest Channel</span>
          <span className={`detail-metric__value${node.loudest_channel == null ? ' detail-metric__value--dim' : ''}`}>
            {fmtChannel(node.loudest_channel)}
          </span>
          {node.loudest_hits != null && (
            <span className="detail-metric__sub">{node.loudest_hits} hits</span>
          )}
        </div>
      </section>

      {/* Health & metadata */}
      <section className="node-detail__meta" aria-label="Node metadata">
        <div className="node-detail__meta-grid">
          <div className="meta-item">
            <Tag size={12} />
            <span>Topic</span>
            <code>{node.topic}</code>
          </div>
          <div className="meta-item">
            <Clock size={12} />
            <span>Last Seen</span>
            <code>{fmtRelative(node.last_seen_epoch)}</code>
          </div>
          <div className="meta-item">
            <Cpu size={12} />
            <span>Uptime</span>
            <code>{fmtUptime(node.source_timestamp)}</code>
          </div>
          {node.city && (
            <div className="meta-item">
              <span>City</span>
              <code>{node.city}</code>
            </div>
          )}
        </div>

        <div className="node-detail__health">
          <HealthIndicator label="Sensor" ok={node.sensor_ok} />
          <HealthIndicator label="Radio" ok={node.radio_ok} />
        </div>
      </section>

      {/* RF Spectrum */}
      <section className="node-detail__chart-section" aria-label="RF spectrum">
        <div className="chart-header">
          <Radio size={14} />
          <h3>RF Spectrum — 126 Channels (2400–2525 MHz)</h3>
        </div>
        <SpectrumChart rfNoise={node.rf_noise} loudestChannel={node.loudest_channel} />
      </section>

      {/* Historical data */}
      <section className="node-detail__chart-section" aria-label="Historical telemetry">
        <div className="chart-header">
          <Clock size={14} />
          <h3>Historical Data</h3>
        </div>
        <HistoryCharts nodeId={node.node_id} />
      </section>
    </div>
  );
}
