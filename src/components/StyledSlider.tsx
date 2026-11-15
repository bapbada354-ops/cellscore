import type { CSSProperties } from 'react';

interface StyledSliderProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  displayValue: string;
  onChange: (value: number) => void;
  compact?: boolean;
  hint?: string;
}

export function StyledSlider({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  displayValue,
  onChange,
  compact = false,
  hint,
}: StyledSliderProps) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const clampedPct = Math.max(0, Math.min(100, pct));

  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={id}
          className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-[var(--text-primary)] tracking-[0.01em]`}
        >
          {label}
          {hint ? <span className="ml-1.5 text-xs font-normal text-[var(--text-secondary)]">{hint}</span> : null}
        </label>
        <span
          className={`font-display tabular-nums font-semibold ${
            compact ? 'text-xs' : 'text-sm'
          } text-[var(--text-primary)] shrink-0`}
        >
          {displayValue}
        </span>
      </div>
      <div className="flex items-center min-h-[32px]">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ '--slider-pct': `${clampedPct}%` } as CSSProperties}
          className="cs-slider"
        />
      </div>
    </div>
  );
}
