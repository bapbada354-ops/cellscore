import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  CONFIG,
  calculateVehicleFairPrice,
  clamp,
  formatINR,
  formatIndianNumber,
  type BatteryInput,
  type FairPriceResult,
} from '../config/modelConfig';
import { AnimatedNumber } from './AnimatedNumber';
import { StyledSlider } from './StyledSlider';

export type PriceBatteryKey = 'custom' | 'scooter-a' | 'scooter-b';
export type PriceRoleMode = 'buyer' | 'seller';

interface PriceScreenProps {
  selectedBatteryKey: PriceBatteryKey;
  onSelectBatteryKey: (key: PriceBatteryKey) => void;
  askingPriceInr: number;
  onChangeAskingPrice: (price: number) => void;
  roleMode: PriceRoleMode;
  onChangeRoleMode: (mode: PriceRoleMode) => void;
  customInput: BatteryInput;
  scooterAInput: BatteryInput;
  scooterBInput: BatteryInput;
}

const QUICK_ASK_CHIPS = [65000, 80000, 105000];

const VERDICT_COLOR_STYLES: Record<
  FairPriceResult['verdictTone'],
  { text: string; badge: string }
> = {
  bargain: {
    text: 'text-[var(--status-good)]',
    badge: 'bg-[var(--status-good-bg)] text-[var(--status-good)] border-[var(--status-good-border)]',
  },
  fair: {
    text: 'text-[var(--accent-cyan)]',
    badge: 'bg-[var(--status-cyan-bg)] text-[var(--accent-cyan)] border-[var(--status-cyan-border)]',
  },
  overpriced: {
    text: 'text-[var(--status-fair)]',
    badge: 'bg-[var(--status-fair-bg)] text-[var(--status-fair)] border-[var(--status-fair-border)]',
  },
  'way-overpriced': {
    text: 'text-[var(--status-poor)]',
    badge: 'bg-[var(--status-poor-bg)] text-[var(--status-poor)] border-[var(--status-poor-border)]',
  },
};

// Maps ratio [0.65 .. 1.45] to [0 .. 1] along the 180-degree semicircle
const DIAL_MIN_RATIO = 0.65;
const DIAL_MAX_RATIO = 1.45;

function ratioToProgress(r: number): number {
  return clamp((r - DIAL_MIN_RATIO) / (DIAL_MAX_RATIO - DIAL_MIN_RATIO), 0, 1);
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startProgress: number,
  endProgress: number,
): string {
  // Progress 0 = 180 deg (left), Progress 1 = 360 deg (right)
  const startAngle = 180 + startProgress * 180;
  const endAngle = 180 + endProgress * 180;
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export function PriceScreen({
  selectedBatteryKey,
  onSelectBatteryKey,
  askingPriceInr,
  onChangeAskingPrice,
  roleMode,
  onChangeRoleMode,
  customInput,
  scooterAInput,
  scooterBInput,
}: PriceScreenProps) {
  const [askingText, setAskingText] = useState<string>(() =>
    askingPriceInr > 0 ? formatIndianNumber(askingPriceInr) : '',
  );

  const activeInput =
    selectedBatteryKey === 'scooter-a'
      ? scooterAInput
      : selectedBatteryKey === 'scooter-b'
        ? scooterBInput
        : customInput;

  const result = calculateVehicleFairPrice(activeInput, askingPriceInr);
  const hasAskingPrice = askingPriceInr > 0;

  const sliderClampedAsk = clamp(
    askingPriceInr,
    CONFIG.SLIDER_BOUNDS.askingPriceInr.min,
    CONFIG.SLIDER_BOUNDS.askingPriceInr.max,
  );

  const handleAskingInputChange = (raw: string) => {
    const digitsOnly = raw.replace(/[^\d]/g, '');
    if (digitsOnly === '') {
      setAskingText('');
      onChangeAskingPrice(0);
      return;
    }
    const parsed = Math.min(9999999, Number(digitsOnly));
    onChangeAskingPrice(parsed);
    setAskingText(formatIndianNumber(parsed));
  };

  const handleAskingSliderChange = (val: number) => {
    onChangeAskingPrice(val);
    setAskingText(formatIndianNumber(val));
  };

  const bodySharePct =
    result.fairValueInr > 0
      ? Math.round((result.bodyValueInr / result.fairValueInr) * 100)
      : 0;
  const batterySharePct = result.fairValueInr > 0 ? 100 - bodySharePct : 0;

  // Needle geometry (-90 deg = left, 0 deg = top center, +90 deg = right)
  const needleProgress = hasAskingPrice ? ratioToProgress(result.ratio) : 0;
  const needleAngleDeg = -90 + needleProgress * 180;

  const p0 = 0;
  const pBargainEnd = ratioToProgress(0.9);
  const pFairEnd = ratioToProgress(1.1);
  const pOverEnd = ratioToProgress(1.25);
  const pMax = 1;

  const verdictStyle = VERDICT_COLOR_STYLES[result.verdictTone];

  return (
    <div className="space-y-6">
      {/* Headline */}
      <div className="space-y-1">
        <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-medium">
          Used EV Valuation
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--text-primary)] tracking-tight text-balance">
          Is this used scooter fairly priced?
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Panel: Inputs */}
        <section
          aria-label="Price check inputs"
          className="lg:col-span-5 glass-card p-6 sm:p-8 space-y-6"
        >
          {/* Battery Source Dropdown */}
          <div className="space-y-2">
            <label
              htmlFor="price-battery-source"
              className="block text-xs font-medium text-[var(--text-secondary)]"
            >
              Battery source
            </label>
            <div className="relative">
              <select
                id="price-battery-source"
                value={selectedBatteryKey}
                onChange={(e) => onSelectBatteryKey(e.target.value as PriceBatteryKey)}
                className="cs-select w-full h-11 pl-3.5 pr-9 rounded-xl bg-[var(--surface-control)] border border-[var(--border-control)] text-sm font-medium text-[var(--text-primary)] hover:border-[var(--border-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60 transition-colors cursor-pointer"
              >
                <option value="custom" className="bg-[var(--bg-select-option)] text-[var(--text-primary)]">
                  Current Score inputs
                </option>
                <option value="scooter-a" className="bg-[var(--bg-select-option)] text-[var(--text-primary)]">
                  Scooter A: Gentle commuter
                </option>
                <option value="scooter-b" className="bg-[var(--bg-select-option)] text-[var(--text-primary)]">
                  Scooter B: Hard-use delivery
                </option>
              </select>
              <ChevronDown
                aria-hidden="true"
                className="w-4 h-4 text-[var(--text-secondary)] pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
              />
            </div>
            <p className="text-xs text-[var(--text-secondary)] tabular-nums">
              {activeInput.vehicleType === '2W' ? '2-Wheeler' : '3-Wheeler'} ·{' '}
              {activeInput.chemistry} · {activeInput.ageMonths} mo · Battery Score{' '}
              <span className="text-[var(--text-primary)] font-semibold">{result.scoreResult.score}</span>
            </p>
          </div>

          {/* Buyer / Seller Toggle */}
          <div className="space-y-2">
            <span className="block text-xs font-medium text-[var(--text-secondary)]">Perspective</span>
            <div
              role="group"
              aria-label="Buyer or Seller mode"
              className="grid grid-cols-2 p-1 rounded-xl bg-[var(--surface-glass)] border border-[var(--border-glass)]"
            >
              {(['buyer', 'seller'] as PriceRoleMode[]).map((mode) => {
                const active = roleMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onChangeRoleMode(mode)}
                    className={`h-9 rounded-lg text-xs font-semibold transition-all duration-200 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60 cursor-pointer ${
                      active
                        ? 'cs-seg-active border shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
                    }`}
                  >
                    {mode === 'buyer' ? 'Buyer' : 'Seller'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Asking Price Input + Slider */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor="price-asking-input"
                className="block text-xs font-medium text-[var(--text-secondary)]"
              >
                Asking price (Rs)
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-sm font-medium text-[var(--text-secondary)] pointer-events-none">
                  Rs
                </span>
                <input
                  id="price-asking-input"
                  type="text"
                  inputMode="numeric"
                  value={askingText}
                  placeholder="0"
                  onChange={(e) => handleAskingInputChange(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-[var(--surface-control)] border border-[var(--border-control)] font-display text-base font-semibold text-[var(--text-primary)] tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60"
                />
              </div>
            </div>

            <StyledSlider
              id="price-asking-slider"
              label="Adjust asking price"
              value={sliderClampedAsk}
              min={CONFIG.SLIDER_BOUNDS.askingPriceInr.min}
              max={CONFIG.SLIDER_BOUNDS.askingPriceInr.max}
              step={CONFIG.SLIDER_BOUNDS.askingPriceInr.step}
              displayValue={formatINR(askingPriceInr)}
              onChange={handleAskingSliderChange}
            />

            {/* Three Quick-Fill Chips */}
            <div className="space-y-1.5 pt-1">
              <span className="block text-[11px] uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                Quick-fill examples
              </span>
              <div className="flex flex-wrap gap-2">
                {QUICK_ASK_CHIPS.map((preset) => {
                  const isMatch = askingPriceInr === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleAskingSliderChange(preset)}
                      className={`px-3 py-1.5 rounded-full border text-xs font-semibold tabular-nums transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60 ${
                        isMatch
                          ? 'bg-[var(--status-good-bg)] border-[var(--status-good-border)] text-[var(--status-good)]'
                          : 'bg-[var(--surface-control)] border-[var(--border-control)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]'
                      }`}
                    >
                      {formatINR(preset)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Right Panel: Semicircle Dial, Fair Value, Split Bar, Advice */}
        <section
          aria-label="Fair price evaluation"
          className="lg:col-span-7 glass-card p-6 sm:p-8 space-y-6"
        >
          {/* Large Semicircle Dial with Animated Needle */}
          <div className="flex flex-col items-center pt-1">
            <div className="relative w-full max-w-[340px] flex flex-col items-center">
              <svg
                viewBox="0 0 300 175"
                className="w-full h-auto overflow-visible"
                role="img"
                aria-label={
                  hasAskingPrice
                    ? `Price verdict ${result.verdict}, ratio ${result.ratio.toFixed(2)} times fair value`
                    : 'Enter an asking price to evaluate'
                }
              >
                {/* 4 Verdict Arc Zones */}
                <path
                  d={describeArc(150, 150, 114, p0, pBargainEnd)}
                  fill="none"
                  stroke="var(--dial-bargain)"
                  strokeWidth={16}
                  strokeLinecap="butt"
                  opacity={0.9}
                />
                <path
                  d={describeArc(150, 150, 114, pBargainEnd, pFairEnd)}
                  fill="none"
                  stroke="var(--dial-fair)"
                  strokeWidth={16}
                  strokeLinecap="butt"
                  opacity={0.9}
                />
                <path
                  d={describeArc(150, 150, 114, pFairEnd, pOverEnd)}
                  fill="none"
                  stroke="var(--dial-over)"
                  strokeWidth={16}
                  strokeLinecap="butt"
                  opacity={0.9}
                />
                <path
                  d={describeArc(150, 150, 114, pOverEnd, pMax)}
                  fill="none"
                  stroke="var(--dial-high)"
                  strokeWidth={16}
                  strokeLinecap="butt"
                  opacity={0.9}
                />

                {/* Subtle Inner Track */}
                <path
                  d={describeArc(150, 150, 94, 0, 1)}
                  fill="none"
                  stroke="var(--gauge-track)"
                  strokeWidth={1.5}
                />

                {/* Animated Needle */}
                <g
                  style={{
                    transform: `rotate(${needleAngleDeg}deg)`,
                    transformOrigin: '150px 150px',
                    transition: 'transform 550ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  <line
                    x1={150}
                    y1={150}
                    x2={150}
                    y2={44}
                    stroke="var(--text-primary)"
                    strokeWidth={3.5}
                    strokeLinecap="round"
                  />
                </g>
                <circle
                  cx={150}
                  cy={150}
                  r={8}
                  fill="var(--text-primary)"
                  stroke="var(--bg-canvas)"
                  strokeWidth={2.5}
                />
              </svg>

              {/* Zone Legend */}
              <div className="w-full flex items-center justify-between text-[11px] text-[var(--text-secondary)] px-2 -mt-2 tabular-nums">
                <span>&lt;0.90× Bargain</span>
                <span>0.90–1.10× Fair</span>
                <span>&gt;1.25× High</span>
              </div>
            </div>

            {/* Verdict Label */}
            <div className="mt-4 text-center space-y-1.5">
              {hasAskingPrice ? (
                <>
                  <div
                    className={`inline-flex items-center px-3.5 py-1 rounded-full border text-xs font-semibold ${verdictStyle.badge}`}
                  >
                    {result.ratio.toFixed(2)}× fair value
                  </div>
                  <p className={`font-display text-3xl sm:text-4xl font-bold ${verdictStyle.text}`}>
                    {result.verdict}
                  </p>
                </>
              ) : (
                <p className="font-display text-2xl font-semibold text-[var(--text-secondary)]">
                  Enter an asking price
                </p>
              )}
            </div>
          </div>

          {/* Estimated Fair Value Line */}
          <div className="glass-tile p-4 sm:p-5 text-center space-y-1">
            <p className="font-display text-lg sm:text-xl font-semibold text-[var(--text-primary)] tabular-nums">
              Estimated fair value:{' '}
              <span className="text-[var(--accent-mint)]">
                <AnimatedNumber value={result.fairValueInr} format={(v) => formatINR(v)} />
              </span>{' '}
              <span className="text-sm font-normal text-[var(--text-secondary)]">
                (range {formatINR(result.rangeLowInr)} to {formatINR(result.rangeHighInr)})
              </span>
            </p>
          </div>

          {/* Body vs Battery Split Bar */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-primary)] font-medium tabular-nums">
                Body: {formatINR(result.bodyValueInr)} ({bodySharePct}%)
              </span>
              <span className="text-[var(--text-primary)] font-medium tabular-nums">
                Battery: {formatINR(result.batteryValueInr)} ({batterySharePct}%)
              </span>
            </div>
            <div
              className="h-3 w-full rounded-full bg-[var(--surface-track)] overflow-hidden flex"
              role="img"
              aria-label={`Fair value split: ${bodySharePct}% body, ${batterySharePct}% battery`}
            >
              <div
                className="h-full bg-[var(--dial-fair)] transition-all duration-300"
                style={{ width: `${bodySharePct}%` }}
              />
              <div
                className="h-full bg-[var(--dial-bargain)] transition-all duration-300"
                style={{ width: `${batterySharePct}%` }}
              />
            </div>
          </div>

          {/* Single Line of Buyer / Seller Advice */}
          <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3 flex-wrap">
            <p className="font-display text-base sm:text-lg font-semibold text-[var(--text-primary)] tabular-nums">
              {roleMode === 'buyer'
                ? `Offer around ${formatINR(result.fairValueInr)}`
                : `Expect offers around ${formatINR(result.fairValueInr)}`}
            </p>
            <span className="text-xs text-[var(--text-secondary)]">
              {roleMode === 'buyer' ? 'Buyer guidance' : 'Seller guidance'}
            </span>
          </div>

          {/* Illustrative Estimate Footer */}
          <p className="text-xs text-[var(--text-secondary)]">
            Illustrative estimate based on placeholder assumptions.
          </p>
        </section>
      </div>
    </div>
  );
}
