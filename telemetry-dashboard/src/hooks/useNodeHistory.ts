import { useEffect, useState } from 'react';
import type { NodeData } from '../types';
import { api } from '../lib/api';
import { HISTORY_LIMIT } from '../lib/constants';

export interface NodeHistoryState {
  history: NodeData[];
  loading: boolean;
  error: boolean;
}

export function useNodeHistory(nodeId: string | null): NodeHistoryState {
  const [history, setHistory] = useState<NodeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!nodeId) {
      setHistory([]);
      setError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    api
      .history(nodeId, HISTORY_LIMIT)
      .then((data) => {
        if (!cancelled) {
          setHistory(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [nodeId]);

  return { history, loading, error };
}
