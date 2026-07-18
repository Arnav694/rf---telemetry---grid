import { RF_BASE_FREQ_MHZ } from './constants';

export function fmtTemp(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v.toFixed(1)} °C`;
}

export function fmtHumidity(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v.toFixed(1)} %`;
}

export function fmtCongestion(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toFixed(3);
}

export function channelToMHz(channel: number): number {
  return RF_BASE_FREQ_MHZ + channel;
}

export function fmtChannel(channel: number | null | undefined): string {
  if (channel == null) return '—';
  return `Ch ${channel} · ${channelToMHz(channel)} MHz`;
}

export function fmtRelative(epochSeconds: number | null | undefined): string {
  if (epochSeconds == null || epochSeconds === 0) return 'Never';
  const diffMs = Date.now() - epochSeconds * 1000;
  const diffS = Math.floor(diffMs / 1000);
  if (diffS < 0) return 'just now';
  if (diffS < 5) return 'just now';
  if (diffS < 60) return `${diffS}s ago`;
  const diffM = Math.floor(diffS / 60);
  if (diffM < 60) return `${diffM}m ago`;
  const diffH = Math.floor(diffM / 60);
  return `${diffH}h ${diffM % 60}m ago`;
}

export function fmtUptime(sourceTimestampMs: number | null | undefined): string {
  if (sourceTimestampMs == null) return '—';
  const totalS = Math.floor(sourceTimestampMs / 1000);
  if (totalS < 60) return `${totalS}s`;
  if (totalS < 3600) return `${Math.floor(totalS / 60)}m ${totalS % 60}s`;
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  return `${h}h ${m}m`;
}

export function fmtTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** Compute average, excluding null / non-finite values. Returns null if no valid values. */
export function avg(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}
