import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const props = onClick ? { role: 'button', tabIndex: 0, onClick } : {};
  return (
    <div className={`card ${className}`} {...props}>
      {children}
    </div>
  );
}

export function Btn({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  wide = false,
  size = 'md',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  wide?: boolean;
  size?: 'md' | 'lg';
}) {
  return (
    <button
      type="button"
      className={`btn btn-${variant} btn-${size} ${wide ? 'btn-wide' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

let ringId = 0;

export function Ring({
  progress,
  size = 104,
  stroke = 10,
  children,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const id = `ring-grad-${(ringId += 1) % 1000}`;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F0C97A" />
            <stop offset="100%" stopColor="#C98F35" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
}) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value}
        {unit ? <span className="stat-unit">{unit}</span> : null}
      </div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="label">{children}</div>;
}

export function Row({
  title,
  sub,
  right,
}: {
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="row">
      <div className="row-main">
        <div className="row-title">{title}</div>
        {sub ? <div className="row-sub">{sub}</div> : null}
      </div>
      {right ? <div className="row-right">{right}</div> : null}
    </div>
  );
}
