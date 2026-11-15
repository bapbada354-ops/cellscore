import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { ArrowLeft, BatteryCharging, Printer, X } from 'lucide-react';
import {
  formatINR,
  formatIndianNumber,
  type BatteryInput,
  type ScoreResult,
} from '../config/modelConfig';
import type { ScoreInputSource } from './ScoreScreen';

interface CertificateModalProps {
  open: boolean;
  onClose: () => void;
  input: BatteryInput;
  result: ScoreResult;
  dataSource: ScoreInputSource;
}

const CHAR_POOL = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomGroup(len: number): string {
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += CHAR_POOL[Math.floor(Math.random() * CHAR_POOL.length)];
  }
  return out;
}

// Generates a 21-character alphanumeric ID formatted as CS26-XXXX-XXXX-XXXX-XXXXX
function generateCertificateId(): string {
  return `CS26-${randomGroup(4)}-${randomGroup(4)}-${randomGroup(4)}-${randomGroup(5)}`;
}

function formatTodayDate(): string {
  return new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function CertificateModal({
  open,
  onClose,
  input,
  result,
  dataSource,
}: CertificateModalProps) {
  const [certificateId, setCertificateId] = useState<string>(() => generateCertificateId());
  const gradId = useId();

  // Generate a fresh 21-character ID once per opening
  useEffect(() => {
    if (open) {
      setCertificateId(generateCertificateId());
    }
  }, [open]);

  // Esc key closes modal and lock background page scroll while open
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  const qrMatrix = useMemo(() => {
    if (!open) return null;
    try {
      const qr = QRCode.create(certificateId, { errorCorrectionLevel: 'M' });
      return {
        size: qr.modules.size,
        data: qr.modules.data,
      };
    } catch {
      return null;
    }
  }, [open, certificateId]);

  if (!open || typeof document === 'undefined') return null;

  const issuedDate = formatTodayDate();
  const clampedScore = Math.max(0, Math.min(100, result.score));
  const viewSize = 168;
  const strokeWidth = 11;
  const radius = (viewSize - strokeWidth) / 2 - 5;
  const center = viewSize / 2;
  const circumference = 2 * Math.PI * radius;
  const arcSpanDeg = 250;
  const arcLength = (arcSpanDeg / 360) * circumference;
  const dashOffset = arcLength - (clampedScore / 100) * arcLength;

  const strokeStops =
    result.band.tone === 'poor'
      ? {
          start: 'var(--gauge-poor-start)',
          end: 'var(--gauge-poor-end)',
          textClass: 'text-[var(--status-poor)] cs-cert-score-poor',
        }
      : result.band.tone === 'fair'
        ? {
            start: 'var(--gauge-fair-start)',
            end: 'var(--gauge-fair-end)',
            textClass: 'text-[var(--status-fair)] cs-cert-score-fair',
          }
        : {
            start: 'var(--gauge-good-start)',
            end: 'var(--gauge-good-end)',
            textClass: 'text-[var(--status-good)] cs-cert-score-good',
          };

  const inputRows: Array<{ label: string; value: string }> = [
    { label: 'Cell chemistry', value: input.chemistry },
    {
      label: 'Vehicle type',
      value: input.vehicleType === '2W' ? '2-Wheeler' : '3-Wheeler',
    },
    { label: 'Battery age', value: `${input.ageMonths} months` },
    { label: 'Charge cycles', value: formatIndianNumber(input.cycles) },
    { label: 'Fast-charge share', value: `${input.fastChargePct}%` },
    { label: 'Time above 40°C', value: `${input.heatAbove40CPct}%` },
    { label: 'Deep-discharge share', value: `${input.deepDischargePct}%` },
    { label: 'Data source', value: dataSource },
  ];

  return createPortal(
    <div
      className="cs-print-modal-root fixed inset-0 z-[9999] flex flex-col h-[100dvh] max-h-[100dvh] bg-[var(--bg-backdrop)] backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="certificate-title"
    >
      {/* Always-Visible Sticky Top Action Bar (hidden when printing) */}
      <div
        className="cs-no-print sticky top-0 z-20 shrink-0 border-b border-[var(--border-glass)] bg-[var(--bg-header)] backdrop-blur-xl px-4 sm:px-6"
        style={{
          paddingTop: 'max(12px, env(safe-area-inset-top))',
          paddingBottom: '12px',
        }}
      >
        <div className="max-w-[794px] mx-auto flex items-start justify-between gap-3">
          {/* Left: Back button */}
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-3.5 rounded-xl bg-[var(--surface-control)] border border-[var(--border-control)] text-[var(--text-primary)] font-display font-semibold text-xs inline-flex items-center gap-1.5 hover:bg-[var(--surface-control-hover)] transition-colors cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back</span>
          </button>

          {/* Right: Primary Print button + helper line + X close button */}
          <div className="flex flex-col items-end gap-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="h-10 px-4 rounded-xl cs-cta-primary font-display font-semibold text-xs inline-flex items-center gap-2 hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]"
              >
                <Printer className="w-4 h-4" aria-hidden="true" />
                <span>Print / Save as PDF</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close certificate"
                className="w-10 h-10 rounded-xl bg-[var(--surface-control)] border border-[var(--border-control)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-control-hover)] inline-flex items-center justify-center transition-colors cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <p className="text-[11px] text-[var(--text-secondary)] text-right leading-snug">
              If printing does not open, open the app in its own browser tab and try again.
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable Backdrop & Certificate Area */}
      <div
        className="cs-print-scroll-body flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pt-5 sm:pt-7"
        style={{
          paddingBottom: 'max(28px, env(safe-area-inset-bottom))',
        }}
        onClick={onClose}
      >
        {/* A4 Certificate Sheet */}
        <article
          className="cs-certificate-page w-full max-w-[794px] mx-auto rounded-[20px] bg-[var(--bg-elevated)] border border-[var(--border-strong)] text-[var(--text-primary)] p-5 sm:p-8 shadow-2xl space-y-5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <header className="cs-cert-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--border-glass)]">
            <div className="flex items-center gap-3">
              <span className="cs-cert-icon-box w-9 h-9 rounded-xl bg-[var(--status-good-bg)] border border-[var(--status-good-border)] flex items-center justify-center text-[var(--accent-mint)] shrink-0">
                <BatteryCharging className="w-5 h-5" aria-hidden="true" />
              </span>
              <div>
                <h1
                  id="certificate-title"
                  className="font-display text-xl sm:text-2xl font-bold tracking-tight"
                >
                  CellScore Battery Health Certificate
                </h1>
                <p className="cs-cert-muted text-xs text-[var(--text-secondary)] mt-0.5">
                  Standardized EV battery health &amp; valuation summary
                </p>
              </div>
            </div>

            <div className="sm:text-right">
              <p className="cs-cert-muted text-[11px] uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                Date Issued
              </p>
              <p className="font-display text-sm font-semibold tabular-nums mt-0.5">{issuedDate}</p>
            </div>
          </header>

          {/* Certificate ID Block */}
          <div className="cs-cert-tile cs-cert-border rounded-2xl bg-[var(--surface-tile)] border border-[var(--border-glass)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="cs-cert-muted text-[11px] uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                Certificate ID
              </p>
              <p className="font-display text-lg sm:text-xl font-bold tracking-wider tabular-nums break-all">
                {certificateId}
              </p>
              <p className="cs-cert-muted text-[11px] text-[var(--text-secondary)]">
                Sample ID, format modelled on the proposed 21-character Battery Pack Aadhaar number
              </p>
            </div>
          </div>

          {/* Score Gauge + Summary Metrics + QR Code */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
            {/* Static SVG Gauge */}
            <div className="cs-cert-tile cs-cert-border sm:col-span-5 rounded-2xl bg-[var(--surface-tile)] border border-[var(--border-glass)] p-4 flex flex-col items-center justify-center">
              <div
                className="relative flex items-center justify-center"
                style={{ width: viewSize, height: 148 }}
              >
                <svg
                  width={viewSize}
                  height={viewSize}
                  viewBox={`0 0 ${viewSize} ${viewSize}`}
                  className="overflow-visible"
                  role="img"
                  aria-label={`Battery score ${clampedScore} out of 100, Band ${result.band.key}`}
                >
                  <defs>
                    <linearGradient id={gradId} x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor={strokeStops.start} />
                      <stop offset="100%" stopColor={strokeStops.end} />
                    </linearGradient>
                  </defs>
                  <g transform={`rotate(145 ${center} ${center})`}>
                    <circle
                      cx={center}
                      cy={center}
                      r={radius}
                      fill="none"
                      className="cs-cert-track"
                      stroke="var(--gauge-track)"
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${arcLength} ${circumference}`}
                      strokeLinecap="round"
                    />
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
                    />
                  </g>
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center pt-3">
                  <span className="cs-cert-muted text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                    Score
                  </span>
                  <span
                    className={`font-display text-5xl font-bold leading-none tabular-nums ${strokeStops.textClass}`}
                  >
                    {clampedScore}
                  </span>
                  <span className="mt-1.5 text-xs font-display font-semibold">
                    Band {result.band.key} · {result.band.tierName}
                  </span>
                </div>
              </div>
            </div>

            {/* Key Valuation Outputs + QR */}
            <div className="sm:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-stretch">
              <div className="space-y-3.5 flex flex-col justify-between">
                <div className="cs-cert-tile cs-cert-border rounded-2xl bg-[var(--surface-tile)] border border-[var(--border-glass)] p-4">
                  <p className="cs-cert-muted text-xs text-[var(--text-secondary)]">Remaining life</p>
                  <p className="font-display text-2xl font-bold tabular-nums mt-1">
                    {result.remainingLifePct}%
                  </p>
                </div>
                <div className="cs-cert-tile cs-cert-border rounded-2xl bg-[var(--surface-tile)] border border-[var(--border-glass)] p-4">
                  <p className="cs-cert-muted text-xs text-[var(--text-secondary)]">Estimated residual value</p>
                  <p className="font-display text-2xl font-bold tabular-nums mt-1">
                    {formatINR(result.residualValueInr)}
                  </p>
                </div>
              </div>

              {/* QR Code Box */}
              <div className="cs-cert-tile cs-cert-border rounded-2xl bg-[var(--surface-tile)] border border-[var(--border-glass)] p-4 flex flex-col items-center justify-center text-center gap-2.5">
                {qrMatrix ? (
                  <div className="p-2 rounded-xl bg-white border border-[var(--border-glass)]">
                    <svg
                      width={96}
                      height={96}
                      viewBox={`0 0 ${qrMatrix.size} ${qrMatrix.size}`}
                      shapeRendering="crispEdges"
                      role="img"
                      aria-label={`QR code encoding ${certificateId}`}
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
                              fill="#0F172A"
                            />
                          );
                        }),
                      )}
                    </svg>
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-xl border border-dashed border-[var(--border-strong)] flex items-center justify-center text-[11px] text-[var(--text-secondary)]">
                    QR (placeholder)
                  </div>
                )}
                <p className="cs-cert-muted text-[11px] text-[var(--text-secondary)]">
                  {qrMatrix ? 'Certificate QR' : 'QR (placeholder)'}
                </p>
              </div>
            </div>
          </div>

          {/* Inputs Table */}
          <div className="space-y-2">
            <h2 className="cs-cert-muted text-[11px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-semibold">
              Inputs Used
            </h2>
            <div className="cs-cert-border rounded-2xl border border-[var(--border-glass)] overflow-hidden">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <tbody className="cs-cert-divide divide-y divide-[var(--border-glass)]">
                  {inputRows.map((row) => (
                    <tr key={row.label} className="cs-cert-row">
                      <th
                        scope="row"
                        className="cs-cert-muted py-2 px-4 font-medium text-[var(--text-secondary)] w-1/2"
                      >
                        {row.label}
                      </th>
                      <td className="py-2 px-4 font-display font-semibold tabular-nums text-right">
                        {row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <footer className="cs-cert-border pt-3.5 border-t border-[var(--border-glass)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <p className="cs-cert-muted text-[var(--text-secondary)]">
              Prototype. Sample data. Model assumptions pending validation on real batteries.
            </p>
            <span className="cs-cert-muted text-[var(--text-secondary)] tabular-nums">CellScore</span>
          </footer>
        </article>
      </div>
    </div>,
    document.body,
  );
}
