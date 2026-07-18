export interface NodeData {
  node_id: string;
  topic: string;
  temperature: number | null;
  humidity: number | null;
  congestion_score: number | null;
  loudest_channel: number | null;
  loudest_hits: number | null;
  rf_noise: number[] | null;
  schema_version: number | null;
  source_timestamp: number | null;
  received_at: string | null;
  last_seen_epoch: number | null;
  online: boolean;
  encrypted: boolean | null;
  algorithm: string | null;
  sensor_ok: boolean | null;
  radio_ok: boolean | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface HealthResponse {
  api: string;
  mqtt_connected: boolean;
  subscribed_topic: string;
  node_count: number;
}

export interface NodesResponse {
  count: number;
  nodes: NodeData[];
}

export type NodeStatus = 'live' | 'stale' | 'offline' | 'unknown';
export type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'error';
export type AppView = 'dashboard' | 'map';
