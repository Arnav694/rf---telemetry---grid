// Vite replaces these at build time; these fallbacks are for local dev
export const API_BASE: string =
  (import.meta.env['VITE_API_BASE_URL'] as string | undefined) ||
  'http://127.0.0.1:8000';

export const WS_URL: string =
  (import.meta.env['VITE_WS_URL'] as string | undefined) ||
  'ws://127.0.0.1:8000/ws';

// Node status thresholds (seconds since last_seen_epoch)
export const STATUS_LIVE_S = 20;
export const STATUS_STALE_S = 60;

// RF spectrum
export const RF_BASE_FREQ_MHZ = 2400;
export const RF_CHANNEL_COUNT = 126;

// WebSocket reconnect backoff
export const WS_RECONNECT_BASE_MS = 1000;
export const WS_RECONNECT_MAX_MS = 30_000;

// Health polling interval
export const HEALTH_POLL_MS = 10_000;

// History
export const HISTORY_LIMIT = 100;
