import { useEffect, useRef, useState } from 'react';
import type { NodeData, WsStatus } from '../types';
import { api } from '../lib/api';
import { WS_URL, WS_RECONNECT_BASE_MS, WS_RECONNECT_MAX_MS } from '../lib/constants';

export interface TelemetryState {
  nodes: NodeData[];
  wsStatus: WsStatus;
  loading: boolean;
  backendError: boolean;
  lastUpdate: Date | null;
}

interface SnapshotMessage {
  type: string;
  nodes: NodeData[];
}

function isSnapshot(msg: unknown): msg is SnapshotMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as Record<string, unknown>)['type'] === 'nodes_snapshot' &&
    Array.isArray((msg as Record<string, unknown>)['nodes'])
  );
}

export function useTelemetry(): TelemetryState {
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting');
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delayRef = useRef(WS_RECONNECT_BASE_MS);
  const deadRef = useRef(false);

  useEffect(() => {
    deadRef.current = false;

    function scheduleReconnect() {
      if (timerRef.current) clearTimeout(timerRef.current);
      const delay = delayRef.current;
      delayRef.current = Math.min(delay * 2, WS_RECONNECT_MAX_MS);
      timerRef.current = setTimeout(() => {
        if (!deadRef.current) connect();
      }, delay);
    }

    function connect() {
      if (deadRef.current) return;
      if (wsRef.current) {
        const old = wsRef.current;
        old.onopen = null;
        old.onclose = null;
        old.onerror = null;
        old.onmessage = null;
        old.close();
        wsRef.current = null;
      }
      setWsStatus('connecting');
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (deadRef.current) return;
        delayRef.current = WS_RECONNECT_BASE_MS;
        setWsStatus('connected');
      };

      ws.onmessage = (ev: MessageEvent<string>) => {
        if (deadRef.current) return;
        try {
          const parsed = JSON.parse(ev.data) as unknown;
          if (isSnapshot(parsed)) {
            setNodes(parsed.nodes);
            setLastUpdate(new Date());
            setBackendError(false);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (deadRef.current) return;
        setWsStatus('disconnected');
        scheduleReconnect();
      };

      ws.onerror = () => {
        if (deadRef.current) return;
        setWsStatus('error');
      };
    }

    // Fetch initial snapshot from REST while WebSocket connects
    api
      .nodes()
      .then((data) => {
        if (!deadRef.current) {
          setNodes(data.nodes);
          setBackendError(false);
          setLastUpdate(new Date());
        }
      })
      .catch(() => {
        if (!deadRef.current) setBackendError(true);
      })
      .finally(() => {
        if (!deadRef.current) setLoading(false);
      });

    connect();

    return () => {
      deadRef.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (wsRef.current) {
        const ws = wsRef.current;
        ws.onopen = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        ws.close();
        wsRef.current = null;
      }
    };
  }, []); // runs once on mount

  return { nodes, wsStatus, loading, backendError, lastUpdate };
}
