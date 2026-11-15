import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  durationMs?: number;
  format?: (val: number) => string;
  className?: string;
}

export function AnimatedNumber({
  value,
  durationMs = 600,
  format = (v) => String(Math.round(v)),
  className = '',
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const currentRef = useRef<number>(value);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || durationMs <= 0) {
      currentRef.current = value;
      setDisplayValue(value);
      return;
    }

    const startValue = currentRef.current;
    const delta = value - startValue;
    if (Math.abs(delta) < 0.001) {
      currentRef.current = value;
      setDisplayValue(value);
      return;
    }

    let frameId = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = startValue + delta * eased;
      currentRef.current = next;
      setDisplayValue(next);

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        currentRef.current = value;
        setDisplayValue(value);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [value, durationMs]);

  return <span className={`tabular-nums ${className}`}>{format(displayValue)}</span>;
}
