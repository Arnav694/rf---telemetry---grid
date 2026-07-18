import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { MapPin } from 'lucide-react';
import type { NodeData } from '../types';
import { getNodeStatus, STATUS_COLOR, STATUS_LABEL } from '../lib/status';
import { fmtCongestion, fmtHumidity, fmtRelative, fmtTemp } from '../lib/format';

// ── Leaflet default-icon fix for Vite bundler ──────────────────────────────
// Vite resolves assets differently from webpack; without this, default markers
// show broken images. We use CircleMarker below, but the fix is applied as a
// safety net in case Marker is used elsewhere.
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerIcon2xUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

// @ts-expect-error accessing private property to override Leaflet's built-in URL resolver
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIcon2xUrl,
  shadowUrl: markerShadowUrl,
});
// ──────────────────────────────────────────────────────────────────────────

/** Returns true when both lat and lon are finite numbers in valid ranges. */
function hasValidCoords(
  n: NodeData,
): n is NodeData & { latitude: number; longitude: number } {
  return (
    n.latitude != null &&
    n.longitude != null &&
    Number.isFinite(n.latitude) &&
    Number.isFinite(n.longitude) &&
    n.latitude >= -90 &&
    n.latitude <= 90 &&
    n.longitude >= -180 &&
    n.longitude <= 180
  );
}

interface NodePopupProps {
  node: NodeData;
  onViewDetails: (node: NodeData) => void;
}

function NodePopup({ node, onViewDetails }: NodePopupProps) {
  const status = getNodeStatus(node);
  return (
    <div className="map-popup">
      <div className="map-popup__header">
        <strong className="map-popup__id">{node.node_id}</strong>
        <span className="map-popup__status" style={{ color: STATUS_COLOR[status] }}>
          ● {STATUS_LABEL[status]}
        </span>
      </div>
      <div className="map-popup__grid">
        <span>Temp</span>      <span>{fmtTemp(node.temperature)}</span>
        <span>Humidity</span>  <span>{fmtHumidity(node.humidity)}</span>
        <span>Congestion</span><span>{fmtCongestion(node.congestion_score)}</span>
        <span>Last seen</span> <span>{fmtRelative(node.last_seen_epoch)}</span>
      </div>
      <button
        className="map-popup__btn"
        onClick={() => onViewDetails(node)}
      >
        View node details →
      </button>
    </div>
  );
}

// ── Map centre and zoom for India ──────────────────────────────────────────
const INDIA_CENTER: [number, number] = [22.5, 79];
const INDIA_ZOOM = 5;
// ──────────────────────────────────────────────────────────────────────────

interface TelemetryMapProps {
  nodes: NodeData[];
  onSelectNode: (node: NodeData) => void;
  /** compact = true → smaller fixed height for dashboard preview */
  compact?: boolean;
}

export function TelemetryMap({ nodes, onSelectNode, compact = false }: TelemetryMapProps) {
  const mappable   = nodes.filter(hasValidCoords);
  const unmappable = nodes.filter((n) => !hasValidCoords(n));

  // Full map page gets a responsive tall height; dashboard preview stays short.
  const mapHeight = compact ? '260px' : 'clamp(380px, 60vh, 700px)';

  return (
    <div className={`telemetry-map-section${compact ? ' telemetry-map-section--compact' : ''}`}>
      {/* ── Basemap ── renders UNCONDITIONALLY; markers only if coords exist ── */}
      <div className="map-container-wrap" style={{ height: mapHeight }}>
        <MapContainer
          center={INDIA_CENTER}
          zoom={INDIA_ZOOM}
          style={{ width: '100%', height: '100%' }}
          zoomControl={!compact}
          attributionControl={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {mappable.map((node) => {
            const status = getNodeStatus(node);
            const color  = STATUS_COLOR[status];
            const muted  = status === 'offline';
            return (
              <CircleMarker
                key={node.node_id}
                center={[node.latitude, node.longitude]}
                radius={compact ? 7 : 11}
                pathOptions={{
                  fillColor:   color,
                  fillOpacity: muted ? 0.45 : 0.85,
                  color:       muted ? color : '#fff',
                  weight:      muted ? 1 : 2,
                  opacity:     muted ? 0.4 : 0.7,
                }}
              >
                <Popup>
                  <NodePopup node={node} onViewDetails={onSelectNode} />
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      {/* ── "No location data" notice (full map view only) ────────────────── */}
      {!compact && nodes.length > 0 && mappable.length === 0 && (
        <div className="map-empty-notice">
          No nodes have supplied location data yet. Markers will appear once
          coordinates are reported.
        </div>
      )}

      {/* ── Location-unavailable panel ───────────────────────────────────── */}
      {unmappable.length > 0 && (
        <div className="map-unmapped">
          <div className="map-unmapped__header">
            <MapPin size={12} aria-hidden="true" />
            <span className="map-unmapped__label">Location unavailable</span>
            <span className="map-unmapped__count">
              {unmappable.length} node{unmappable.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="map-unmapped__nodes">
            {unmappable.map((n) => (
              <button
                key={n.node_id}
                className="map-unmapped__node"
                onClick={() => onSelectNode(n)}
                title={`View details for ${n.node_id}`}
              >
                {n.node_id}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
