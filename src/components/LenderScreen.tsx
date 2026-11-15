import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  FileText,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import {
  CONFIG,
  calculateBatteryScore,
  calculateLenderDecision,
  formatINR,
  type BatteryInput,
  type StatusTone,
} from '../config/modelConfig';
import { AnimatedNumber } from './AnimatedNumber';
import { CertificateModal } from './CertificateModal';
import type { ScoreInputSource } from './ScoreScreen';
import { StyledSlider } from './StyledSlider';

export type LenderBatteryKey = 'scooter-a' | 'scooter-b' | 'custom';

interface LenderScreenProps {
  selectedBatteryKey: LenderBatteryKey;
  onSelectBatteryKey: (key: LenderBatteryKey) => void;
  scooterAInput: BatteryInput;
  scooterBInput: BatteryInput;
  customInput: BatteryInput;
  customInputSource?: ScoreInputSource;
  loanAmountInr: number;
  tenureMonths: number;
  onChangeLoanAmount: (val: number) => void;
  onChangeTenure: (val: number) => void;
}

const VERDICT_STYLES: Record<
  StatusTone,
  { container: string; badge: string; text: string }
> = {
  good: {
    container: 'bg-[var(--status-good-bg)] border-[var(--status-good-border)]',
    badge: 'text-[var(--status-good)]',
    text: 'text-[var(--text-primary)]',
  },
  fair: {
    container: 'bg-[var(--status-fair-bg)] border-[var(--status-fair-border)]',
    badge: 'text-[var(--status-fair)]',
    text: 'text-[var(--text-primary)]',
  },
  poor: {
    container: 'bg-[var(--status-poor-bg)] border-[var(--status-poor-border)]',
    badge: 'text-[var(--status-poor)]',
    text: 'text-[var(--text-primary)]',
  },
};

const BAND_PILL_STYLES: Record<StatusTone, string> = {
  good: 'bg-[var(--status-good-bg)] text-[var(--status-good)] border-[var(--status-good-border)]',
  fair: 'bg-[var(--status-fair-bg)] text-[var(--status-fair)] border-[var(--status-fair-border)]',
  poor: 'bg-[var(--status-poor-bg)] text-[var(--status-poor)] border-[var(--status-poor-border)]',
};

function computePassportId(key: LenderBatteryKey, input: BatteryInput, score: number): string {
  if (key === 'scooter-a') return `${CONFIG.PASSPORT_PREFIX}-0001`;
  if (key === 'scooter-b') return `${CONFIG.PASSPORT_PREFIX}-0002`;
  const seed =
    (input.vehicleType === '2W' ? 2 : 3) * 1009 +
    (input.chemistry === 'LFP' ? 17 : 31) +
    input.ageMonths * 13 +
    input.cycles * 3 +
    input.fastChargePct * 7 +
    input.heatAbove40CPct * 11 +
    score * 5;
  const num = String((seed % 8999) + 1000);
  return `${CONFIG.PASSPORT_PREFIX}-${num}`;
}

export function LenderScreen({
  selectedBatteryKey,
  onSelectBatteryKey,
  scooterAInput,
  scooterBInput,
  customInput,
  customInputSource = 'Manual',
  loanAmountInr,
  tenureMonths,
  onChangeLoanAmount,
  onChangeTenure,
}: LenderScreenProps) {
  const [copied, setCopied] = useState(false);
  const [certOpen, setCertOpen] = useState(false);

  const activeInput =
    selectedBatteryKey === 'scooter-a'
      ? scooterAInput
      : selectedBatteryKey === 'scooter-b'
        ? scooterBInput
        : customInput;

  const scoreResult = calculateBatteryScore(activeInput);
  const decision = calculateLenderDecision(scoreResult, loanAmountInr, tenureMonths);
  const passportId = computePassportId(selectedBatteryKey, activeInput, scoreResult.score);

  const passportUrl = useMemo(() => {
    if (typeof window === 'undefined') return `https://cellscore.in/?passport=${passportId}`;
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('tab', 'lender');
    url.searchParams.set('battery', selectedBatteryKey);
    url.searchParams.set('loan', String(loanAmountInr));
    url.searchParams.set('tenure', String(tenureMonths));
    if (selectedBatteryKey === 'custom') {
      url.searchParams.set('vt', activeInput.vehicleType);
      url.searchParams.set('chem', activeInput.chemistry);
      url.searchParams.set('age', String(activeInput.ageMonths));
      url.searchParams.set('cyc', String(activeInput.cycles));
      url.searchParams.set('fast', String(activeInput.fastChargePct));
      url.searchParams.set('heat', String(activeInput.heatAbove40CPct));
      url.searchParams.set('deep', String(activeInput.deepDischargePct));
    }
    return url.toString();
  }, [selectedBatteryKey, loanAmountInr, tenureMonths, activeInput, passportId]);

  const qrMatrix = useMemo(() => {
    try {
      const qr = QRCode.create(passportUrl, { errorCorrectionLevel: 'M' });
      return {
        size: qr.modules.size,
        data: qr.modules.data,
      };
    } catch {
      return null;
    }
  }, [passportUrl]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(passportUrl);
      setCopied(true);
    } catch {
      // Fallback copy via textarea if clipboard permission is blocked
      const el = document.createElement('textarea');
      el.value = passportUrl;
      el.setAttribute('readonly', '');
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
    }
  };

  const verdictStyle = VERDICT_STYLES[decision.verdictTone];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Underwriting Inputs & Verdict */}
      <section
        aria-label="Loan underwriting"
        className="lg:col-span-7 glass-card p-6 sm:p-8 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-medium">
              Credit & Risk Desk
            </p>
            <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] mt-1">
              Lender Underwriting
            </h1>
          </div>

          {/* Battery Selector */}
          <div className="relative min-w-[220px]">
            <label htmlFor="lender-battery-select" className="sr-only">
              Select battery
            </label>
            <select
              id="lender-battery-select"
              value={selectedBatteryKey}
              onChange={(e) => onSelectBatteryKey(e.target.value as LenderBatteryKey)}
              className="cs-select w-full h-10 pl-3.5 pr-9 rounded-xl bg-[var(--surface-control)] border border-[var(--border-control)] text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60 transition-colors cursor-pointer"
            >
              <option value="scooter-a" className="bg-[var(--bg-select-option)] text-[var(--text-primary)]">
                Scooter A: Gentle commuter
              </option>
              <option value="scooter-b" className="bg-[var(--bg-select-option)] text-[var(--text-primary)]">
                Scooter B: Hard-use delivery
              </option>
              <option value="custom" className="bg-[var(--bg-select-option)] text-[var(--text-primary)]">
                Custom (from Score)
              </option>
            </select>
            <ChevronDown
              aria-hidden="true"
              className="w-4 h-4 text-[var(--text-secondary)] pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
            />
          </div>
        </div>

        {/* Sliders */}
        <div className="space-y-4">
          <StyledSlider
            id="lender-loan-amount"
            label="Loan amount"
            value={loanAmountInr}
            min={CONFIG.SLIDER_BOUNDS.loanAmountInr.min}
            max={CONFIG.SLIDER_BOUNDS.loanAmountInr.max}
            step={CONFIG.SLIDER_BOUNDS.loanAmountInr.step}
            displayValue={formatINR(loanAmountInr)}
            onChange={onChangeLoanAmount}
          />
          <StyledSlider
            id="lender-tenure"
            label="Tenure"
            value={tenureMonths}
            min={CONFIG.SLIDER_BOUNDS.tenureMonths.min}
            max={CONFIG.SLIDER_BOUNDS.tenureMonths.max}
            step={CONFIG.SLIDER_BOUNDS.tenureMonths.step}
            displayValue={`${tenureMonths} months`}
            onChange={onChangeTenure}
          />
        </div>

        {/* Verdict Banner */}
        <div
          role="status"
          aria-live="polite"
          className={`rounded-2xl border p-4 sm:p-5 flex items-start gap-3.5 transition-colors duration-200 ${verdictStyle.container}`}
        >
          <div className={`mt-0.5 shrink-0 ${verdictStyle.badge}`}>
            {decision.verdict === 'Approve' ? (
              <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
            ) : decision.verdict === 'Approve with conditions' ? (
              <AlertTriangle className="w-5 h-5" aria-hidden="true" />
            ) : (
              <XCircle className="w-5 h-5" aria-hidden="true" />
            )}
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-display text-lg font-semibold ${verdictStyle.badge}`}>
                {decision.verdict}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-primary)]/90 leading-relaxed">
              {decision.verdictReason}
            </p>
          </div>
        </div>

        {/* 4 Underwriting Output Tiles */}
        <div className="grid grid-cols-2 gap-3.5">
          <div className="glass-tile p-4">
            <p className="text-xs text-[var(--text-secondary)]">Max loan allowed</p>
            <p className="font-display text-xl sm:text-2xl font-semibold text-[var(--text-primary)] mt-1 tabular-nums">
              <AnimatedNumber value={decision.maxLoanInr} format={(v) => formatINR(v)} />
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1 tabular-nums">
              {scoreResult.band.ltvPct}% LTV × {formatINR(scoreResult.residualValueInr)}
            </p>
          </div>

          <div className="glass-tile p-4">
            <p className="text-xs text-[var(--text-secondary)]">Interest rate</p>
            <p
              className={`font-display text-xl sm:text-2xl font-semibold mt-1 tabular-nums ${
                decision.verdict === 'Decline' || decision.interestRatePct === null
                  ? 'text-[var(--status-poor)]'
                  : 'text-[var(--text-primary)]'
              }`}
            >
              {decision.verdict !== 'Decline' && decision.interestRatePct !== null
                ? `${decision.interestRatePct.toFixed(1)}% p.a.`
                : 'Not eligible'}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1 tabular-nums">
              {decision.verdict !== 'Decline' && scoreResult.band.rateSpreadPct !== null
                ? `${CONFIG.BASE_INTEREST_RATE_PCT}% base + ${scoreResult.band.rateSpreadPct}% band`
                : loanAmountInr > decision.maxLoanInr
                  ? `Requested ${formatINR(loanAmountInr)} exceeds the maximum ${formatINR(decision.maxLoanInr)}`
                  : 'Score below 35'}
            </p>
          </div>

          <div className="glass-tile p-4">
            <p className="text-xs text-[var(--text-secondary)]">Monthly EMI</p>
            <p
              className={`font-display text-xl sm:text-2xl font-semibold mt-1 tabular-nums ${
                decision.verdict === 'Decline' || decision.monthlyEmiInr === null
                  ? 'text-[var(--status-poor)]'
                  : 'text-[var(--text-primary)]'
              }`}
            >
              {decision.verdict !== 'Decline' && decision.monthlyEmiInr !== null ? (
                <AnimatedNumber value={decision.monthlyEmiInr} format={(v) => formatINR(v)} />
              ) : (
                'Not eligible'
              )}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1 tabular-nums">
              {decision.verdict !== 'Decline' && decision.monthlyEmiInr !== null
                ? `Over ${tenureMonths} months`
                : loanAmountInr > decision.maxLoanInr
                  ? `Requested ${formatINR(loanAmountInr)} exceeds the maximum ${formatINR(decision.maxLoanInr)}`
                  : 'Score below 35'}
            </p>
          </div>

          <div className="glass-tile p-4">
            <p className="text-xs text-[var(--text-secondary)]">Insurance flag</p>
            <p
              className={`font-display text-lg sm:text-xl font-semibold mt-1 inline-flex items-center gap-1.5 ${
                decision.insuranceFlag === 'Standard'
                  ? 'text-[var(--status-good)]'
                  : decision.insuranceFlag === 'Surcharge'
                    ? 'text-[var(--status-fair)]'
                    : 'text-[var(--status-poor)]'
              }`}
            >
              {decision.insuranceFlag === 'Inspection required' ? (
                <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
              ) : null}
              <span>{decision.insuranceFlag}</span>
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {scoreResult.band.label} · {scoreResult.band.tierName}
            </p>
          </div>
        </div>
      </section>

      {/* Right Column: Battery Passport Card */}
      <aside
        aria-label="Battery Passport"
        className="lg:col-span-5 glass-card p-6 sm:p-8 space-y-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-medium">
              Battery Passport (sample)
            </p>
            <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)] mt-1">
              Battery Passport
            </h2>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold whitespace-nowrap ${
              BAND_PILL_STYLES[scoreResult.band.tone]
            }`}
          >
            {scoreResult.band.label} · {scoreResult.band.tierName}
          </span>
        </div>

        {/* Passport Core Block */}
        <div className="glass-tile p-5 flex items-center justify-between gap-4">
          <div className="space-y-3 min-w-0">
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Passport ID</p>
              <p className="font-display text-lg font-semibold text-[var(--text-primary)] tracking-wide tabular-nums">
                {passportId}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs text-[var(--text-secondary)]">Score</p>
                <p className="font-display text-2xl font-bold text-[var(--text-primary)] tabular-nums">
                  <AnimatedNumber value={scoreResult.score} />
                  <span className="text-xs font-normal text-[var(--text-secondary)] ml-1">/ 100</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)]">Issued</p>
                <p className="text-sm font-medium text-[var(--text-primary)] mt-1">
                  {CONFIG.MODEL_DISPLAY_DATE}
                </p>
              </div>
            </div>
          </div>

          {/* Crisp SVG QR Code (always high-contrast light quiet zone for scannability) */}
          {qrMatrix ? (
            <div
              className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[var(--border-glass)] shrink-0"
              aria-label={`QR code for Battery Passport ${passportId}`}
            >
              <svg
                width={92}
                height={92}
                viewBox={`0 0 ${qrMatrix.size} ${qrMatrix.size}`}
                shapeRendering="crispEdges"
                role="img"
                aria-label="Battery Passport QR Code"
              >
                <rect width={qrMatrix.size} height={qrMatrix.size} fill="#FFFFFF" />
                {Array.from({ length: qrMatrix.size }).map((_, row) =>
                  Array.from({ length: qrMatrix.size }).map((__, col) => {
                    const isDark = qrMatrix.data[row * qrMatrix.size + col];
                    if (!isDark) return null;
                    return (
                      <rect
                        key={`${row}-${col}`}
                        x={col}
                        y={row}
                        width={1}
                        height={1}
                        fill="#07090D"
                      />
                    );
                  }),
                )}
              </svg>
            </div>
          ) : null}
        </div>

        {/* Compact Pack Summary */}
        <div className="space-y-2.5 text-xs">
          <div className="flex items-center justify-between py-1.5 border-b border-[var(--border-subtle)]">
            <span className="text-[var(--text-secondary)]">Pack specification</span>
            <span className="text-[var(--text-primary)] font-medium tabular-nums">
              {activeInput.vehicleType === '2W' ? '2-Wheeler' : '3-Wheeler'} · {activeInput.chemistry}
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-[var(--border-subtle)]">
            <span className="text-[var(--text-secondary)]">Age & cycling</span>
            <span className="text-[var(--text-primary)] font-medium tabular-nums">
              {activeInput.ageMonths} mo · {activeInput.cycles} cycles
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[var(--text-secondary)]">Estimated residual value</span>
            <span className="text-[var(--text-primary)] font-semibold font-display tabular-nums">
              {formatINR(scoreResult.residualValueInr)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full h-11 px-5 rounded-xl cs-cta-primary font-display font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.99] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)] cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" aria-hidden="true" />
                <span>Copied passport link</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" aria-hidden="true" />
                <span>Copy link</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setCertOpen(true)}
            className="w-full h-10 px-5 rounded-xl bg-[var(--surface-control)] border border-[var(--border-control)] text-[var(--text-primary)] font-display font-semibold text-xs flex items-center justify-center gap-2 hover:bg-[var(--surface-control-hover)] hover:border-[var(--border-strong)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-[var(--accent-mint)]" aria-hidden="true" />
            <span>Generate certificate</span>
          </button>
        </div>
      </aside>

      <CertificateModal
        open={certOpen}
        onClose={() => setCertOpen(false)}
        input={activeInput}
        result={scoreResult}
        dataSource={selectedBatteryKey === 'custom' ? customInputSource : 'Sample'}
      />
    </div>
  );
}
