import { Activity, LayoutDashboard, Map, Server, Wifi, WifiOff, X } from 'lucide-react';
import type { AppView, HealthResponse, WsStatus } from '../types';
import { fmtRelative } from '../lib/format';

interface SidebarProps {
  health: HealthResponse | null;
  wsStatus: WsStatus;
  nodeCount: number;
  lastUpdate: Date | null;
  view: AppView;
  onViewChange: (v: AppView) => void;
  isOpen: boolean;
  onClose: () => void;
}

const WS_LABEL: Record<WsStatus, string> = {
  connecting: 'Connecting…',
  connected: 'Live',
  disconnected: 'Reconnecting…',
  error: 'Error',
};

const WS_COLOR: Record<WsStatus, string> = {
  connecting: '#fbbf24',
  connected: '#22d3ee',
  disconnected: '#f87171',
  error: '#f87171',
};

export function Sidebar({ health, wsStatus, nodeCount, lastUpdate, view, onViewChange, isOpen, onClose }: SidebarProps) {
  const apiOnline = health?.api === 'online';
  const mqttOk = health?.mqtt_connected === true;

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="sidebar-overlay"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar${isOpen ? ' sidebar--open' : ''}`} aria-label="Navigation">
        <div className="sidebar__top">
          <div className="sidebar__brand">
            <div className="sidebar__logo" aria-hidden="true">
              <Activity size={18} strokeWidth={2} />
            </div>
            <div className="sidebar__brand-text">
              <span className="sidebar__title">RF Telemetry Grid</span>
              <span className="sidebar__subtitle">2.4 GHz Monitoring</span>
            </div>
          </div>

          <button
            className="sidebar__close"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="sidebar__nav" aria-label="Main navigation">
          <button
            className={`sidebar__nav-item${view === 'dashboard' ? ' sidebar__nav-item--active' : ''}`}
            onClick={() => { onViewChange('dashboard'); onClose(); }}
            aria-current={view === 'dashboard' ? 'page' : undefined}
          >
            <LayoutDashboard size={16} />
            Dashboard
          </button>
          <button
            className={`sidebar__nav-item${view === 'map' ? ' sidebar__nav-item--active' : ''}`}
            onClick={() => { onViewChange('map'); onClose(); }}
            aria-current={view === 'map' ? 'page' : undefined}
          >
            <Map size={16} />
            Grid Map
          </button>
        </nav>

        <div className="sidebar__status">
          <span className="sidebar__status-header">System Status</span>

          <div className="sidebar__status-row">
            <Server size={12} />
            <span>API</span>
            <span
              className="sidebar__status-dot"
              style={{ background: apiOnline ? '#34d399' : health === null ? '#fbbf24' : '#f87171' }}
            />
            <span className="sidebar__status-val">
              {health === null ? 'Polling…' : apiOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          <div className="sidebar__status-row">
            <Wifi size={12} />
            <span>MQTT</span>
            <span
              className="sidebar__status-dot"
              style={{ background: mqttOk ? '#34d399' : '#f87171' }}
            />
            <span className="sidebar__status-val">
              {health === null ? '—' : mqttOk ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          <div className="sidebar__status-row">
            {wsStatus === 'connected' ? <Wifi size={12} /> : <WifiOff size={12} />}
            <span>WebSocket</span>
            <span
              className="sidebar__status-dot"
              style={{ background: WS_COLOR[wsStatus] }}
            />
            <span className="sidebar__status-val">{WS_LABEL[wsStatus]}</span>
          </div>

          <div className="sidebar__status-divider" />

          <div className="sidebar__status-row">
            <Activity size={12} />
            <span>Nodes</span>
            <span className="sidebar__status-val sidebar__status-count">{nodeCount}</span>
          </div>

          {lastUpdate && (
            <div className="sidebar__last-update">
              Updated {fmtRelative(lastUpdate.getTime() / 1000)}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
