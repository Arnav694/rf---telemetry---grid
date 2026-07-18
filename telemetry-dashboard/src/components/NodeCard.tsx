import { Clock, Droplets, Lock, Radio, Thermometer, Unlock } from 'lucide-react';
import type { NodeData } from '../types';
import { fmtChannel, fmtCongestion, fmtHumidity, fmtRelative, fmtTemp } from '../lib/format';
import { getNodeStatus } from '../lib/status';
import { StatusBadge } from './ui/StatusBadge';

interface NodeCardProps {
  node: NodeData;
  selected: boolean;
  onSelect: (node: NodeData) => void;
}

export function NodeCard({ node, selected, onSelect }: NodeCardProps) {
  const status = getNodeStatus(node);
  const hasTemp = node.temperature != null && Number.isFinite(node.temperature);
  const hasHumidity = node.humidity != null && Number.isFinite(node.humidity);
  const hasCongestion = node.congestion_score != null && Number.isFinite(node.congestion_score);
  const noSensorData = !hasTemp && !hasHumidity;

  return (
    <article
      className={`node-card node-card--${status}${selected ? ' node-card--selected' : ''}`}
      onClick={() => onSelect(node)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(node); } }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Node ${node.node_id}, status: ${status}`}
    >
      <header className="node-card__header">
        <div className="node-card__id-row">
          <StatusBadge status={status} size="sm" />
          <h3 className="node-card__id">{node.node_id}</h3>
        </div>
        <span className="node-card__encrypt" title={node.algorithm ?? (node.encrypted ? 'Encrypted' : 'Plaintext')}>
          {node.encrypted ? (
            <Lock size={12} className="encrypt-icon--locked" aria-label="Encrypted" />
          ) : (
            <Unlock size={12} className="encrypt-icon--open" aria-label="Plaintext" />
          )}
          {node.algorithm ?? (node.encrypted ? 'Encrypted' : 'Plaintext')}
        </span>
      </header>

      {noSensorData ? (
        <div className="node-card__unavailable">
          {node.encrypted && node.algorithm == null
            ? 'Unsupported encrypted payload'
            : 'Awaiting sensor data'}
        </div>
      ) : (
        <div className="node-card__metrics">
          <div className="node-metric">
            <Thermometer size={12} aria-hidden="true" />
            <span className="node-metric__value">{fmtTemp(node.temperature)}</span>
            <span className="node-metric__label">Temp</span>
          </div>
          <div className="node-metric">
            <Droplets size={12} aria-hidden="true" />
            <span className="node-metric__value">{fmtHumidity(node.humidity)}</span>
            <span className="node-metric__label">RH</span>
          </div>
          <div className="node-metric">
            <Radio size={12} aria-hidden="true" />
            <span className={`node-metric__value${!hasCongestion ? ' node-metric__value--dim' : ''}`}>
              {fmtCongestion(node.congestion_score)}
            </span>
            <span className="node-metric__label">Congestion</span>
          </div>
        </div>
      )}

      <footer className="node-card__footer">
        <span className="node-card__channel" title="Loudest RF channel">
          {fmtChannel(node.loudest_channel)}
          {node.loudest_hits != null && ` · ${node.loudest_hits} hits`}
        </span>
        <span className="node-card__age">
          <Clock size={10} aria-hidden="true" />
          {fmtRelative(node.last_seen_epoch)}
        </span>
      </footer>
    </article>
  );
}
