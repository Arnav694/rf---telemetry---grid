# RF Telemetry Grid — Frontend

**Distributed 2.4 GHz Spectrum & Environmental Monitoring**

A production-quality live dashboard for a nationwide ESP32 RF telemetry grid. Built with React 19, TypeScript, Vite, Recharts, and React Leaflet.

---

## Features

- **Live WebSocket updates** from the FastAPI backend with capped exponential-backoff reconnect
- **Overview dashboard** — active node count, average temp/humidity/congestion, encrypted node count
- **Node cards** — status badges (Live/Stale/Offline), metrics, loudest RF channel in MHz, last-seen time
- **Node detail view** — large metrics, sensor/radio health, source topic, uptime
- **RF Spectrum chart** — full 126-channel (2400–2525 MHz) bar chart with peak channel highlight
- **Historical charts** — temperature, humidity, congestion over time from the history endpoint
- **India telemetry map** — React Leaflet map; nodes without coordinates shown separately
- **Robust states** — loading skeletons, backend error screen, WebSocket disconnection banner, empty state, unsupported payload handling
- **Responsive** — sidebar on desktop, collapsible hamburger on mobile/tablet

---

## Required Environment Variables

Create `.env.local` in this directory (already present):

```
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_WS_URL=ws://127.0.0.1:8000/ws
```

> The frontend never connects to MQTT directly and contains no credentials or AES keys.

---

## Backend Dependency

Requires the FastAPI backend to be running on port 8000. The backend must:
- Subscribe to the HiveMQ MQTT broker
- Expose `GET /api/health`, `GET /api/nodes`, `GET /api/nodes/{id}`, `GET /api/nodes/{id}/history`
- Expose a WebSocket at `/ws` that emits `nodes_snapshot` messages

---

## Development

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173` (or next available port).

---

## Production Build

```bash
npm run build        # type-check + Vite bundle → dist/
npm run preview      # serve dist/ locally
```

---

## Architecture

```
src/
  types/index.ts          — NodeData, HealthResponse, status/view types
  lib/
    constants.ts          — API URL, status thresholds, RF constants, WS backoff
    api.ts                — typed fetch client (health, nodes, history)
    format.ts             — fmtTemp/Humidity/Congestion/Channel/Relative/Uptime, avg()
    status.ts             — getNodeStatus(), STATUS_LABEL/COLOR, sortByStatus()
  hooks/
    useTelemetry.ts       — REST initial fetch + WebSocket with exponential backoff
    useNodeHistory.ts     — history endpoint fetch
    useHealth.ts          — /api/health polling every 10 s
  components/
    ui/
      StatusBadge.tsx     — Live/Stale/Offline/Unknown badge with pulse animation
      MetricCard.tsx      — reusable labelled metric tile
      LoadingSkeleton.tsx — shimmer skeleton for initial load
      EmptyState.tsx      — empty, backend error, and retry states
    Sidebar.tsx           — brand, navigation, system status panel
    OverviewStats.tsx     — 5-stat summary row + connection banner
    NodeCard.tsx          — clickable node summary card
    NodeDetail.tsx        — full node detail view
    SpectrumChart.tsx     — 126-channel Recharts BarChart with peak highlight
    HistoryCharts.tsx     — three AreaCharts (temp/humidity/congestion) from history API
    TelemetryMap.tsx      — React Leaflet map with CircleMarker per node
  App.tsx                 — app shell, view routing, node selection state
  index.css               — complete CSS (design tokens, layout, all components)
```

**Node status** is computed client-side from `last_seen_epoch`:
- **Live**: within 20 s (configurable in `lib/constants.ts`)
- **Stale**: 20–60 s
- **Offline**: > 60 s
