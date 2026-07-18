import { useEffect, useState } from 'react';

/**
 * Returns an incrementing counter that ticks every `intervalMs` milliseconds.
 * Consuming components re-render on each tick, allowing time-derived values
 * (e.g. node status from Date.now()) to stay current without new WebSocket data.
 */
export function useTick(intervalMs: number): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}
