import { RotateCcw } from 'lucide-react';
import {
  CONFIG,
  calculateBatteryScore,
  calculateLenderDecision,
  formatINR,
  formatIndianNumber,
  type BatteryInput,
  type StatusTone,
} from '../config/modelConfig';
import { AnimatedNumber } from './AnimatedNumber';
import { ScoreGauge } from './ScoreGauge';
import { StyledSlider } from './StyledSlider';

export interface CompareHabits {
  fastChargePct: number;
  heatAbove40CPct: number;
  deepDischargePct: number;
}

interface CompareScreenProps {
  habitsA: CompareHabits;
  habitsB: CompareHabits;
  onChangeHabitsA: (next: CompareHabits) => void;
  onChangeHabitsB: (next: CompareHabits) => void;
  onResetHabits: () => void;
  loanAmountInr?: number;
  tenureMonths?: number;
}

const VERDICT_BADGE_CLASSES: Record<StatusTone, string> = {
  good: 'bg-[var(--status-good-bg)] text-[var(--status-good)] border-[var(--status-good-border)]',
  fair: 'bg-[var(--status-fair-bg)] text-[var(--status-fair)] border-[var(--status-fair-border)]',
  poor: 'bg-[var(--status-poor-bg)] text-[var(--status-poor)] border-[var(--status-poor-border)]',
};

function buildBaselineInput(habits: CompareHabits): BatteryInput {
  return {
    vehicleType: CONFIG.COMPARE_BASELINE.vehicleType,
    chemistry: CONFIG.COMPARE_BASELINE.chemistry,
    ageMonths: CONFIG.COMPARE_BASELINE.ageMonths,
    cycles: CONFIG.COMPARE_BASELINE.cycles,
    fastChargePct: habits.fastChargePct,
    heatAbove40CPct: habits.heatAbove40CPct,
    deepDischargePct: habits.deepDischargePct,
  };
}

export function CompareScreen({
  habitsA,
  habitsB,
  onChangeHabitsA,
  onChangeHabitsB,
  onResetHabits,
  loanAmountInr = CONFIG.SLIDER_BOUNDS.loanAmountInr.default,
  tenureMonths = CONFIG.SLIDER_BOUNDS.tenureMonths.default,
}: CompareScreenProps) {
  const resultA = calculateBatteryScore(buildBaselineInput(habitsA));
  const resultB = calculateBatteryScore(buildBaselineInput(habitsB));
  const decisionA = calculateLenderDecision(resultA, loanAmountInr, tenureMonths);
  const decisionB = calculateLenderDecision(resultB, loanAmountInr, tenureMonths);

  const valueGapInr = Math.abs(resultA.residualValueInr - resultB.residualValueInr);
  const lifeGapPct = Math.abs(resultA.remainingLifePct - resultB.remainingLifePct);

  const baselineSpecsLabel = `${CONFIG.COMPARE_BASELINE.chemistry} · ${CONFIG.COMPARE_BASELINE.ageMonths} months · ~${formatIndianNumber(CONFIG.COMPARE_BASELINE.approxKm)} km · ${CONFIG.COMPARE_BASELINE.cycles} cycles`;

  const renderLoanSummary = (decision: ReturnType<typeof calculateLenderDecision>) => {
    const isDeclined =
      decision.verdict === 'Decline' ||
      decision.interestRatePct === null ||
      decision.monthlyEmiInr === null;
    const totalInterestInr =
      !isDeclined && decision.monthlyEmiInr !== null
        ? Math.max(0, decision.monthlyEmiInr * tenureMonths - loanAmountInr)
        : null;

    return (
      <div className="glass-tile p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[11px] font-medium text-[var(--text-secondary)] tabular-nums">
            Loan check ({formatINR(loanAmountInr)} · {tenureMonths} mo) · Max{' '}
            <span className="text-[var(--text-primary)] font-semibold">
              {formatINR(decision.maxLoanInr)}
            </span>
          </span>
          <span
            className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${
              VERDICT_BADGE_CLASSES[decision.verdictTone]
            }`}
          >
            {decision.verdict}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[var(--border-subtle)] text-xs">
          <div>
            <p className="text-[11px] text-[var(--text-secondary)]">Rate</p>
            <p
              className={`font-display font-semibold tabular-nums mt-0.5 ${
                isDeclined ? 'text-[var(--status-poor)]' : 'text-[var(--text-primary)]'
              }`}
            >
              {!isDeclined && decision.interestRatePct !== null
                ? `${decision.interestRatePct.toFixed(1)}% p.a.`
                : 'Not eligible'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--text-secondary)]">Monthly EMI</p>
            <p
              className={`font-display font-semibold tabular-nums mt-0.5 ${
                isDeclined ? 'text-[var(--status-poor)]' : 'text-[var(--text-primary)]'
              }`}
            >
              {!isDeclined && decision.monthlyEmiInr !== null
                ? formatINR(decision.monthlyEmiInr)
                : 'Not eligible'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--text-secondary)]">Total interest</p>
            <p
              className={`font-display font-semibold tabular-nums mt-0.5 ${
                isDeclined ? 'text-[var(--status-poor)]' : 'text-[var(--text-primary)]'
              }`}
            >
              {totalInterestInr !== null ? formatINR(totalInterestInr) : 'Not eligible'}
            </p>
          </div>
        </div>

        {isDeclined ? (
          <p className="text-[11px] text-[var(--text-secondary)] tabular-nums">
            {loanAmountInr > decision.maxLoanInr
              ? `Requested ${formatINR(loanAmountInr)} exceeds the maximum ${formatINR(decision.maxLoanInr)}`
              : 'Score below 35'}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Hero Headline */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-medium">
          Side-by-Side Habits Impact
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--text-primary)] tracking-tight text-balance">
          Same age. Same mileage. Very different batteries.
        </h1>
      </div>

      {/* Comparison Grid with Glowing VS Badge */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 lg:gap-5 items-stretch">
        {/* Scooter A */}
        <article className="glass-card glass-card-interactive p-6 space-y-5 flex flex-col justify-between">
          <div className="space-y-1">
            <h2 className="font-display text-xl font-semibold text-[var(--text-primary)]">
              {CONFIG.COMPARE_BASELINE.scooterA.title}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] tabular-nums">{baselineSpecsLabel}</p>
          </div>

          <ScoreGauge score={resultA.score} band={resultA.band} size="compact" />

          <div className="grid grid-cols-2 gap-3">
            <div className="glass-tile p-3.5">
              <p className="text-xs text-[var(--text-secondary)]">Remaining life</p>
              <p className="font-display text-xl font-semibold text-[var(--text-primary)] mt-0.5 tabular-nums">
                <AnimatedNumber value={resultA.remainingLifePct} format={(v) => `${Math.round(v)}%`} />
              </p>
            </div>
            <div className="glass-tile p-3.5">
              <p className="text-xs text-[var(--text-secondary)]">Residual value</p>
              <p className="font-display text-xl font-semibold text-[var(--text-primary)] mt-0.5 tabular-nums">
                <AnimatedNumber value={resultA.residualValueInr} format={(v) => formatINR(v)} />
              </p>
            </div>
          </div>

          {renderLoanSummary(decisionA)}

          <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
            <StyledSlider
              id="compare-a-fast"
              label="Fast-charge %"
              value={habitsA.fastChargePct}
              min={0}
              max={100}
              displayValue={`${habitsA.fastChargePct}%`}
              onChange={(val) => onChangeHabitsA({ ...habitsA, fastChargePct: val })}
              compact
            />
            <StyledSlider
              id="compare-a-heat"
              label="Heat (>40°C) %"
              value={habitsA.heatAbove40CPct}
              min={0}
              max={100}
              displayValue={`${habitsA.heatAbove40CPct}%`}
              onChange={(val) => onChangeHabitsA({ ...habitsA, heatAbove40CPct: val })}
              compact
            />
            <StyledSlider
              id="compare-a-deep"
              label="Deep-discharge %"
              value={habitsA.deepDischargePct}
              min={0}
              max={100}
              displayValue={`${habitsA.deepDischargePct}%`}
              onChange={(val) => onChangeHabitsA({ ...habitsA, deepDischargePct: val })}
              compact
            />
          </div>
        </article>

        {/* Glowing VS Badge */}
        <div className="flex items-center justify-center py-1 lg:py-0">
          <div
            aria-hidden="true"
            className="w-12 h-12 rounded-full flex items-center justify-center font-display font-bold text-sm tracking-wider cs-cta-primary select-none"
            style={{ boxShadow: 'var(--cta-shadow)' }}
          >
            VS
          </div>
        </div>

        {/* Scooter B */}
        <article className="glass-card glass-card-interactive p-6 space-y-5 flex flex-col justify-between">
          <div className="space-y-1">
            <h2 className="font-display text-xl font-semibold text-[var(--text-primary)]">
              {CONFIG.COMPARE_BASELINE.scooterB.title}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] tabular-nums">{baselineSpecsLabel}</p>
          </div>

          <ScoreGauge score={resultB.score} band={resultB.band} size="compact" />

          <div className="grid grid-cols-2 gap-3">
            <div className="glass-tile p-3.5">
              <p className="text-xs text-[var(--text-secondary)]">Remaining life</p>
              <p className="font-display text-xl font-semibold text-[var(--text-primary)] mt-0.5 tabular-nums">
                <AnimatedNumber value={resultB.remainingLifePct} format={(v) => `${Math.round(v)}%`} />
              </p>
            </div>
            <div className="glass-tile p-3.5">
              <p className="text-xs text-[var(--text-secondary)]">Residual value</p>
              <p className="font-display text-xl font-semibold text-[var(--text-primary)] mt-0.5 tabular-nums">
                <AnimatedNumber value={resultB.residualValueInr} format={(v) => formatINR(v)} />
              </p>
            </div>
          </div>

          {renderLoanSummary(decisionB)}

          <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
            <StyledSlider
              id="compare-b-fast"
              label="Fast-charge %"
              value={habitsB.fastChargePct}
              min={0}
              max={100}
              displayValue={`${habitsB.fastChargePct}%`}
              onChange={(val) => onChangeHabitsB({ ...habitsB, fastChargePct: val })}
              compact
            />
            <StyledSlider
              id="compare-b-heat"
              label="Heat (>40°C) %"
              value={habitsB.heatAbove40CPct}
              min={0}
              max={100}
              displayValue={`${habitsB.heatAbove40CPct}%`}
              onChange={(val) => onChangeHabitsB({ ...habitsB, heatAbove40CPct: val })}
              compact
            />
            <StyledSlider
              id="compare-b-deep"
              label="Deep-discharge %"
              value={habitsB.deepDischargePct}
              min={0}
              max={100}
              displayValue={`${habitsB.deepDischargePct}%`}
              onChange={(val) => onChangeHabitsB({ ...habitsB, deepDischargePct: val })}
              compact
            />
          </div>
        </article>
      </div>

      {/* Live Delta Strip */}
      <div className="glass-card px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-sm sm:text-base font-display font-semibold text-[var(--text-primary)] tabular-nums">
          <span>
            Value gap:{' '}
            <span className="text-[var(--accent-mint)]">
              <AnimatedNumber value={valueGapInr} format={(v) => formatINR(v)} />
            </span>
          </span>
          <span aria-hidden="true" className="text-[var(--text-secondary)]">
            |
          </span>
          <span>
            Life gap:{' '}
            <span className="text-[var(--accent-cyan)]">
              <AnimatedNumber value={lifeGapPct} format={(v) => `${Math.round(v)}%`} />
            </span>
          </span>
        </div>

        {/* Single primary action on Compare screen */}
        <button
          type="button"
          onClick={onResetHabits}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--surface-control)] border border-[var(--border-control)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-control-hover)] transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Reset defaults</span>
        </button>
      </div>
    </div>
  );
}
