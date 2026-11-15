import { useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  ThermometerSun,
} from 'lucide-react';
import type { ClimateLocationReading } from '../config/assistantEngine';
import {
  CONFIG,
  calculateBatteryScore,
  formatINR,
  formatIndianNumber,
  type BatteryInput,
  type Chemistry,
  type StatusTone,
  type VehicleType,
} from '../config/modelConfig';
import {
  fetchClimateLocationReading,
  getBrowserCoordinates,
} from '../utils/climateClient';
import { AnimatedNumber } from './AnimatedNumber';
import { CertificateModal } from './CertificateModal';
import { ScoreGauge } from './ScoreGauge';
import { StyledSlider } from './StyledSlider';

export type ScoreInputSource = 'Manual' | 'From log' | 'Sample';

interface ScoreScreenProps {
  input: BatteryInput;
  selectedSampleId: string;
  inputSource: ScoreInputSource;
  onChangeInput: (next: BatteryInput) => void;
  onSelectSample: (sampleId: string) => void;
  onEvaluateInLender: () => void;
  climateReading: ClimateLocationReading | null;
  onClimateReadingChange: (reading: ClimateLocationReading | null) => void;
  aiConfigured?: boolean;
}

const BAR_TONE_CLASS: Record<StatusTone, string> = {
  good: 'bg-[var(--status-good)]',
  fair: 'bg-[var(--status-fair)]',
  poor: 'bg-[var(--status-poor)]',
};

const TEXT_TONE_CLASS: Record<StatusTone, string> = {
  good: 'text-[var(--status-good)]',
  fair: 'text-[var(--status-fair)]',
  poor: 'text-[var(--status-poor)]',
};

export function ScoreScreen({
  input,
  selectedSampleId,
  inputSource,
  onChangeInput,
  onSelectSample,
  onEvaluateInLender,
  climateReading,
  onClimateReadingChange,
  aiConfigured = false,
}: ScoreScreenProps) {
  const [certOpen, setCertOpen] = useState(false);
  const [cityInput, setCityInput] = useState('');
  const [climateLoading, setClimateLoading] = useState(false);
  const [climateError, setClimateError] = useState<string | null>(null);
  const result = calculateBatteryScore(input);

  const updateField = <K extends keyof BatteryInput>(key: K, value: BatteryInput[K]) => {
    onChangeInput({ ...input, [key]: value });
  };

  const handleCheckGpsClimate = async () => {
    setClimateLoading(true);
    setClimateError(null);
    try {
      const coords = await getBrowserCoordinates();
      const reading = await fetchClimateLocationReading({
        latitude: coords.latitude,
        longitude: coords.longitude,
        vehicleType: input.vehicleType,
        chemistry: input.chemistry,
      });
      onClimateReadingChange(reading);
    } catch (err) {
      setClimateError(
        err instanceof Error ? err.message : 'Unable to determine local climate reading.',
      );
    } finally {
      setClimateLoading(false);
    }
  };

  const handleCheckCityClimate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = cityInput.trim();
    if (!trimmed || climateLoading) return;
    setClimateLoading(true);
    setClimateError(null);
    try {
      const reading = await fetchClimateLocationReading({
        locationQuery: trimmed,
        vehicleType: input.vehicleType,
        chemistry: input.chemistry,
      });
      onClimateReadingChange(reading);
    } catch (err) {
      setClimateError(
        err instanceof Error ? err.message : 'Unable to check climate for that city.',
      );
    } finally {
      setClimateLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Panel: Telemetry & Usage Inputs */}
      <section
        aria-label="Battery parameters"
        className="lg:col-span-6 glass-card p-6 sm:p-8 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-medium">
              Pack Profile
            </p>
            <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] mt-1">
              Battery Inputs
            </h1>
          </div>

          {/* Load Sample Dropdown */}
          <div className="relative min-w-[210px]">
            <label htmlFor="sample-select" className="sr-only">
              Load sample battery
            </label>
            <select
              id="sample-select"
              value={selectedSampleId}
              onChange={(e) => onSelectSample(e.target.value)}
              className="cs-select w-full h-10 pl-3.5 pr-9 rounded-xl bg-[var(--surface-control)] border border-[var(--border-control)] text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60 transition-colors cursor-pointer"
            >
              <option value="custom" className="bg-[var(--bg-select-option)] text-[var(--text-secondary)]">
                Load sample...
              </option>
              {CONFIG.SAMPLE_BATTERIES.map((sample) => (
                <option
                  key={sample.id}
                  value={sample.id}
                  className="bg-[var(--bg-select-option)] text-[var(--text-primary)]"
                >
                  {sample.name}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden="true"
              className="w-4 h-4 text-[var(--text-secondary)] pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
            />
          </div>
        </div>

        {/* Segmented Controls: Vehicle Type & Chemistry */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <span className="block text-xs font-medium text-[var(--text-secondary)]">Vehicle Type</span>
            <div
              role="group"
              aria-label="Vehicle type"
              className="grid grid-cols-2 p-1 rounded-xl bg-[var(--surface-glass)] border border-[var(--border-glass)]"
            >
              {(['2W', '3W'] as VehicleType[]).map((vt) => {
                const active = input.vehicleType === vt;
                return (
                  <button
                    key={vt}
                    type="button"
                    onClick={() => updateField('vehicleType', vt)}
                    className={`h-9 rounded-lg text-xs font-semibold transition-all duration-200 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60 cursor-pointer ${
                      active
                        ? 'cs-seg-active border shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
                    }`}
                  >
                    {vt === '2W' ? '2-Wheeler' : '3-Wheeler'}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-medium text-[var(--text-secondary)]">Cell Chemistry</span>
            <div
              role="group"
              aria-label="Cell chemistry"
              className="grid grid-cols-2 p-1 rounded-xl bg-[var(--surface-glass)] border border-[var(--border-glass)]"
            >
              {(['LFP', 'NMC'] as Chemistry[]).map((chem) => {
                const active = input.chemistry === chem;
                return (
                  <button
                    key={chem}
                    type="button"
                    onClick={() => updateField('chemistry', chem)}
                    className={`h-9 rounded-lg text-xs font-semibold transition-all duration-200 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60 cursor-pointer ${
                      active
                        ? 'cs-seg-active border shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
                    }`}
                  >
                    {chem}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sliders */}
        <div className="space-y-4 pt-1">
          <StyledSlider
            id="score-age"
            label="Battery age"
            value={input.ageMonths}
            min={CONFIG.SLIDER_BOUNDS.ageMonths.min}
            max={CONFIG.SLIDER_BOUNDS.ageMonths.max}
            step={CONFIG.SLIDER_BOUNDS.ageMonths.step}
            displayValue={`${input.ageMonths} mo`}
            onChange={(val) => updateField('ageMonths', val)}
          />
          <StyledSlider
            id="score-cycles"
            label="Charge cycles"
            value={input.cycles}
            min={CONFIG.SLIDER_BOUNDS.cycles.min}
            max={CONFIG.SLIDER_BOUNDS.cycles.max}
            step={CONFIG.SLIDER_BOUNDS.cycles.step}
            displayValue={formatIndianNumber(input.cycles)}
            onChange={(val) => updateField('cycles', val)}
          />
          <StyledSlider
            id="score-fast"
            label="Fast-charge share"
            value={input.fastChargePct}
            min={CONFIG.SLIDER_BOUNDS.sharePct.min}
            max={CONFIG.SLIDER_BOUNDS.sharePct.max}
            step={CONFIG.SLIDER_BOUNDS.sharePct.step}
            displayValue={`${input.fastChargePct}%`}
            onChange={(val) => updateField('fastChargePct', val)}
          />
          <StyledSlider
            id="score-heat"
            label="Time above 40°C"
            value={input.heatAbove40CPct}
            min={CONFIG.SLIDER_BOUNDS.sharePct.min}
            max={CONFIG.SLIDER_BOUNDS.sharePct.max}
            step={CONFIG.SLIDER_BOUNDS.sharePct.step}
            displayValue={`${input.heatAbove40CPct}%`}
            onChange={(val) => updateField('heatAbove40CPct', val)}
          />
          <StyledSlider
            id="score-deep"
            label="Deep-discharge share"
            value={input.deepDischargePct}
            min={CONFIG.SLIDER_BOUNDS.sharePct.min}
            max={CONFIG.SLIDER_BOUNDS.sharePct.max}
            step={CONFIG.SLIDER_BOUNDS.sharePct.step}
            displayValue={`${input.deepDischargePct}%`}
            onChange={(val) => updateField('deepDischargePct', val)}
          />
        </div>

        {/* Google Maps Climate & Charging Calibration (rendered only when server AI health check passes) */}
        {aiConfigured ? (
          <div className="glass-tile p-4 space-y-3 border border-[var(--border-control)]">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <ThermometerSun
                  className="w-4 h-4 text-[var(--accent-cyan)] shrink-0"
                  aria-hidden="true"
                />
                <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-primary)]">
                  Local Climate &amp; Charging Calibration
                </h2>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Share your location so Google Maps data can judge ambient temperature and heat
                stress for a sharper charging reading.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleCheckGpsClimate}
              disabled={climateLoading}
              className="h-9 px-3.5 rounded-xl bg-[var(--surface-control)] border border-[var(--border-control)] hover:border-[var(--accent-cyan)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cyan)]/60"
            >
              {climateLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent-cyan)]" aria-hidden="true" />
              ) : (
                <MapPin className="w-3.5 h-3.5 text-[var(--accent-cyan)]" aria-hidden="true" />
              )}
              <span>Use my location</span>
            </button>

            <form onSubmit={handleCheckCityClimate} className="flex-1 flex items-center gap-2">
              <label htmlFor="score-city-input" className="sr-only">
                Or enter city or area
              </label>
              <input
                id="score-city-input"
                type="text"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                placeholder="Or enter city (e.g., Nagpur, Bengaluru)"
                disabled={climateLoading}
                className="flex-1 min-w-0 h-9 px-3 rounded-xl bg-[var(--surface-control)] border border-[var(--border-control)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cyan)]/60 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={climateLoading || !cityInput.trim()}
                className="h-9 px-3 rounded-xl bg-[var(--status-cyan-bg)] border border-[var(--status-cyan-border)] text-xs font-semibold text-[var(--accent-cyan)] hover:opacity-90 transition-opacity whitespace-nowrap cursor-pointer disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cyan)]/60"
              >
                Check
              </button>
            </form>
          </div>

          {climateError ? (
            <p className="text-xs text-[var(--status-poor)] bg-[var(--status-poor-bg)] border border-[var(--status-poor-border)] rounded-lg px-3 py-2">
              {climateError}
            </p>
          ) : null}

          {climateReading ? (
            <div className="pt-2 border-t border-[var(--border-glass)] space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-[var(--text-primary)]">
                    {climateReading.locationName}
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {climateReading.climateProfile} · Peak {climateReading.peakTempRangeC}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateField('heatAbove40CPct', climateReading.suggestedHeatPct)}
                  className="px-3 py-1.5 rounded-lg bg-[var(--status-good-bg)] border border-[var(--status-good-border)] text-[11px] font-semibold text-[var(--status-good)] hover:opacity-90 transition-opacity cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60"
                >
                  Apply {climateReading.suggestedHeatPct}% to Time &gt;40°C
                </button>
              </div>

              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {climateReading.summary}
              </p>

              {climateReading.chargingAdvice ? (
                <p className="text-[11px] text-[var(--text-primary)] bg-[var(--surface-control)] border border-[var(--border-glass)] rounded-lg px-2.5 py-2">
                  <span className="font-semibold text-[var(--accent-mint)]">Charging note: </span>
                  {climateReading.chargingAdvice}
                </p>
              ) : null}

              {climateReading.mapLinks.length > 0 ? (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--text-secondary)]">
                    Google Maps Grounding Sources
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {climateReading.mapLinks.map((link) => (
                      <a
                        key={link.uri}
                        href={link.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--surface-control)] border border-[var(--border-control)] text-[11px] font-medium text-[var(--accent-cyan)] hover:border-[var(--accent-cyan)] transition-colors"
                      >
                        <span>{link.title}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                      </a>
                    ))}
                  </div>
                  {climateReading.mapLinks.some((l) => l.snippets.length > 0) ? (
                    <ul className="space-y-1 pt-0.5">
                      {climateReading.mapLinks
                        .flatMap((l) => l.snippets)
                        .slice(0, 3)
                        .map((snip, idx) => (
                          <li key={`${snip.text}-${idx}`} className="text-[11px] text-[var(--text-secondary)]">
                            {snip.uri ? (
                              <a
                                href={snip.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline underline-offset-2 hover:text-[var(--accent-cyan)]"
                              >
                                &ldquo;{snip.text}&rdquo;
                              </a>
                            ) : (
                              <span>&ldquo;{snip.text}&rdquo;</span>
                            )}
                          </li>
                        ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          </div>
        ) : null}
      </section>

      {/* Right Panel: Live Battery Score & Breakdown */}
      <section
        aria-label="Battery score results"
        className="lg:col-span-6 glass-card p-6 sm:p-8 space-y-6"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-medium">
            Health & Valuation
          </p>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${
                inputSource === 'From log'
                  ? 'bg-[var(--status-good-bg)] text-[var(--status-good)] border-[var(--status-good-border)]'
                  : inputSource === 'Sample'
                    ? 'bg-[var(--status-cyan-bg)] text-[var(--accent-cyan)] border-[var(--status-cyan-border)]'
                    : 'bg-[var(--surface-control)] text-[var(--text-secondary)] border-[var(--border-control)]'
              }`}
            >
              {inputSource}
            </span>
            <span className="text-xs text-[var(--text-secondary)] tabular-nums">
              {input.vehicleType === '2W' ? '2-Wheeler' : '3-Wheeler'} · {input.chemistry} (
              {formatIndianNumber(result.ratedCycleLife)} cycles rated)
            </span>
          </div>
        </div>

        {/* Circular SVG Gauge */}
        <ScoreGauge score={result.score} band={result.band} size="hero" />

        {/* Three Stat Tiles */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-tile p-3.5 sm:p-4">
            <p className="text-xs text-[var(--text-secondary)]">Remaining life</p>
            <p className="font-display text-xl sm:text-2xl font-semibold text-[var(--text-primary)] mt-1 tabular-nums">
              <AnimatedNumber value={result.remainingLifePct} format={(v) => `${Math.round(v)}%`} />
            </p>
          </div>
          <div className="glass-tile p-3.5 sm:p-4">
            <p className="text-xs text-[var(--text-secondary)]">Residual value</p>
            <p className="font-display text-xl sm:text-2xl font-semibold text-[var(--text-primary)] mt-1 tabular-nums">
              <AnimatedNumber value={result.residualValueInr} format={(v) => formatINR(v)} />
            </p>
          </div>
          <div className="glass-tile p-3.5 sm:p-4">
            <p className="text-xs text-[var(--text-secondary)]">Loan-to-value</p>
            <p className="font-display text-xl sm:text-2xl font-semibold text-[var(--text-primary)] mt-1 tabular-nums">
              {result.band.ltvPct}%
            </p>
          </div>
        </div>

        {/* What's hurting this battery */}
        <div className="space-y-3 pt-1">
          <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-medium">
            What&apos;s hurting this battery
          </p>
          <div className="space-y-3">
            {result.stressors.map((item) => (
              <div key={item.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-primary)] font-medium">{item.label}</span>
                  <span className={`font-display tabular-nums font-semibold ${TEXT_TONE_CLASS[item.tone]}`}>
                    -{item.lifePointsLost.toFixed(1)} pts
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[var(--surface-track)] overflow-hidden">
                  <div
                    className={`cs-bar-fill h-full rounded-full transition-all duration-300 ease-out ${BAR_TONE_CLASS[item.tone]}`}
                    style={{ width: `${item.barWidthPct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onEvaluateInLender}
            className="w-full h-11 px-5 rounded-xl cs-cta-primary font-display font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.99] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)] cursor-pointer"
          >
            <span>Underwrite in Lender</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
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
      </section>

      <CertificateModal
        open={certOpen}
        onClose={() => setCertOpen(false)}
        input={input}
        result={result}
        dataSource={inputSource}
      />
    </div>
  );
}
