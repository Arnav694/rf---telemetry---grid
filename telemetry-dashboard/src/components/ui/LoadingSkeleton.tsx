export function LoadingSkeleton() {
  return (
    <div className="loading-skeleton" aria-busy="true" aria-label="Loading telemetry data">
      <div className="skeleton-stats">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton-block skeleton-stat" />
        ))}
      </div>
      <div className="skeleton-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-block skeleton-card" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonLine({ width = '100%', height = 16 }: { width?: string; height?: number }) {
  return (
    <div
      className="skeleton-block"
      style={{ width, height, borderRadius: 4 }}
      aria-hidden="true"
    />
  );
}
