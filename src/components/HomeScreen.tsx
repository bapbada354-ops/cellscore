import { motion } from 'motion/react';
import {
  Activity,
  ArrowRight,
  Car,
  ExternalLink,
  Gauge,
  Landmark,
  Shield,
  ShieldCheck,
  TrendingUp,
  Truck,
} from 'lucide-react';
import {
  CONFIG,
  calculateBatteryScore,
  formatINR,
  formatIndianNumber,
} from '../config/modelConfig';
import { ScoreGauge } from './ScoreGauge';

interface HomeScreenProps {
  onNavigate: (tab: 'score' | 'compare' | 'lender') => void;
}

const REVEAL_TRANSITION = {
  duration: 0.5,
  ease: [0.16, 1, 0.3, 1] as const,
};

const HOW_IT_WORKS_STEPS = [
  {
    step: '01',
    title: 'Track',
    description: 'Collect usage data across charge cycles, thermal exposure, fast charging, and deep discharges.',
    Icon: Activity,
  },
  {
    step: '02',
    title: 'Score',
    description: 'Compute a 0–100 health score, remaining pack life, and rupee residual value.',
    Icon: Gauge,
  },
  {
    step: '03',
    title: 'Decide',
    description: 'Set loan terms, LTV ceilings, and insurance pricing in seconds.',
    Icon: ShieldCheck,
  },
];

const AUDIENCE_CARDS = [
  {
    title: 'Lenders and NBFCs',
    line: 'Price used EV loans on pack health rather than vehicle age alone.',
    Icon: Landmark,
  },
  {
    title: 'Fleet operators',
    line: 'Identify abusive charging and heat wear before packs fail on route.',
    Icon: Truck,
  },
  {
    title: 'Insurers',
    line: 'Flag high-risk batteries for surcharges or physical inspection upfront.',
    Icon: Shield,
  },
  {
    title: 'Used-EV dealers',
    line: 'Back resale quotes with an auditable Battery Passport for every vehicle.',
    Icon: Car,
  },
];

const WHY_NOW_TIMELINE = [
  'Jun 2022: NITI Aayog and ADB report on EV financing flags missing battery-health traceability and certification standards.',
  'Mar 2025: NBFC lobby (FIDC) tells NITI Aayog that the lack of standardised battery life assessment is an EV financing bottleneck.',
  'Jul 2025: NITI Aayog begins deliberating a national Battery Passport.',
  '30 Dec 2025: Road transport ministry releases DRAFT Battery Pack Aadhaar guidelines (21-character ID plus QR code on each pack, covering two- and three-wheelers).',
  '2026: Industry reports note no universally accepted standard to certify EV battery health for resale.',
  "Oct 2026: Honda's India unit says it is studying used electric two-wheeler resale values and battery health.",
];

const EVIDENCE_CARDS = [
  {
    title: 'Government',
    headline:
      'Draft Battery Pack Aadhaar guidelines propose a 21-character ID and QR code on each two- and three-wheeler pack.',
    url: 'https://mercomindia.com/government-proposes-aadhaar-style-id-to-enable-end-to-end-battery-traceability',
    Icon: ShieldCheck,
  },
  {
    title: 'Lenders',
    headline:
      'NBFCs flag the lack of standardised battery life assessment as a key EV financing bottleneck.',
    url: 'https://www.outlookbusiness.com/industry/decoding-the-hidden-credit-risk-in-indias-ev-transition',
    Icon: Landmark,
  },
  {
    title: 'Market',
    headline:
      'Electric two-wheeler registrations hit 11.79 lakh in Jan-Jul 2026, up 58.8% year on year (VAHAN data via Autocar Professional).',
    url: 'https://www.autocarpro.in/news/exclusive-honda-assessing-used-e2w-market-eyes-threeyear-horizon-135325',
    Icon: TrendingUp,
  },
];

export function HomeScreen({ onNavigate }: HomeScreenProps) {
  const resultA = calculateBatteryScore({
    vehicleType: CONFIG.COMPARE_BASELINE.vehicleType,
    chemistry: CONFIG.COMPARE_BASELINE.chemistry,
    ageMonths: CONFIG.COMPARE_BASELINE.ageMonths,
    cycles: CONFIG.COMPARE_BASELINE.cycles,
    fastChargePct: CONFIG.COMPARE_BASELINE.scooterA.fastChargePct,
    heatAbove40CPct: CONFIG.COMPARE_BASELINE.scooterA.heatAbove40CPct,
    deepDischargePct: CONFIG.COMPARE_BASELINE.scooterA.deepDischargePct,
  });

  const resultB = calculateBatteryScore({
    vehicleType: CONFIG.COMPARE_BASELINE.vehicleType,
    chemistry: CONFIG.COMPARE_BASELINE.chemistry,
    ageMonths: CONFIG.COMPARE_BASELINE.ageMonths,
    cycles: CONFIG.COMPARE_BASELINE.cycles,
    fastChargePct: CONFIG.COMPARE_BASELINE.scooterB.fastChargePct,
    heatAbove40CPct: CONFIG.COMPARE_BASELINE.scooterB.heatAbove40CPct,
    deepDischargePct: CONFIG.COMPARE_BASELINE.scooterB.deepDischargePct,
  });

  return (
    <div className="space-y-16 sm:space-y-24 pb-6">
      {/* 1. HERO */}
      <section aria-label="Hero" className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center pt-2 sm:pt-6">
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-4">
            <p className="text-[12px] uppercase tracking-[0.14em] text-[var(--text-secondary)] font-medium">
              Second-Hand EV Battery Underwriting
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-[56px] font-bold leading-[1.06] tracking-[-0.03em] text-balance bg-gradient-to-r from-[var(--hero-grad-from)] via-[var(--hero-grad-via)] to-[var(--hero-grad-to)] bg-clip-text text-transparent">
              The credit score for EV batteries.
            </h1>
            <p className="text-base sm:text-lg text-[var(--text-secondary)] max-w-xl leading-relaxed">
              Know what a used battery is really worth. In seconds.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3.5 pt-1">
            <button
              type="button"
              onClick={() => onNavigate('compare')}
              className="h-11 px-6 rounded-xl cs-cta-primary font-display font-semibold text-sm inline-flex items-center gap-2 hover:opacity-95 active:scale-[0.99] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)] whitespace-nowrap cursor-pointer"
            >
              <span>See the demo</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('score')}
              className="h-11 px-6 rounded-xl bg-[var(--surface-control)] border border-[var(--border-control)] text-[var(--text-primary)] font-display font-semibold text-sm inline-flex items-center gap-2 hover:bg-[var(--surface-control-hover)] hover:border-[var(--border-strong)] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60 whitespace-nowrap cursor-pointer"
            >
              <span>Try the scorer</span>
            </button>
          </div>
        </div>

        {/* Floating Glass Card: Live Scooter A vs Scooter B Mini Gauges */}
        <div className="lg:col-span-5">
          <div className="cs-float glass-card p-5 sm:p-6 space-y-5 relative">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-medium">
                Live Model Preview
              </span>
              <span className="text-xs text-[var(--text-secondary)] tabular-nums">
                {CONFIG.COMPARE_BASELINE.chemistry} · {CONFIG.COMPARE_BASELINE.ageMonths} mo ·{' '}
                {formatIndianNumber(CONFIG.COMPARE_BASELINE.approxKm)} km
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              {/* Mini Scooter A */}
              <div className="glass-tile p-3.5 flex flex-col items-center text-center space-y-2">
                <span className="text-xs font-medium text-[var(--text-primary)]">Scooter A</span>
                <ScoreGauge score={resultA.score} band={resultA.band} size="mini" />
                <div className="pt-1 space-y-0.5">
                  <p className="font-display text-sm font-semibold text-[var(--text-primary)] tabular-nums">
                    {formatINR(resultA.residualValueInr)}
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)] tabular-nums">
                    {resultA.remainingLifePct}% life · Gentle
                  </p>
                </div>
              </div>

              {/* Mini Scooter B */}
              <div className="glass-tile p-3.5 flex flex-col items-center text-center space-y-2">
                <span className="text-xs font-medium text-[var(--text-primary)]">Scooter B</span>
                <ScoreGauge score={resultB.score} band={resultB.band} size="mini" />
                <div className="pt-1 space-y-0.5">
                  <p className="font-display text-sm font-semibold text-[var(--text-primary)] tabular-nums">
                    {formatINR(resultB.residualValueInr)}
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)] tabular-nums">
                    {resultB.remainingLifePct}% life · Hard-use
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)] text-xs">
              <span className="text-[var(--text-secondary)]">Value gap from habits alone</span>
              <span className="font-display font-semibold text-[var(--accent-mint)] tabular-nums">
                {formatINR(Math.abs(resultA.residualValueInr - resultB.residualValueInr))}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. PROBLEM STRIP */}
      <motion.section
        aria-label="The problem"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={REVEAL_TRANSITION}
        className="glass-card p-6 sm:p-8"
      >
        <div className="max-w-3xl space-y-2.5">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] tracking-tight text-balance">
            Same age. Same kilometres. Very different batteries.
          </h2>
          <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
            Odometer readings and registration dates cannot reveal heat exposure, fast-charging
            stress, or deep discharges inside a used pack. Because lenders cannot see true battery
            health, they either decline creditworthy riders or overcharge everyone to cover hidden
            degradation.
          </p>
        </div>
      </motion.section>

      {/* 3. HOW IT WORKS */}
      <motion.section
        aria-label="How it works"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={REVEAL_TRANSITION}
        className="space-y-6"
      >
        <div className="space-y-1">
          <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-medium">
            How It Works
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--text-primary)]">
            From usage signals to underwriting in three steps
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {HOW_IT_WORKS_STEPS.map(({ step, title, description, Icon }, idx) => (
            <div key={step} className="glass-card glass-card-interactive p-6 space-y-4 relative">
              <div className="flex items-center justify-between">
                <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--active-tab-from)] to-[var(--active-tab-to)] border border-[var(--status-good-border)] flex items-center justify-center text-[var(--accent-mint)]">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </span>
                <span className="font-display text-xs font-semibold text-[var(--text-secondary)] tabular-nums">
                  {step}
                  {idx < HOW_IT_WORKS_STEPS.length - 1 ? ' →' : ''}
                </span>
              </div>
              <div className="space-y-1.5">
                <h3 className="font-display text-xl font-semibold text-[var(--text-primary)]">{title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* 4. WHO IT'S FOR */}
      <motion.section
        aria-label="Who it is for"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={REVEAL_TRANSITION}
        className="space-y-6"
      >
        <div className="space-y-1">
          <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-medium">
            Who It&apos;s For
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--text-primary)]">
            Built for India&apos;s used EV ecosystem
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {AUDIENCE_CARDS.map(({ title, line, Icon }) => (
            <div key={title} className="glass-card glass-card-interactive p-5 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--surface-control)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--accent-cyan)]">
                <Icon className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-base font-semibold text-[var(--text-primary)]">{title}</h3>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">{line}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* 5. WHY NOW */}
      <motion.section
        aria-label="Why now"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={REVEAL_TRANSITION}
        className="space-y-6"
      >
        <div className="space-y-1">
          <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-medium">
            Why Now
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--text-primary)]">
            Policy, lending, and resale signals
          </h2>
        </div>

        {/* a) Timeline */}
        <div className="glass-card p-6 sm:p-8">
          <ol className="relative border-l border-[var(--border-control)] ml-2 space-y-5">
            {WHY_NOW_TIMELINE.map((entry) => {
              const colonIdx = entry.indexOf(':');
              const datePart = colonIdx > -1 ? entry.slice(0, colonIdx) : '';
              const bodyPart = colonIdx > -1 ? entry.slice(colonIdx + 1) : entry;
              return (
                <li key={entry} className="pl-6 relative">
                  <span
                    aria-hidden="true"
                    className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-[var(--accent-mint)] border-2 border-[var(--bg-canvas)]"
                  />
                  <p className="text-sm text-[var(--text-primary)]/90 leading-relaxed">
                    <span className="font-display font-semibold text-[var(--text-primary)]">{datePart}:</span>
                    {bodyPart}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>

        {/* b) Three Evidence Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {EVIDENCE_CARDS.map(({ title, headline, url, Icon }) => (
            <article
              key={title}
              className="glass-card glass-card-interactive p-6 flex flex-col justify-between space-y-5"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-[var(--surface-control)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--accent-cyan)] shrink-0">
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </span>
                  <h3 className="font-display text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
                </div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{headline}</p>
              </div>

              <div className="pt-3 border-t border-[var(--border-subtle)]">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-mint)] hover:text-[var(--accent-cyan)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60 rounded"
                >
                  <span>Source</span>
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </div>
            </article>
          ))}
        </div>

        {/* c) Draft proposal notice */}
        <p className="text-xs font-medium text-[var(--status-fair)] px-1">
          Note: Battery Pack Aadhaar is a draft proposal, not yet in force.
        </p>

        {/* d) Sources list */}
        <div className="glass-card p-5 sm:p-6 space-y-3">
          <h3 className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-medium">
            Sources
          </h3>
          <ul className="space-y-2 text-xs">
            {EVIDENCE_CARDS.map(({ title, url }) => (
              <li key={url} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span className="font-semibold text-[var(--text-primary)] shrink-0">{title}:</span>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--text-secondary)] hover:text-[var(--accent-mint)] transition-colors underline underline-offset-4 break-all"
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </motion.section>

      {/* 7. FOOTER CTA */}
      <motion.section
        aria-label="Get started"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={REVEAL_TRANSITION}
        className="text-center py-4 space-y-5"
      >
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] text-balance">
          Ready to price a used EV battery?
        </h2>
        <div>
          <button
            type="button"
            onClick={() => onNavigate('score')}
            className="h-12 px-7 rounded-xl cs-cta-primary font-display font-semibold text-sm inline-flex items-center gap-2 hover:opacity-95 active:scale-[0.99] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)] whitespace-nowrap cursor-pointer"
          >
            <span>Score your first battery</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </motion.section>
    </div>
  );
}
