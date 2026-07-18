interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  icon?: React.ReactNode;
  unavailable?: boolean;
}

export function MetricCard({ label, value, sub, accent, icon, unavailable }: MetricCardProps) {
  return (
    <div className={`metric-card${accent ? ' metric-card--accent' : ''}${unavailable ? ' metric-card--unavailable' : ''}`}>
      {icon && <span className="metric-card__icon" aria-hidden="true">{icon}</span>}
      <div className="metric-card__body">
        <span className="metric-card__label">{label}</span>
        <span className={`metric-card__value${unavailable ? ' metric-card__value--dim' : ''}`}>
          {value}
        </span>
        {sub && <span className="metric-card__sub">{sub}</span>}
      </div>
    </div>
  );
}
