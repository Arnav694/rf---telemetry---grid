import { useState } from 'react';
import { Menu, Map, LayoutDashboard } from 'lucide-react';
import type { AppView, NodeData } from './types';
import { useTelemetry } from './hooks/useTelemetry';
import { useHealth } from './hooks/useHealth';
import { sortByStatus } from './lib/status';
import { Sidebar } from './components/Sidebar';
import { OverviewStats } from './components/OverviewStats';
import { NodeCard } from './components/NodeCard';
import { NodeDetail } from './components/NodeDetail';
import { TelemetryMap } from './components/TelemetryMap';
import { LoadingSkeleton } from './components/ui/LoadingSkeleton';
import { BackendError, EmptyState } from './components/ui/EmptyState';
import './index.css';

export default function App() {
  const { nodes, wsStatus, loading, backendError, lastUpdate } = useTelemetry();
  const health = useHealth();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [view, setView] = useState<AppView>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const selectedNode = nodes.find((n) => n.node_id === selectedNodeId) ?? null;

  function handleSelectNode(node: NodeData) {
    setSelectedNodeId(node.node_id);
    setView('dashboard');
  }

  function handleBack() {
    setSelectedNodeId(null);
  }

  function handleRetry() {
    window.location.reload();
  }

  if (backendError && !loading && nodes.length === 0) {
    return <BackendError onRetry={handleRetry} />;
  }

  const sorted = sortByStatus(nodes);

  return (
    <div className="app">
      <Sidebar
        health={health}
        wsStatus={wsStatus}
        nodeCount={nodes.length}
        lastUpdate={lastUpdate}
        view={view}
        onViewChange={(v) => { setView(v); setSelectedNodeId(null); }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="app__main">
        <header className="mobile-topbar" aria-label="Mobile navigation">
          <button
            className="mobile-topbar__menu"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>
          <span className="mobile-topbar__title">RF Telemetry Grid</span>
          <div className="mobile-topbar__actions">
            <button
              className={`mobile-tab${view === 'dashboard' && !selectedNode ? ' mobile-tab--active' : ''}`}
              onClick={() => { setView('dashboard'); setSelectedNodeId(null); }}
              aria-label="Dashboard view"
            >
              <LayoutDashboard size={16} />
            </button>
            <button
              className={`mobile-tab${view === 'map' ? ' mobile-tab--active' : ''}`}
              onClick={() => { setView('map'); setSelectedNodeId(null); }}
              aria-label="Map view"
            >
              <Map size={16} />
            </button>
          </div>
        </header>

        <main className="app__content" id="main-content" aria-label="Main content">
          {loading ? (
            <LoadingSkeleton />
          ) : selectedNode ? (
            <NodeDetail node={selectedNode} onBack={handleBack} />
          ) : view === 'map' ? (
            <div className="page-section">
              <div className="page-header">
                <h2 className="page-title">Grid Map</h2>
                <p className="page-sub">Geographic distribution of telemetry nodes</p>
              </div>
              <TelemetryMap nodes={nodes} onSelectNode={handleSelectNode} />
              {nodes.length === 0 && (
                <EmptyState
                  title="No nodes reporting"
                  description="Connect ESP32 nodes to the MQTT broker to see them here."
                  icon="radio"
                />
              )}
            </div>
          ) : (
            <div className="page-section">
              <div className="page-header">
                <h2 className="page-title">Dashboard</h2>
                <p className="page-sub">
                  Distributed 2.4 GHz Spectrum &amp; Environmental Monitoring
                </p>
              </div>

              <OverviewStats nodes={nodes} wsStatus={wsStatus} backendError={backendError} />

              {nodes.length === 0 ? (
                <EmptyState
                  title="No nodes reporting"
                  description="Waiting for ESP32 nodes to publish telemetry via the MQTT broker."
                  icon="radio"
                  action={{ label: 'Refresh', onClick: handleRetry }}
                />
              ) : (
                <>
                  <section className="node-grid" aria-label="Node list">
                    {sorted.map((node) => (
                      <NodeCard
                        key={node.node_id}
                        node={node}
                        selected={node.node_id === selectedNodeId}
                        onSelect={handleSelectNode}
                      />
                    ))}
                  </section>

                  <div className="map-section-header">
                    <Map size={14} />
                    <h3>Node Locations</h3>
                  </div>
                  <TelemetryMap nodes={nodes} onSelectNode={handleSelectNode} compact />
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
