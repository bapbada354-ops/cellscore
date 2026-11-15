import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Database,
  ExternalLink,
  Flame,
  Info,
  Plus,
  RotateCcw,
  Trash2,
  Zap,
} from 'lucide-react';
import { CONFIG, clamp, formatIndianNumber, type BatteryInput } from '../config/modelConfig';

export type ChargerType = 'Slow home' | 'Standard' | 'Fast';
export type DayCondition = 'Cool' | 'Warm' | 'Hot';
export type TrackSubTab = 'guide' | 'log' | 'policy';

export interface ChargeSession {
  id: string;
  date: string; // YYYY-MM-DD
  startPct: number;
  endPct: number;
  chargerType: ChargerType;
  dayCondition: DayCondition;
}

export interface BatteryLogState {
  manufactureDate: string;
  priorCycles: number;
  sessions: ChargeSession[];
}

interface TrackScreenProps {
  logState: BatteryLogState;
  onChangeLogState: (next: BatteryLogState) => void;
  onSendToScore: (values: Pick<BatteryInput, 'ageMonths' | 'cycles' | 'fastChargePct' | 'heatAbove40CPct' | 'deepDischargePct'>) => void;
}

type ConfidenceLevel = 'Verified' | 'Logged' | 'Estimated';

const CONFIDENCE_BADGE_STYLES: Record<ConfidenceLevel, string> = {
  Verified: 'bg-[var(--status-good-bg)] text-[var(--status-good)] border-[var(--status-good-border)]',
  Logged: 'bg-[var(--status-fair-bg)] text-[var(--status-fair)] border-[var(--status-fair-border)]',
  Estimated: 'bg-[var(--surface-control)] text-[var(--text-secondary)] border-[var(--border-control)]',
};

const GUIDE_METRICS: Array<{
  title: string;
  definition: string;
  whyItMatters: string;
  methods: Array<{ label: string; confidence: ConfidenceLevel }>;
}> = [
  {
    title: '1. Battery age',
    definition: 'Calculated from the manufacture date on the pack label or battery pack ID, shown in months.',
    whyItMatters: 'Lithium cells gradually lose capacity over calendar time even when parked or lightly ridden.',
    methods: [
      { label: 'Pack manufacture timestamp from BMS or pack ID', confidence: 'Verified' },
      { label: 'Manufacture date entered from the physical pack label', confidence: 'Logged' },
      { label: 'Vehicle registration date when the pack label is unreadable', confidence: 'Estimated' },
    ],
  },
  {
    title: '2. Charge cycles',
    definition:
      "Equivalent full cycles = sum of each charge's depth (end % minus start %) divided by 100.",
    whyItMatters: 'Total energy throughput is the core measure of electrochemical wear across the pack.',
    methods: [
      { label: 'BMS lifetime cycle counter or IoT telemetry', confidence: 'Verified' },
      { label: 'Prior cycle estimate plus sessions captured in the log', confidence: 'Logged' },
      { label: 'Odometer kilometres divided by typical range per charge', confidence: 'Estimated' },
    ],
  },
  {
    title: '3. Fast-charge share',
    definition: 'Share of total charging energy delivered by fast chargers relative to all sessions.',
    whyItMatters: 'Frequent high-current charging increases internal resistance and accelerates lithium plating.',
    methods: [
      { label: 'Charger power logs or BMS charge-rate telemetry', confidence: 'Verified' },
      { label: 'Charger type (Slow home / Standard / Fast) recorded per session', confidence: 'Logged' },
      { label: 'Hub shift mix when charger-level logs are unavailable', confidence: 'Estimated' },
    ],
  },
  {
    title: '4. Time above 40°C',
    definition: 'Share of operating and charging time the battery spends above 40°C.',
    whyItMatters: 'Heat is the fastest accelerator of irreversible cell aging in Indian summer conditions.',
    methods: [
      { label: 'BMS temperature histogram above 40°C', confidence: 'Verified' },
      { label: 'Share of distinct logged days marked Hot (>40°C) in the log', confidence: 'Estimated' },
      { label: 'Regional ambient climate profile as a fallback proxy', confidence: 'Estimated' },
    ],
  },
  {
    title: '5. Deep-discharge share',
    definition: 'Share of charge sessions that started when state of charge was below 20%.',
    whyItMatters: 'Running a pack below 20% repeatedly places high mechanical stress on cell electrodes.',
    methods: [
      { label: 'BMS low-state-of-charge event counter', confidence: 'Verified' },
      { label: 'Count of sessions starting below 20% in the log', confidence: 'Logged' },
      { label: 'Route length vs. usable range estimate', confidence: 'Estimated' },
    ],
  },
];

const CHECKLIST_STEPS = [
  'Note the pack’s manufacture date',
  'Log every charge session',
  'Mark Hot days (>40°C)',
  'Tap Send to Score',
];

type ReadinessStatus = 'Captured' | 'Partial' | 'Roadmap';

interface PolicyFieldItem {
  name: string;
  status: ReadinessStatus;
  detail?: string;
}

const READINESS_STATUS_STYLES: Record<ReadinessStatus, string> = {
  Captured: 'bg-[var(--status-good-bg)] text-[var(--status-good)] border-[var(--status-good-border)]',
  Partial: 'bg-[var(--status-fair-bg)] text-[var(--status-fair)] border-[var(--status-fair-border)]',
  Roadmap: 'bg-[var(--surface-control)] text-[var(--text-secondary)] border-[var(--border-control)]',
};

const DYNAMIC_POLICY_FIELDS: PolicyFieldItem[] = [
  {
    name: 'State of health',
    status: 'Captured',
    detail: 'CellScore estimates remaining life and a score',
  },
  {
    name: 'Date and time stamp',
    status: 'Captured',
    detail: 'certificate date and log dates',
  },
  {
    name: 'Battery status',
    status: 'Roadmap',
  },
  {
    name: 'Usage history (cycles, fast-charge share, heat exposure, deep discharge)',
    status: 'Captured',
    detail: 'CellScore tracks these; extra beyond the minimum',
  },
];

const STATIC_POLICY_FIELDS: PolicyFieldItem[] = [
  {
    name: 'Unique 21-character pack ID plus QR code',
    status: 'Partial',
    detail: 'CellScore generates a sample ID and a QR placeholder on the certificate',
  },
  {
    name: 'Battery material composition',
    status: 'Partial',
    detail: 'chemistry only: LFP or NMC',
  },
  {
    name: 'Battery manufacturer identifier',
    status: 'Roadmap',
  },
  {
    name: 'Battery carbon footprint',
    status: 'Roadmap',
  },
  {
    name: 'BMS hardware and software version',
    status: 'Roadmap',
  },
  {
    name: 'Disassembly, circularity and recyclability details',
    status: 'Roadmap',
  },
];

function computeGroupReadinessPct(items: PolicyFieldItem[]): number {
  if (items.length === 0) return 0;
  const score = items.reduce((acc, item) => {
    if (item.status === 'Captured') return acc + 1;
    if (item.status === 'Partial') return acc + 0.5;
    return acc;
  }, 0);
  return Math.round((score / items.length) * 100);
}

const POLICY_SOURCES = [
  {
    label: 'Enviliance India report on Battery Pack Aadhaar draft',
    url: 'https://enviliance.com/regions/south-asia/in/report_14902',
  },
  {
    label: 'Mercom India report on Aadhaar-style battery traceability',
    url: 'https://mercomindia.com/government-proposes-aadhaar-style-id-to-enable-end-to-end-battery-traceability',
  },
];

function toIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function computeAgeMonths(manufactureDate: string): number {
  if (!manufactureDate) return 0;
  const parts = manufactureDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return 0;
  const [mYear, mMonth, mDay] = parts;
  const now = new Date();
  let months = (now.getFullYear() - mYear) * 12 + (now.getMonth() + 1 - mMonth);
  if (now.getDate() < mDay) months -= 1;
  return Math.max(0, months);
}

function generateSampleLogState(): BatteryLogState {
  const today = new Date();
  const mfgDate = new Date(today.getFullYear() - 2, today.getMonth(), today.getDate());

  // 40 realistic sessions spread across the past 30 days
  const sessions: ChargeSession[] = [];
  const chargerPattern: ChargerType[] = [
    'Slow home',
    'Standard',
    'Fast',
    'Standard',
    'Slow home',
    'Fast',
    'Standard',
    'Fast',
    'Slow home',
    'Standard',
  ];
  const startPattern = [14, 32, 18, 45, 22, 12, 38, 28, 52, 16, 41, 24, 15, 35, 48, 19];
  const endPattern = [92, 85, 95, 80, 100, 88, 90, 78, 96, 84, 91, 75, 98, 86, 82, 94];

  let sessionIndex = 0;
  for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
    const d = new Date(today);
    d.setDate(today.getDate() - daysAgo);
    const dateStr = toIsoDate(d);

    // Every 3rd day has 2 sessions (40 total sessions across 30 days)
    const countForDay = daysAgo % 3 === 0 ? 2 : 1;
    // Mark ~7 distinct days as Hot (>40°C), ~11 Warm, rest Cool
    const dayCondition: DayCondition =
      daysAgo === 2 ||
      daysAgo === 6 ||
      daysAgo === 11 ||
      daysAgo === 16 ||
      daysAgo === 20 ||
      daysAgo === 24 ||
      daysAgo === 28
        ? 'Hot'
        : daysAgo % 2 === 0
          ? 'Warm'
          : 'Cool';

    for (let j = 0; j < countForDay; j++) {
      const startPct = startPattern[(sessionIndex + j * 3) % startPattern.length];
      const endPct = endPattern[(sessionIndex + j * 5) % endPattern.length];
      const chargerType = chargerPattern[(sessionIndex + j * 2) % chargerPattern.length];

      sessions.push({
        id: `sample-${daysAgo}-${j}`,
        date: dateStr,
        startPct,
        endPct,
        chargerType,
        dayCondition,
      });
      sessionIndex += 1;
    }
  }

  return {
    manufactureDate: toIsoDate(mfgDate),
    priorCycles: 500,
    sessions,
  };
}

export function TrackScreen({
  logState,
  onChangeLogState,
  onSendToScore,
}: TrackScreenProps) {
  const [subTab, setSubTab] = useState<TrackSubTab>('guide');

  // Session form state
  const [formDate, setFormDate] = useState<string>(() => toIsoDate(new Date()));
  const [formStartPct, setFormStartPct] = useState<string>('24');
  const [formEndPct, setFormEndPct] = useState<string>('90');
  const [formCharger, setFormCharger] = useState<ChargerType>('Standard');
  const [formCondition, setFormCondition] = useState<DayCondition>('Warm');
  const [formError, setFormError] = useState<string>('');

  // Live calculations (divide-by-zero safe)
  const metrics = useMemo(() => {
    const ageMonthsRaw = computeAgeMonths(logState.manufactureDate);

    let totalDepth = 0;
    let fastDepth = 0;
    let deepSessions = 0;
    const distinctDays = new Set<string>();
    const hotDays = new Set<string>();

    for (const s of logState.sessions) {
      const depth = Math.max(0, s.endPct - s.startPct);
      totalDepth += depth;
      if (s.chargerType === 'Fast') {
        fastDepth += depth;
      }
      if (s.startPct < 20) {
        deepSessions += 1;
      }
      distinctDays.add(s.date);
      if (s.dayCondition === 'Hot') {
        hotDays.add(s.date);
      }
    }

    const loggedEquivalentCycles = totalDepth / 100;
    const priorCycles = Math.max(0, Number.isFinite(logState.priorCycles) ? logState.priorCycles : 0);
    const totalCyclesRaw = priorCycles + loggedEquivalentCycles;

    const fastShareRaw = totalDepth > 0 ? (fastDepth / totalDepth) * 100 : 0;
    const heatShareRaw = distinctDays.size > 0 ? (hotDays.size / distinctDays.size) * 100 : 0;
    const deepShareRaw =
      logState.sessions.length > 0 ? (deepSessions / logState.sessions.length) * 100 : 0;

    return {
      ageMonths: Math.round(ageMonthsRaw),
      loggedEquivalentCycles,
      totalCycles: Math.round(totalCyclesRaw),
      fastSharePct: Math.round(fastShareRaw),
      heatSharePct: Math.round(heatShareRaw),
      deepSharePct: Math.round(deepShareRaw),
      distinctDaysCount: distinctDays.size,
      hotDaysCount: hotDays.size,
    };
  }, [logState]);

  const sortedSessions = useMemo(() => {
    return [...logState.sessions]
      .map((s, idx) => ({ s, idx }))
      .sort((a, b) => {
        if (a.s.date !== b.s.date) return b.s.date.localeCompare(a.s.date);
        return b.idx - a.idx;
      })
      .map((item) => item.s);
  }, [logState.sessions]);

  const handleAddSession = (e: React.FormEvent) => {
    e.preventDefault();
    const startVal = Number(formStartPct);
    const endVal = Number(formEndPct);

    if (!formDate) {
      setFormError('Please select a session date.');
      return;
    }
    if (!Number.isFinite(startVal) || !Number.isFinite(endVal) || startVal < 0 || endVal > 100) {
      setFormError('Battery percentages must be between 0% and 100%.');
      return;
    }
    if (endVal <= startVal) {
      setFormError('End battery % must be greater than start battery %.');
      return;
    }

    setFormError('');
    const newSession: ChargeSession = {
      id: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date: formDate,
      startPct: Math.round(startVal),
      endPct: Math.round(endVal),
      chargerType: formCharger,
      dayCondition: formCondition,
    };

    onChangeLogState({
      ...logState,
      sessions: [...logState.sessions, newSession],
    });
  };

  const handleDeleteSession = (id: string) => {
    onChangeLogState({
      ...logState,
      sessions: logState.sessions.filter((s) => s.id !== id),
    });
  };

  const handleClearLog = () => {
    onChangeLogState({
      ...logState,
      sessions: [],
    });
  };

  const handleLoadSampleLog = () => {
    setFormError('');
    onChangeLogState(generateSampleLogState());
  };

  const handleSendToScoreClick = () => {
    if (logState.sessions.length === 0) return;
    onSendToScore({
      ageMonths: clamp(
        metrics.ageMonths,
        CONFIG.SLIDER_BOUNDS.ageMonths.min,
        CONFIG.SLIDER_BOUNDS.ageMonths.max,
      ),
      cycles: clamp(
        metrics.totalCycles,
        CONFIG.SLIDER_BOUNDS.cycles.min,
        CONFIG.SLIDER_BOUNDS.cycles.max,
      ),
      fastChargePct: clamp(metrics.fastSharePct, 0, 100),
      heatAbove40CPct: clamp(metrics.heatSharePct, 0, 100),
      deepDischargePct: clamp(metrics.deepSharePct, 0, 100),
    });
  };

  const isLogEmpty = logState.sessions.length === 0;

  return (
    <div className="space-y-6">
      {/* Header + Sub-tab Segmented Control */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-medium">
            Data Collection & Starter Log
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--text-primary)]">
            Track Battery Usage
          </h1>
        </div>

        <div
          role="tablist"
          aria-label="Track view"
          className="inline-grid grid-cols-3 p-1 rounded-xl bg-[var(--surface-glass)] border border-[var(--border-glass)] self-start sm:self-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'guide'}
            onClick={() => setSubTab('guide')}
            className={`px-3.5 sm:px-5 h-9 rounded-lg text-xs font-semibold transition-all duration-200 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60 cursor-pointer ${
              subTab === 'guide'
                ? 'cs-seg-active border shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
            }`}
          >
            Guide
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'log'}
            onClick={() => setSubTab('log')}
            className={`px-3.5 sm:px-5 h-9 rounded-lg text-xs font-semibold transition-all duration-200 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60 cursor-pointer inline-flex items-center justify-center gap-1.5 ${
              subTab === 'log'
                ? 'cs-seg-active border shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
            }`}
          >
            <span>Battery Log</span>
            {logState.sessions.length > 0 ? (
              <span className="font-display tabular-nums text-[11px] text-[var(--accent-mint)]">
                ({logState.sessions.length})
              </span>
            ) : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'policy'}
            onClick={() => setSubTab('policy')}
            className={`px-3.5 sm:px-5 h-9 rounded-lg text-xs font-semibold transition-all duration-200 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60 cursor-pointer ${
              subTab === 'policy'
                ? 'cs-seg-active border shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
            }`}
          >
            Policy readiness
          </button>
        </div>
      </div>

      {subTab === 'policy' ? (
        <div className="space-y-6">
          {/* Header & Draft Notice */}
          <section aria-label="Policy readiness overview" className="glass-card p-6 sm:p-8 space-y-5">
            <div className="space-y-2">
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--text-primary)]">
                Aligned with the proposed Battery Pack Aadhaar
              </h2>
              <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-3xl leading-relaxed">
                The draft guidelines describe the data a battery&apos;s digital record would hold.
                Here is what CellScore already captures.
              </p>
              <p className="text-xs font-medium text-[var(--status-fair)]">
                Battery Pack Aadhaar is a draft proposal from the road transport ministry. Fields
                may change.
              </p>
            </div>

            {/* Two Progress Bars */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {[
                {
                  label: 'Dynamic data readiness',
                  pct: computeGroupReadinessPct(DYNAMIC_POLICY_FIELDS),
                  tone: 'bg-gradient-to-r from-[var(--cta-from)] to-[var(--cta-to)]',
                },
                {
                  label: 'Static data readiness',
                  pct: computeGroupReadinessPct(STATIC_POLICY_FIELDS),
                  tone: 'bg-[var(--status-fair)]',
                },
              ].map((bar) => (
                <div key={bar.label} className="glass-tile p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--text-primary)]">{bar.label}</span>
                    <span className="font-display font-semibold text-[var(--text-primary)] tabular-nums">
                      {bar.pct}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[var(--surface-track)] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${bar.tone}`}
                      style={{ width: `${bar.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed pt-1 border-t border-[var(--border-subtle)]">
              CellScore is the lender-side layer: it turns a battery&apos;s state-of-health and
              usage data into credit decisions. Manufacturing and recycling fields come from
              manufacturers through the passport.
            </p>
          </section>

          {/* Checklist Groups */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* DYNAMIC DATA */}
            <section aria-label="Dynamic data checklist" className="glass-card p-6 space-y-4">
              <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-medium">
                DYNAMIC DATA
              </p>
              <ul className="divide-y divide-[var(--border-subtle)]">
                {DYNAMIC_POLICY_FIELDS.map((item) => (
                  <li key={item.name} className="py-3.5 first:pt-1 last:pb-1 space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm font-medium text-[var(--text-primary)]">{item.name}</span>
                      <span
                        className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${
                          READINESS_STATUS_STYLES[item.status]
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    {item.detail ? (
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{item.detail}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>

            {/* STATIC DATA */}
            <section aria-label="Static data checklist" className="glass-card p-6 space-y-4">
              <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-medium">
                STATIC DATA
              </p>
              <ul className="divide-y divide-[var(--border-subtle)]">
                {STATIC_POLICY_FIELDS.map((item) => (
                  <li key={item.name} className="py-3.5 first:pt-1 last:pb-1 space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm font-medium text-[var(--text-primary)]">{item.name}</span>
                      <span
                        className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${
                          READINESS_STATUS_STYLES[item.status]
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    {item.detail ? (
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{item.detail}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Sources */}
          <div className="glass-card p-5 sm:p-6 space-y-2.5">
            <h3 className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-medium">
              Sources
            </h3>
            <ul className="space-y-2 text-xs">
              {POLICY_SOURCES.map((src) => (
                <li key={src.url} className="flex flex-wrap items-center gap-2">
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-semibold text-[var(--accent-mint)] hover:text-[var(--accent-cyan)] transition-colors underline underline-offset-4 break-all"
                  >
                    <span>{src.url}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : subTab === 'guide' ? (
        <div className="space-y-6">
          {/* Five Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {GUIDE_METRICS.map((metric, idx) => (
              <article
                key={metric.title}
                className={`glass-card glass-card-interactive p-6 space-y-4 ${
                  idx === GUIDE_METRICS.length - 1 ? 'md:col-span-2' : ''
                }`}
              >
                <div className="space-y-1.5">
                  <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                    {metric.title}
                  </h2>
                  <p className="text-sm text-[var(--text-primary)]/90 leading-relaxed">{metric.definition}</p>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    <span className="font-semibold text-[var(--text-primary)]/85">Why it matters:</span>{' '}
                    {metric.whyItMatters}
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-medium">
                    How to get it
                  </p>
                  <ul className="space-y-2">
                    {metric.methods.map((method) => (
                      <li
                        key={method.label}
                        className="flex items-start justify-between gap-3 text-xs"
                      >
                        <span className="text-[var(--text-secondary)] leading-relaxed">{method.label}</span>
                        <span
                          className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${
                            CONFIDENCE_BADGE_STYLES[method.confidence]
                          }`}
                        >
                          {method.confidence}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>

          {/* Fleet Operator 2-Minute Checklist */}
          <section
            aria-label="Fleet operator 2-minute checklist"
            className="glass-card p-6 sm:p-8 space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--active-tab-from)] to-[var(--active-tab-to)] border border-[var(--status-good-border)] flex items-center justify-center text-[var(--accent-mint)] shrink-0">
                  <ClipboardList className="w-4 h-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                    Fleet operator 2-minute checklist
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Start scoring packs before full telematics hardware is installed.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSubTab('log')}
                className="h-10 px-4 rounded-xl cs-cta-primary font-display font-semibold text-xs inline-flex items-center gap-1.5 hover:opacity-95 transition-opacity whitespace-nowrap self-start sm:self-auto cursor-pointer"
              >
                <span>Open Battery Log</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {CHECKLIST_STEPS.map((stepText, idx) => (
                <div key={stepText} className="glass-tile p-4 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[var(--accent-mint)] shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-0.5">
                    <span className="text-[11px] uppercase tracking-[0.1em] text-[var(--text-secondary)] font-medium">
                      Step {idx + 1}
                    </span>
                    <p className="text-xs font-medium text-[var(--text-primary)]">{stepText}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-[var(--text-secondary)] flex items-center gap-2 pt-1">
              <Info className="w-3.5 h-3.5 text-[var(--accent-cyan)] shrink-0" aria-hidden="true" />
              <span>
                In production, these inputs flow automatically from BMS and IoT data. This log is
                the starter version.
              </span>
            </p>
          </section>
        </div>
      ) : (
        /* BATTERY LOG SUB-TAB */
        <div className="space-y-6">
          {/* Top Row: Pack Details + Live Calculated Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Pack Details & Session Form */}
            <div className="lg:col-span-6 space-y-6">
              {/* Pack Details */}
              <section aria-label="Pack details" className="glass-card p-6 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-medium">
                      Pack Baseline
                    </p>
                    <h2 className="font-display text-lg font-semibold text-[var(--text-primary)] mt-0.5">
                      Pack details
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={handleLoadSampleLog}
                    className="h-9 px-3.5 rounded-xl bg-[var(--surface-control)] border border-[var(--border-control)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-control-hover)] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60 cursor-pointer"
                  >
                    <Database className="w-3.5 h-3.5 text-[var(--accent-cyan)]" aria-hidden="true" />
                    <span>Load 30-day sample log</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="track-mfg-date"
                      className="block text-xs font-medium text-[var(--text-primary)]"
                    >
                      Manufacture date
                    </label>
                    <div className="relative">
                      <input
                        id="track-mfg-date"
                        type="date"
                        max={toIsoDate(new Date())}
                        value={logState.manufactureDate}
                        onChange={(e) =>
                          onChangeLogState({ ...logState, manufactureDate: e.target.value })
                        }
                        className="w-full h-10 px-3 rounded-xl bg-[var(--surface-control)] border border-[var(--border-control)] text-xs font-medium text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="track-prior-cycles"
                      className="block text-xs font-medium text-[var(--text-primary)]"
                    >
                      Cycles before logging started (estimate)
                    </label>
                    <input
                      id="track-prior-cycles"
                      type="number"
                      min={0}
                      max={2500}
                      step={1}
                      value={logState.priorCycles}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        onChangeLogState({
                          ...logState,
                          priorCycles: Number.isFinite(val) ? Math.max(0, val) : 0,
                        });
                      }}
                      className="w-full h-10 px-3 rounded-xl bg-[var(--surface-control)] border border-[var(--border-control)] text-xs font-medium text-[var(--text-primary)] tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60"
                    />
                  </div>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Because the log only covers recent charging, add an estimate of prior cycles so
                  total wear reflects full lifetime usage.
                </p>
              </section>

              {/* Add Charge Session Form */}
              <section aria-label="Add charge session" className="glass-card p-6 space-y-4">
                <div>
                  <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-medium">
                    New Entry
                  </p>
                  <h2 className="font-display text-lg font-semibold text-[var(--text-primary)] mt-0.5">
                    Add charge session
                  </h2>
                </div>

                <form onSubmit={handleAddSession} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="sess-date"
                        className="block text-xs font-medium text-[var(--text-primary)]"
                      >
                        Date
                      </label>
                      <input
                        id="sess-date"
                        type="date"
                        max={toIsoDate(new Date())}
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-[var(--surface-control)] border border-[var(--border-control)] text-xs font-medium text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="sess-start"
                        className="block text-xs font-medium text-[var(--text-primary)]"
                      >
                        Start %
                      </label>
                      <input
                        id="sess-start"
                        type="number"
                        min={0}
                        max={99}
                        value={formStartPct}
                        onChange={(e) => setFormStartPct(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-[var(--surface-control)] border border-[var(--border-control)] text-xs font-medium text-[var(--text-primary)] tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="sess-end" className="block text-xs font-medium text-[var(--text-primary)]">
                        End %
                      </label>
                      <input
                        id="sess-end"
                        type="number"
                        min={1}
                        max={100}
                        value={formEndPct}
                        onChange={(e) => setFormEndPct(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-[var(--surface-control)] border border-[var(--border-control)] text-xs font-medium text-[var(--text-primary)] tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <span className="block text-xs font-medium text-[var(--text-primary)]">Charger type</span>
                      <div
                        role="group"
                        aria-label="Charger type"
                        className="grid grid-cols-3 p-1 rounded-xl bg-[var(--surface-glass)] border border-[var(--border-glass)]"
                      >
                        {(['Slow home', 'Standard', 'Fast'] as ChargerType[]).map((type) => {
                          const active = formCharger === type;
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setFormCharger(type)}
                              className={`h-8 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap px-1.5 cursor-pointer ${
                                active
                                  ? 'cs-seg-active border shadow-sm'
                                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
                              }`}
                            >
                              {type}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="block text-xs font-medium text-[var(--text-primary)]">
                        Day conditions
                      </span>
                      <div
                        role="group"
                        aria-label="Day conditions"
                        className="grid grid-cols-3 p-1 rounded-xl bg-[var(--surface-glass)] border border-[var(--border-glass)]"
                      >
                        {(
                          [
                            { key: 'Cool', label: 'Cool <30°C' },
                            { key: 'Warm', label: 'Warm 30–40' },
                            { key: 'Hot', label: 'Hot >40°C' },
                          ] as Array<{ key: DayCondition; label: string }>
                        ).map(({ key, label }) => {
                          const active = formCondition === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setFormCondition(key)}
                              className={`h-8 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap px-1 cursor-pointer ${
                                active
                                  ? key === 'Hot'
                                    ? 'bg-[var(--status-poor-bg)] text-[var(--status-poor)] border border-[var(--status-poor-border)]'
                                    : 'cs-seg-active border shadow-sm'
                                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {formError ? (
                    <p role="alert" className="text-xs font-medium text-[var(--status-poor)]">
                      {formError}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    className="w-full h-10 px-4 rounded-xl bg-[var(--surface-control)] border border-[var(--border-strong)] text-[var(--text-primary)] font-display font-semibold text-xs inline-flex items-center justify-center gap-1.5 hover:bg-[var(--surface-control-hover)] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60"
                  >
                    <Plus className="w-4 h-4 text-[var(--accent-mint)]" aria-hidden="true" />
                    <span>Add session</span>
                  </button>
                </form>
              </section>
            </div>

            {/* Right: Live Derived Metrics + Send to Score */}
            <section
              aria-label="Live battery log metrics"
              className="lg:col-span-6 glass-card p-6 sm:p-7 space-y-5"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-medium">
                    Live Calculations
                  </p>
                  <h2 className="font-display text-lg font-semibold text-[var(--text-primary)] mt-0.5">
                    Derived Score Inputs
                  </h2>
                </div>
                <span className="text-xs text-[var(--text-secondary)] tabular-nums">
                  {logState.sessions.length} {logState.sessions.length === 1 ? 'session' : 'sessions'} ·{' '}
                  {metrics.distinctDaysCount} {metrics.distinctDaysCount === 1 ? 'day' : 'days'}
                </span>
              </div>

              {/* 5 Large Metric Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="glass-tile p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[var(--text-secondary)]">Age (months)</span>
                    <span
                      className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${CONFIDENCE_BADGE_STYLES.Logged}`}
                    >
                      Logged
                    </span>
                  </div>
                  <p className="font-display text-3xl font-bold text-[var(--text-primary)] tabular-nums">
                    {metrics.ageMonths} <span className="text-xs font-normal text-[var(--text-secondary)]">mo</span>
                  </p>
                </div>

                <div className="glass-tile p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[var(--text-secondary)]">Total cycles</span>
                    <span
                      className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${CONFIDENCE_BADGE_STYLES.Logged}`}
                    >
                      Logged
                    </span>
                  </div>
                  <p className="font-display text-3xl font-bold text-[var(--text-primary)] tabular-nums">
                    {formatIndianNumber(metrics.totalCycles)}
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)] tabular-nums">
                    {formatIndianNumber(logState.priorCycles)} prior +{' '}
                    {metrics.loggedEquivalentCycles.toFixed(1)} logged
                  </p>
                </div>

                <div className="glass-tile p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[var(--text-secondary)]">Fast-charge share</span>
                    <span
                      className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${CONFIDENCE_BADGE_STYLES.Logged}`}
                    >
                      Logged
                    </span>
                  </div>
                  <p className="font-display text-3xl font-bold text-[var(--text-primary)] tabular-nums">
                    {metrics.fastSharePct}%
                  </p>
                </div>

                <div className="glass-tile p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[var(--text-secondary)]">Time above 40°C</span>
                    <span
                      className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${CONFIDENCE_BADGE_STYLES.Estimated}`}
                    >
                      Estimated
                    </span>
                  </div>
                  <p className="font-display text-3xl font-bold text-[var(--text-primary)] tabular-nums">
                    {metrics.heatSharePct}%
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)] tabular-nums">
                    {metrics.hotDaysCount} Hot of {metrics.distinctDaysCount} logged days
                  </p>
                </div>

                <div className="glass-tile p-4 space-y-2 sm:col-span-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[var(--text-secondary)]">Deep-discharge share (&lt;20% start)</span>
                    <span
                      className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${CONFIDENCE_BADGE_STYLES.Logged}`}
                    >
                      Logged
                    </span>
                  </div>
                  <p className="font-display text-3xl font-bold text-[var(--text-primary)] tabular-nums">
                    {metrics.deepSharePct}%
                  </p>
                </div>
              </div>

              {/* Prominent Primary CTA: Send to Score */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  disabled={isLogEmpty}
                  onClick={handleSendToScoreClick}
                  className={`w-full h-11 px-5 rounded-xl font-display font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)] ${
                    isLogEmpty
                      ? 'bg-[var(--surface-control)] text-[var(--text-secondary)] border border-[var(--border-glass)] cursor-not-allowed'
                      : 'cs-cta-primary hover:opacity-95 active:scale-[0.99] cursor-pointer'
                  }`}
                >
                  <span>Send to Score</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
                {isLogEmpty ? (
                  <p className="text-xs text-center text-[var(--text-secondary)]">
                    Add at least one charge session or load the 30-day sample log to enable scoring.
                  </p>
                ) : null}
              </div>
            </section>
          </div>

          {/* Sessions Table */}
          <section aria-label="Logged sessions" className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-medium">
                  Session History
                </p>
                <h2 className="font-display text-lg font-semibold text-[var(--text-primary)] mt-0.5">
                  Logged Charge Sessions
                </h2>
              </div>

              {!isLogEmpty ? (
                <button
                  type="button"
                  onClick={handleClearLog}
                  className="h-9 px-3.5 rounded-xl bg-[var(--surface-control)] border border-[var(--border-control)] text-xs font-semibold text-[var(--status-poor)] hover:bg-[var(--status-poor-bg)] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Clear log</span>
                </button>
              ) : null}
            </div>

            {isLogEmpty ? (
              <div className="glass-tile p-8 text-center space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--surface-control)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-secondary)] mx-auto">
                  <Calendar className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <p className="font-display text-base font-semibold text-[var(--text-primary)]">
                    No charge sessions logged yet
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Add your first charging session using the form above, or load the 30-day sample
                    log to see how real fleet sessions map into CellScore inputs.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-glass)] text-[var(--text-secondary)] uppercase tracking-[0.08em] text-[11px]">
                      <th className="py-2.5 pr-4 font-medium">Date</th>
                      <th className="py-2.5 pr-4 font-medium">Charge range</th>
                      <th className="py-2.5 pr-4 font-medium">Depth</th>
                      <th className="py-2.5 pr-4 font-medium">Charger</th>
                      <th className="py-2.5 pr-4 font-medium">Day temp</th>
                      <th className="py-2.5 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {sortedSessions.map((session) => {
                      const depth = session.endPct - session.startPct;
                      return (
                        <tr
                          key={session.id}
                          className="hover:bg-[var(--surface-control)] transition-colors"
                        >
                          <td className="py-3 pr-4 font-medium text-[var(--text-primary)] tabular-nums whitespace-nowrap">
                            {session.date}
                          </td>
                          <td className="py-3 pr-4 text-[var(--text-primary)] tabular-nums whitespace-nowrap">
                            {session.startPct}% → {session.endPct}%
                            {session.startPct < 20 ? (
                              <span className="ml-2 text-[11px] text-[var(--status-fair)]">Deep</span>
                            ) : null}
                          </td>
                          <td className="py-3 pr-4 text-[var(--text-secondary)] tabular-nums whitespace-nowrap">
                            +{depth}% ({(depth / 100).toFixed(2)} cyc)
                          </td>
                          <td className="py-3 pr-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 font-medium ${
                                session.chargerType === 'Fast'
                                  ? 'text-[var(--status-fair)]'
                                  : 'text-[var(--text-primary)]'
                              }`}
                            >
                              {session.chargerType === 'Fast' ? (
                                <Zap className="w-3 h-3" aria-hidden="true" />
                              ) : null}
                              <span>{session.chargerType}</span>
                            </span>
                          </td>
                          <td className="py-3 pr-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 font-medium ${
                                session.dayCondition === 'Hot'
                                  ? 'text-[var(--status-poor)]'
                                  : session.dayCondition === 'Warm'
                                    ? 'text-[var(--text-primary)]'
                                    : 'text-[var(--status-good)]'
                              }`}
                            >
                              {session.dayCondition === 'Hot' ? (
                                <Flame className="w-3 h-3" aria-hidden="true" />
                              ) : null}
                              <span>
                                {session.dayCondition === 'Cool'
                                  ? 'Cool (<30°C)'
                                  : session.dayCondition === 'Warm'
                                    ? 'Warm (30–40°C)'
                                    : 'Hot (>40°C)'}
                              </span>
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteSession(session.id)}
                              aria-label={`Delete session on ${session.date}`}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-secondary)] hover:text-[var(--status-poor)] hover:bg-[var(--status-poor-bg)] transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
