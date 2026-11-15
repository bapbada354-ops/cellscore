import { useEffect } from 'react';
import { X } from 'lucide-react';
import { CONFIG, formatINR, formatIndianNumber } from '../config/modelConfig';

interface AssumptionsModalProps {
  open: boolean;
  onClose: () => void;
}

export function AssumptionsModal({ open, onClose }: AssumptionsModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg-backdrop)] backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assumptions-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden rounded-[20px] border border-[var(--border-strong)] bg-[var(--bg-elevated)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-[var(--border-glass)]">
          <div>
            <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--status-fair)] font-medium">
              Placeholder Assumptions
            </p>
            <h2
              id="assumptions-modal-title"
              className="font-display text-xl font-semibold text-[var(--text-primary)] mt-1"
            >
              Model Configuration (CONFIG)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close assumptions modal"
            className="w-9 h-9 rounded-xl bg-[var(--surface-control)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-control-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Every parameter below lives in a single editable{' '}
            <code className="text-[var(--text-primary)]">CONFIG</code> object and is a placeholder
            assumption pending validation on field battery telemetry.
          </p>

          {/* Cycle Life & Calendar Fade */}
          <div className="space-y-2.5">
            <h3 className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-medium">
              Chemistry & Calendar Fade
            </h3>
            <div className="glass-tile divide-y divide-[var(--border-subtle)]">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[var(--text-secondary)]">Rated cycle life (LFP)</span>
                <span className="font-display font-semibold text-[var(--text-primary)] tabular-nums">
                  {formatIndianNumber(CONFIG.RATED_CYCLE_LIFE.LFP)} cycles
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[var(--text-secondary)]">Rated cycle life (NMC)</span>
                <span className="font-display font-semibold text-[var(--text-primary)] tabular-nums">
                  {formatIndianNumber(CONFIG.RATED_CYCLE_LIFE.NMC)} cycles
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[var(--text-secondary)]">Calendar fade per month</span>
                <span className="font-display font-semibold text-[var(--text-primary)] tabular-nums">
                  {(CONFIG.CALENDAR_FADE_PER_MONTH * 100).toFixed(2)}% ({CONFIG.CALENDAR_FADE_PER_MONTH})
                </span>
              </div>
            </div>
          </div>

          {/* Penalty Weights */}
          <div className="space-y-2.5">
            <h3 className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-medium">
              Stress Penalty Weights
            </h3>
            <div className="glass-tile divide-y divide-[var(--border-subtle)]">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[var(--text-secondary)]">Time above 40°C weight</span>
                <span className="font-display font-semibold text-[var(--text-primary)] tabular-nums">
                  {CONFIG.PENALTY_WEIGHTS.heatAbove40C.toFixed(1)}×
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[var(--text-secondary)]">Fast-charge share weight</span>
                <span className="font-display font-semibold text-[var(--text-primary)] tabular-nums">
                  {CONFIG.PENALTY_WEIGHTS.fastCharge.toFixed(1)}×
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[var(--text-secondary)]">Deep-discharge share weight</span>
                <span className="font-display font-semibold text-[var(--text-primary)] tabular-nums">
                  {CONFIG.PENALTY_WEIGHTS.deepDischarge.toFixed(1)}×
                </span>
              </div>
            </div>
          </div>

          {/* Pack Prices & Residual Multiplier */}
          <div className="space-y-2.5">
            <h3 className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-medium">
              Pack Valuation
            </h3>
            <div className="glass-tile divide-y divide-[var(--border-subtle)]">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[var(--text-secondary)]">New 2-Wheeler pack price</span>
                <span className="font-display font-semibold text-[var(--text-primary)] tabular-nums">
                  {formatINR(CONFIG.NEW_PACK_PRICE_INR['2W'])}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[var(--text-secondary)]">New 3-Wheeler pack price</span>
                <span className="font-display font-semibold text-[var(--text-primary)] tabular-nums">
                  {formatINR(CONFIG.NEW_PACK_PRICE_INR['3W'])}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[var(--text-secondary)]">Residual value multiplier</span>
                <span className="font-display font-semibold text-[var(--text-primary)] tabular-nums">
                  {CONFIG.RESIDUAL_VALUE_FACTOR}× remaining life
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[var(--text-secondary)]">Base interest rate</span>
                <span className="font-display font-semibold text-[var(--text-primary)] tabular-nums">
                  {CONFIG.BASE_INTEREST_RATE_PCT}% p.a.
                </span>
              </div>
            </div>
          </div>

          {/* Vehicle Price Check (Placeholder Assumptions) */}
          <div className="space-y-2.5">
            <h3 className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-medium">
              Vehicle Price Check (Placeholder Assumptions)
            </h3>
            <div className="glass-tile divide-y divide-[var(--border-subtle)]">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[var(--text-secondary)]">2-Wheeler price (excl. battery pack)</span>
                <span className="font-display font-semibold text-[var(--text-primary)] tabular-nums">
                  {formatINR(CONFIG.VEHICLE_PRICE_EXCL_PACK_INR['2W'])}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[var(--text-secondary)]">3-Wheeler price (excl. battery pack)</span>
                <span className="font-display font-semibold text-[var(--text-primary)] tabular-nums">
                  {formatINR(CONFIG.VEHICLE_PRICE_EXCL_PACK_INR['3W'])}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[var(--text-secondary)]">Body depreciation rate</span>
                <span className="font-display font-semibold text-[var(--text-primary)] tabular-nums">
                  {Math.round(CONFIG.BODY_DEPRECIATION_PER_YEAR * 100)}% per year
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[var(--text-secondary)]">Fair-price band</span>
                <span className="font-display font-semibold text-[var(--text-primary)] tabular-nums">
                  ±{Math.round(CONFIG.FAIR_PRICE_BAND_PCT * 100)}% around fair value
                </span>
              </div>
            </div>
          </div>

          {/* Credit Bands */}
          <div className="space-y-2.5">
            <h3 className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-medium">
              Credit Bands & Underwriting Rules
            </h3>
            <div className="glass-tile divide-y divide-[var(--border-subtle)]">
              {Object.values(CONFIG.BANDS).map((b) => (
                <div
                  key={b.key}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs"
                >
                  <span className="font-medium text-[var(--text-primary)]">
                    {b.label} ({b.minScore}–{b.maxScore})
                  </span>
                  <span className="text-[var(--text-secondary)] tabular-nums">
                    LTV {b.ltvPct}% ·{' '}
                    {b.rateSpreadPct !== null ? `+${b.rateSpreadPct}% rate` : 'Decline'} ·{' '}
                    {b.insuranceFlag}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
