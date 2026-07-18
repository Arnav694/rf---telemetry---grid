import type { NodeStatus } from '../../types';
import { STATUS_LABEL, STATUS_COLOR } from '../../lib/status';

interface StatusBadgeProps {
  status: NodeStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const color = STATUS_COLOR[status];
  const label = STATUS_LABEL[status];
  const pulse = status === 'live';

  return (
    <span
      className={`status-badge status-badge--${status} status-badge--${size}`}
      role="status"
      aria-label={`Node status: ${label}`}
      style={{ '--status-color': color } as React.CSSProperties}
    >
      <span className={`status-dot${pulse ? ' status-dot--pulse' : ''}`} />
      {label}
    </span>
  );
}
