import type { NodeData, NodeStatus } from '../types';
import { STATUS_LIVE_S, STATUS_STALE_S } from './constants';

export function getNodeStatus(node: NodeData): NodeStatus {
  // Nodes that have registered but never published data
  if (node.payload_status === 'awaiting_telemetry') return 'offline';

  const epoch = node.last_seen_epoch;
  // Treat null, zero, or non-finite epoch as offline
  if (epoch == null || epoch === 0 || !Number.isFinite(epoch)) return 'offline';

  // Math.max(0, …) guards against minor forward clock skew on the node side
  const diffS = Math.max(0, Date.now() / 1000 - epoch);
  if (diffS <= STATUS_LIVE_S) return 'live';
  if (diffS <= STATUS_STALE_S) return 'stale';
  return 'offline';
}

export const STATUS_LABEL: Record<NodeStatus, string> = {
  live: 'Live',
  stale: 'Stale',
  offline: 'Offline',
};

export const STATUS_COLOR: Record<NodeStatus, string> = {
  live: '#22d3ee',
  stale: '#fbbf24',
  offline: '#f87171',
};

export function sortByStatus(nodes: NodeData[]): NodeData[] {
  const order: Record<NodeStatus, number> = { live: 0, stale: 1, offline: 2 };
  return [...nodes].sort((a, b) => {
    const oa = order[getNodeStatus(a)];
    const ob = order[getNodeStatus(b)];
    if (oa !== ob) return oa - ob;
    return a.node_id.localeCompare(b.node_id);
  });
}
