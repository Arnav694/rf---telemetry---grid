import type { HealthResponse, NodesResponse, NodeData } from '../types';
import { API_BASE } from './constants';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export const api = {
  health: () => get<HealthResponse>('/api/health'),
  nodes: () => get<NodesResponse>('/api/nodes'),
  node: (id: string) => get<NodeData>(`/api/nodes/${encodeURIComponent(id)}`),
  history: (id: string, limit = 100) =>
    get<NodeData[]>(`/api/nodes/${encodeURIComponent(id)}/history?limit=${limit}`),
};
