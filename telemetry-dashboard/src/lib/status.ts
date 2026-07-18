import type { NodeData, NodeStatus } from '../types';
import { STATUS_LIVE_S, STATUS_STALE_S } from './constants';

export function getNodeStatus(node: NodeData): NodeStatus {
  if (node.last_seen_epoch == null) return 'unknown';
  const diffS = Date.now() / 1000 - node.last_seen_epoch;
  if (diffS <= STATUS_LIVE_S) return 'live';
  if (diffS <= STATUS_STALE_S) return 'stale';
  return 'offline';
}

export const STATUS_LABEL: Record<NodeStatus, string> = {
  live: 'Live',
  stale: 'Stale',
  offline: 'Offline',
  unknown: 'Unknown',
};

export const STATUS_COLOR: Record<NodeStatus, string> = {
  live: '#22d3ee',
  stale: '#fbbf24',
  offline: '#f87171',
  unknown: '#6b7280',
};

export function sortByStatus(nodes: NodeData[]): NodeData[] {
  const order: Record<NodeStatus, number> = { live: 0, stale: 1, offline: 2, unknown: 3 };
  return [...nodes].sort((a, b) => {
    const oa = order[getNodeStatus(a)];
    const ob = order[getNodeStatus(b)];
    if (oa !== ob) return oa - ob;
    return a.node_id.localeCompare(b.node_id);
  });
}
