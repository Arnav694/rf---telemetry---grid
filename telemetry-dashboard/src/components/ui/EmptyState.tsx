import { AlertTriangle, Radio, RefreshCw, WifiOff } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: 'radio' | 'wifi-off' | 'alert';
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ title, description, icon = 'radio', action }: EmptyStateProps) {
  const Icon = icon === 'radio' ? Radio : icon === 'wifi-off' ? WifiOff : AlertTriangle;

  return (
    <div className="empty-state" role="status">
      <div className="empty-state__icon">
        <Icon size={40} strokeWidth={1.25} />
      </div>
      <h3 className="empty-state__title">{title}</h3>
      {description && <p className="empty-state__desc">{description}</p>}
      {action && (
        <button className="btn btn--secondary" onClick={action.onClick}>
          <RefreshCw size={14} />
          {action.label}
        </button>
      )}
    </div>
  );
}

interface BackendErrorProps {
  onRetry: () => void;
}

export function BackendError({ onRetry }: BackendErrorProps) {
  return (
    <div className="backend-error">
      <div className="backend-error__inner">
        <WifiOff size={48} strokeWidth={1} className="backend-error__icon" />
        <h2>Backend Unavailable</h2>
        <p>
          Cannot reach <code>RF Telemetry Grid</code> API at{' '}
          <code>{import.meta.env['VITE_API_BASE_URL'] as string || 'http://127.0.0.1:8000'}</code>.
          <br />
          Ensure the FastAPI backend is running and accessible.
        </p>
        <button className="btn btn--primary" onClick={onRetry}>
          <RefreshCw size={14} />
          Retry Connection
        </button>
      </div>
    </div>
  );
}
