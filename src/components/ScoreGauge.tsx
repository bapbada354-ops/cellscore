import { useId } from 'react';
import type { BandInfo } from '../config/modelConfig';
import { AnimatedNumber } from './AnimatedNumber';

interface ScoreGaugeProps {
  score: number;
  band: BandInfo;
  size?: 'hero' | 'compact' | 'mini';
}

const BAND_CHIP_STYLES: Record<BandInfo['tone'], string> = {
  good: 'bg-[var(--status-good-bg)] text-[var(--status-good)] border-[var(--status-good-border)]',
  fair: 'bg-[var(--status-fair-bg)] text-[var(--status-fair)] border-[var(--status-fair-border)]',
  poor: 'bg-[var(--status-poor-bg)] text-[var(--status-poor)] border-[var(--status-poor-border)]',
};

export function ScoreGauge({ score, band, size = 'hero' }: ScoreGaugeProps) {
  const gradId = useId();
  const clampedScore = Math.max(0, Math.min(100, score));

  const isHero = size === 'hero';
  const isMini = size === 'mini';
  const viewSize = isHero ? 260 : isMini ? 132 : 196;
  const strokeWidth = isHero ? 14 : isMini ? 9 : 11;
  const radius = (viewSize - strokeWidth) / 2 - (isMini ? 4 : 6);
  const center = viewSize / 2;
  const circumference = 2 * Math.PI * radius;

  // 250-degree open arc gauge (from 145 deg to 395 deg)
  const arcSpanDeg = 250;
  const arcLength = (arcSpanDeg / 360) * circumference;
  const filledLength = (clampedScore / 100) * arcLength;
  const dashOffset = arcLength - filledLength;

  // Gradient endpoints shift meaningfully for Fair/Poor bands while preserving mint-cyan hero accent
  const strokeStops =
    band.tone === 'poor'
      ? { start: 'var(--gauge-poor-start)', end: 'var(--gauge-poor-end)' }
      : band.tone === 'fair'
        ? { start: 'var(--gauge-fair-start)', end: 'var(--gauge-fair-end)' }
        : { start: 'var(--gauge-good-start)', end: 'var(--gauge-good-end)' };

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative flex items-center justify-center"
        style={{ width: viewSize, height: isHero ? 228 : isMini ? 120 : 176 }}
      >
        <svg
          width={viewSize}
          height={viewSize}
          viewBox={`0 0 ${viewSize} ${viewSize}`}
          className="overflow-visible"
          role="img"
          aria-label={`Battery score ${clampedScore} out of 100, ${band.label} ${band.tierName}`}
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={strokeStops.start} />
              <stop offset="100%" stopColor={strokeStops.end} />
            </linearGradient>
          </defs>

          <g transform={`rotate(145 ${center} ${center})`}>
            {/* Background track */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="var(--gauge-track)"
              strokeWidth={strokeWidth}
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeLinecap="round"
            />
            {/* Animated active arc */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth={strokeWidth}
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              className="cs-gauge-arc"
              style={{
                transition: 'stroke-dashoffset 600ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          </g>
        </svg>

        {/* Centered numeric readout & band chip */}
        <div className={`absolute inset-0 flex flex-col items-center justify-center ${isMini ? 'pt-2' : 'pt-3'}`}>
          {!isMini ? (
            <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)] font-medium mb-1">
              CellScore
            </span>
          ) : null}
          <div
            className={`font-display font-bold leading-none tracking-[-0.03em] text-[var(--text-primary)] ${
              isHero ? 'text-[80px] sm:text-[88px]' : isMini ? 'text-[38px]' : 'text-[64px]'
            }`}
          >
            <AnimatedNumber value={clampedScore} durationMs={600} />
          </div>
          <div
            className={`${isMini ? 'mt-1.5 px-2.5 py-0.5 text-[11px]' : 'mt-2.5 px-3 py-1 text-xs'} inline-flex items-center gap-1 rounded-full border font-semibold tracking-wide whitespace-nowrap ${
              BAND_CHIP_STYLES[band.tone]
            }`}
          >
            <span>{band.label}</span>
            {!isMini ? (
              <>
                <span aria-hidden="true" className="opacity-60">
                  ·
                </span>
                <span>{band.tierName}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
