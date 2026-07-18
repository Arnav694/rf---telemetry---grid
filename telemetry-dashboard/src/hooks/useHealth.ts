import { useEffect, useState } from 'react';
import type { HealthResponse } from '../types';
import { api } from '../lib/api';
import { HEALTH_POLL_MS } from '../lib/constants';

export function useHealth(): HealthResponse | null {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      api
        .health()
        .then((h) => {
          if (!cancelled) setHealth(h);
        })
        .catch(() => {
          if (!cancelled) setHealth(null);
        });
    };
    poll();
    const id = setInterval(poll, HEALTH_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return health;
}
