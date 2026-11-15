import { useEffect, useMemo, useState } from 'react';
import { MotionConfig } from 'motion/react';
import {
  BatteryCharging,
  ClipboardList,
  Gauge,
  Home,
  IndianRupee,
  Landmark,
  Moon,
  Scale,
  Sun,
} from 'lucide-react';
import { AskCellScoreDrawer } from './components/AskCellScoreDrawer';
import { AssumptionsModal } from './components/AssumptionsModal';
import { CompareScreen, type CompareHabits } from './components/CompareScreen';
import { HomeScreen } from './components/HomeScreen';
import { LenderScreen, type LenderBatteryKey } from './components/LenderScreen';
import {
  PriceScreen,
  type PriceBatteryKey,
  type PriceRoleMode,
} from './components/PriceScreen';
import { ScoreScreen, type ScoreInputSource } from './components/ScoreScreen';
import { TrackScreen, type BatteryLogState } from './components/TrackScreen';
import {
  buildAssistantSharedState,
  type ClimateLocationReading,
} from './config/assistantEngine';
import {
  CONFIG,
  clamp,
  type BatteryInput,
  type Chemistry,
  type VehicleType,
} from './config/modelConfig';

type TabKey = 'home' | 'score' | 'compare' | 'lender' | 'price' | 'track';
type ThemeMode = 'dark' | 'light';

const THEME_STORAGE_KEY = 'cellscore-theme';

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // ignore storage access issues
  }
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

interface InitialUrlState {
  tab: TabKey;
  batteryKey: LenderBatteryKey;
  loanAmountInr: number;
  tenureMonths: number;
  customInput?: BatteryInput;
}

function parseInitialUrlState(): InitialUrlState {
  const defaultInput: BatteryInput = {
    vehicleType: CONFIG.SAMPLE_BATTERIES[0].vehicleType,
    chemistry: CONFIG.SAMPLE_BATTERIES[0].chemistry,
    ageMonths: CONFIG.SAMPLE_BATTERIES[0].ageMonths,
    cycles: CONFIG.SAMPLE_BATTERIES[0].cycles,
    fastChargePct: CONFIG.SAMPLE_BATTERIES[0].fastChargePct,
    heatAbove40CPct: CONFIG.SAMPLE_BATTERIES[0].heatAbove40CPct,
    deepDischargePct: CONFIG.SAMPLE_BATTERIES[0].deepDischargePct,
  };

  if (typeof window === 'undefined') {
    return {
      tab: 'home',
      batteryKey: 'scooter-a',
      loanAmountInr: CONFIG.SLIDER_BOUNDS.loanAmountInr.default,
      tenureMonths: CONFIG.SLIDER_BOUNDS.tenureMonths.default,
      customInput: defaultInput,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get('tab');
  const tab: TabKey =
    tabParam === 'compare' ||
    tabParam === 'lender' ||
    tabParam === 'price' ||
    tabParam === 'score' ||
    tabParam === 'home' ||
    tabParam === 'track'
      ? tabParam
      : 'home';

  const batteryParam = params.get('battery');
  const batteryKey: LenderBatteryKey =
    batteryParam === 'scooter-a' || batteryParam === 'scooter-b' || batteryParam === 'custom'
      ? batteryParam
      : 'scooter-a';

  const loanRaw = Number(params.get('loan'));
  const loanAmountInr = Number.isFinite(loanRaw) && loanRaw > 0
    ? clamp(
        loanRaw,
        CONFIG.SLIDER_BOUNDS.loanAmountInr.min,
        CONFIG.SLIDER_BOUNDS.loanAmountInr.max,
      )
    : CONFIG.SLIDER_BOUNDS.loanAmountInr.default;

  const tenureRaw = Number(params.get('tenure'));
  const tenureMonths = Number.isFinite(tenureRaw) && tenureRaw > 0
    ? clamp(
        tenureRaw,
        CONFIG.SLIDER_BOUNDS.tenureMonths.min,
        CONFIG.SLIDER_BOUNDS.tenureMonths.max,
      )
    : CONFIG.SLIDER_BOUNDS.tenureMonths.default;

  let customInput = defaultInput;
  if (batteryKey === 'custom' && params.has('age')) {
    const vt = params.get('vt') === '3W' ? ('3W' as VehicleType) : ('2W' as VehicleType);
    const chem = params.get('chem') === 'NMC' ? ('NMC' as Chemistry) : ('LFP' as Chemistry);
    customInput = {
      vehicleType: vt,
      chemistry: chem,
      ageMonths: clamp(
        Number(params.get('age')) || defaultInput.ageMonths,
        CONFIG.SLIDER_BOUNDS.ageMonths.min,
        CONFIG.SLIDER_BOUNDS.ageMonths.max,
      ),
      cycles: clamp(
        Number(params.get('cyc')) || defaultInput.cycles,
        CONFIG.SLIDER_BOUNDS.cycles.min,
        CONFIG.SLIDER_BOUNDS.cycles.max,
      ),
      fastChargePct: clamp(Number(params.get('fast')) || 0, 0, 100),
      heatAbove40CPct: clamp(Number(params.get('heat')) || 0, 0, 100),
      deepDischargePct: clamp(Number(params.get('deep')) || 0, 0, 100),
    };
  }

  return { tab, batteryKey, loanAmountInr, tenureMonths, customInput };
}

const TABS: Array<{ key: TabKey; label: string; Icon: typeof Gauge }> = [
  { key: 'home', label: 'Home', Icon: Home },
  { key: 'score', label: 'Score', Icon: Gauge },
  { key: 'compare', label: 'Compare', Icon: Scale },
  { key: 'lender', label: 'Lender', Icon: Landmark },
  { key: 'price', label: 'Price', Icon: IndianRupee },
  { key: 'track', label: 'Track', Icon: ClipboardList },
];

export default function App() {
  const initialState = useMemo(() => parseInitialUrlState(), []);

  const [activeTab, setActiveTab] = useState<TabKey>(initialState.tab);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore storage access issues
    }
  }, [theme]);

  // Screen 1: Score state
  const [selectedSampleId, setSelectedSampleId] = useState<string>(
    initialState.batteryKey === 'custom' && initialState.customInput
      ? 'custom'
      : CONFIG.SAMPLE_BATTERIES[0].id,
  );
  const [scoreInput, setScoreInput] = useState<BatteryInput>(
    initialState.customInput ?? {
      vehicleType: CONFIG.SAMPLE_BATTERIES[0].vehicleType,
      chemistry: CONFIG.SAMPLE_BATTERIES[0].chemistry,
      ageMonths: CONFIG.SAMPLE_BATTERIES[0].ageMonths,
      cycles: CONFIG.SAMPLE_BATTERIES[0].cycles,
      fastChargePct: CONFIG.SAMPLE_BATTERIES[0].fastChargePct,
      heatAbove40CPct: CONFIG.SAMPLE_BATTERIES[0].heatAbove40CPct,
      deepDischargePct: CONFIG.SAMPLE_BATTERIES[0].deepDischargePct,
    },
  );

  const [scoreInputSource, setScoreInputSource] = useState<ScoreInputSource>(
    initialState.batteryKey === 'custom' && initialState.customInput ? 'Manual' : 'Sample',
  );

  // Screen 2: Compare state
  const [habitsA, setHabitsA] = useState<CompareHabits>({
    fastChargePct: CONFIG.COMPARE_BASELINE.scooterA.fastChargePct,
    heatAbove40CPct: CONFIG.COMPARE_BASELINE.scooterA.heatAbove40CPct,
    deepDischargePct: CONFIG.COMPARE_BASELINE.scooterA.deepDischargePct,
  });
  const [habitsB, setHabitsB] = useState<CompareHabits>({
    fastChargePct: CONFIG.COMPARE_BASELINE.scooterB.fastChargePct,
    heatAbove40CPct: CONFIG.COMPARE_BASELINE.scooterB.heatAbove40CPct,
    deepDischargePct: CONFIG.COMPARE_BASELINE.scooterB.deepDischargePct,
  });

  // Screen 3: Lender state
  const [lenderBatteryKey, setLenderBatteryKey] = useState<LenderBatteryKey>(
    initialState.batteryKey,
  );
  const [loanAmountInr, setLoanAmountInr] = useState<number>(initialState.loanAmountInr);
  const [tenureMonths, setTenureMonths] = useState<number>(initialState.tenureMonths);

  // Screen 4: Price state (defaults to Scooter A)
  const [priceBatteryKey, setPriceBatteryKey] = useState<PriceBatteryKey>('scooter-a');
  const [askingPriceInr, setAskingPriceInr] = useState<number>(
    CONFIG.SLIDER_BOUNDS.askingPriceInr.default,
  );
  const [priceRoleMode, setPriceRoleMode] = useState<PriceRoleMode>('buyer');
  const [hasEvaluatedPrice, setHasEvaluatedPrice] = useState<boolean>(
    initialState.tab === 'price',
  );

  // Screen 5: Track (Battery Log) in-memory state — starts empty by default
  const [batteryLogState, setBatteryLogState] = useState<BatteryLogState>({
    manufactureDate: '',
    priorCycles: 500,
    sessions: [],
  });

  // Google Maps climate & temperature calibration state shared across Score and Ask CellScore
  const [climateReading, setClimateReading] = useState<ClimateLocationReading | null>(null);

  // Server AI health check: defaults to false until confirmed configured
  const [aiConfigured, setAiConfigured] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 5000);

    fetch('/api/health', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { aiConfigured?: unknown } | null) => {
        if (!cancelled) {
          setAiConfigured(data?.aiConfigured === true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAiConfigured(false);
        }
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  const handleScoreInputChange = (next: BatteryInput) => {
    setScoreInput(next);
    setSelectedSampleId('custom');
    setScoreInputSource('Manual');
  };

  const handleSelectSample = (sampleId: string) => {
    setSelectedSampleId(sampleId);
    const match = CONFIG.SAMPLE_BATTERIES.find((s) => s.id === sampleId);
    if (!match) {
      setScoreInputSource('Manual');
      return;
    }
    setScoreInputSource('Sample');
    setScoreInput({
      vehicleType: match.vehicleType,
      chemistry: match.chemistry,
      ageMonths: match.ageMonths,
      cycles: match.cycles,
      fastChargePct: match.fastChargePct,
      heatAbove40CPct: match.heatAbove40CPct,
      deepDischargePct: match.deepDischargePct,
    });
  };

  const handleResetCompare = () => {
    setHabitsA({
      fastChargePct: CONFIG.COMPARE_BASELINE.scooterA.fastChargePct,
      heatAbove40CPct: CONFIG.COMPARE_BASELINE.scooterA.heatAbove40CPct,
      deepDischargePct: CONFIG.COMPARE_BASELINE.scooterA.deepDischargePct,
    });
    setHabitsB({
      fastChargePct: CONFIG.COMPARE_BASELINE.scooterB.fastChargePct,
      heatAbove40CPct: CONFIG.COMPARE_BASELINE.scooterB.heatAbove40CPct,
      deepDischargePct: CONFIG.COMPARE_BASELINE.scooterB.deepDischargePct,
    });
  };

  const scooterAInput: BatteryInput = {
    vehicleType: CONFIG.COMPARE_BASELINE.vehicleType,
    chemistry: CONFIG.COMPARE_BASELINE.chemistry,
    ageMonths: CONFIG.COMPARE_BASELINE.ageMonths,
    cycles: CONFIG.COMPARE_BASELINE.cycles,
    ...habitsA,
  };

  const scooterBInput: BatteryInput = {
    vehicleType: CONFIG.COMPARE_BASELINE.vehicleType,
    chemistry: CONFIG.COMPARE_BASELINE.chemistry,
    ageMonths: CONFIG.COMPARE_BASELINE.ageMonths,
    cycles: CONFIG.COMPARE_BASELINE.cycles,
    ...habitsB,
  };

  const handleTabNavigate = (tab: TabKey) => {
    setActiveTab(tab);
    if (tab === 'price') {
      setHasEvaluatedPrice(true);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sharedAssistantState = buildAssistantSharedState({
    activeTab,
    scoreInput,
    scooterAInput,
    scooterBInput,
    lenderBatteryKey,
    loanAmountInr,
    tenureMonths,
    priceBatteryKey,
    askingPriceInr,
    priceRoleMode,
    hasEvaluatedPrice,
    climate: climateReading,
  });

  const handleEvaluateInLender = () => {
    setLenderBatteryKey('custom');
    handleTabNavigate('lender');
  };

  const handleSendFromLogToScore = (
    values: Pick<
      BatteryInput,
      'ageMonths' | 'cycles' | 'fastChargePct' | 'heatAbove40CPct' | 'deepDischargePct'
    >,
  ) => {
    setScoreInput((prev) => ({
      ...prev,
      ...values,
    }));
    setSelectedSampleId('custom');
    setScoreInputSource('From log');
    handleTabNavigate('score');
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="cellscore-backdrop min-h-screen flex flex-col text-[var(--text-primary)] cs-no-print">
        {/* Sticky Top Bar */}
        <header className="sticky top-0 z-40 border-b border-[var(--border-glass)] bg-[var(--bg-header)] backdrop-blur-xl">
          <div className="max-w-[1100px] mx-auto px-4 sm:px-6 h-14 md:h-16 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_auto_1fr] items-center gap-4">
            {/* Left: Brand Logo */}
            <button
              type="button"
              onClick={() => handleTabNavigate('home')}
              className="flex items-center gap-2.5 justify-self-start text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60 rounded-lg py-1 cursor-pointer"
            >
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--active-tab-from)] to-[var(--active-tab-to)] border border-[var(--status-good-border)] flex items-center justify-center text-[var(--accent-mint)]">
                <BatteryCharging className="w-4 h-4" aria-hidden="true" />
              </span>
              <span className="font-display text-lg font-bold tracking-tight text-[var(--text-primary)] whitespace-nowrap">
                CellScore
              </span>
            </button>

            {/* Center: Desktop Pill Tabs */}
            <nav
              aria-label="Primary navigation"
              className="hidden md:flex items-center justify-self-center gap-1.5 p-1 rounded-full bg-[var(--surface-glass)] border border-[var(--border-glass)]"
            >
              {TABS.map(({ key, label }) => {
                const isActive = activeTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleTabNavigate(key)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`relative px-3.5 lg:px-4.5 py-1.5 rounded-full text-sm font-medium transition-colors duration-200 whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60 cursor-pointer ${
                      isActive
                        ? 'bg-[var(--surface-control-hover)] text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {label}
                    {isActive ? (
                      <span
                        aria-hidden="true"
                        className="absolute left-3.5 right-3.5 -bottom-[1px] h-[2px] rounded-full bg-gradient-to-r from-[var(--cta-from)] to-[var(--cta-to)]"
                      />
                    ) : null}
                  </button>
                );
              })}
            </nav>

            {/* Top Right: Moon / Sun Theme Toggle */}
            <div className="justify-self-end flex items-center">
              <div
                role="group"
                aria-label="Theme preference"
                className="inline-flex items-center p-0.5 rounded-full bg-[var(--surface-control)] border border-[var(--border-control)]"
              >
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  aria-pressed={theme === 'dark'}
                  aria-label="Dark theme"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60 ${
                    theme === 'dark'
                      ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Dark</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  aria-pressed={theme === 'light'}
                  aria-label="Light theme"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60 ${
                    theme === 'light'
                      ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Light</span>
                </button>
              </div>
            </div>
          </div>
        </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1100px] mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-8">
        {activeTab === 'home' ? (
          <HomeScreen onNavigate={(tab) => handleTabNavigate(tab)} />
        ) : null}

        {activeTab === 'score' ? (
          <ScoreScreen
            input={scoreInput}
            selectedSampleId={selectedSampleId}
            inputSource={scoreInputSource}
            onChangeInput={handleScoreInputChange}
            onSelectSample={handleSelectSample}
            onEvaluateInLender={handleEvaluateInLender}
            climateReading={climateReading}
            onClimateReadingChange={setClimateReading}
            aiConfigured={aiConfigured}
          />
        ) : null}

        {activeTab === 'compare' ? (
          <CompareScreen
            habitsA={habitsA}
            habitsB={habitsB}
            onChangeHabitsA={setHabitsA}
            onChangeHabitsB={setHabitsB}
            onResetHabits={handleResetCompare}
            loanAmountInr={loanAmountInr}
            tenureMonths={tenureMonths}
          />
        ) : null}

        {activeTab === 'lender' ? (
          <LenderScreen
            selectedBatteryKey={lenderBatteryKey}
            onSelectBatteryKey={setLenderBatteryKey}
            scooterAInput={scooterAInput}
            scooterBInput={scooterBInput}
            customInput={scoreInput}
            customInputSource={scoreInputSource}
            loanAmountInr={loanAmountInr}
            tenureMonths={tenureMonths}
            onChangeLoanAmount={setLoanAmountInr}
            onChangeTenure={setTenureMonths}
          />
        ) : null}

        {activeTab === 'price' ? (
          <PriceScreen
            selectedBatteryKey={priceBatteryKey}
            onSelectBatteryKey={(key) => {
              setPriceBatteryKey(key);
              setHasEvaluatedPrice(true);
            }}
            askingPriceInr={askingPriceInr}
            onChangeAskingPrice={(val) => {
              setAskingPriceInr(val);
              setHasEvaluatedPrice(true);
            }}
            roleMode={priceRoleMode}
            onChangeRoleMode={(mode) => {
              setPriceRoleMode(mode);
              setHasEvaluatedPrice(true);
            }}
            customInput={scoreInput}
            scooterAInput={scooterAInput}
            scooterBInput={scooterBInput}
          />
        ) : null}

        {activeTab === 'track' ? (
          <TrackScreen
            logState={batteryLogState}
            onChangeLogState={setBatteryLogState}
            onSendToScore={handleSendFromLogToScore}
          />
        ) : null}
      </main>

      {/* Footer Chip (with bottom padding on mobile for bottom tab bar) */}
      <footer className="w-full max-w-[1100px] mx-auto px-4 sm:px-6 pb-20 md:pb-8 pt-2 flex justify-center">
        <div className="inline-flex flex-wrap items-center justify-center gap-3 px-4 py-2 rounded-2xl sm:rounded-full bg-[var(--surface-glass)] border border-[var(--border-glass)] text-xs text-[var(--text-secondary)]">
          <span>Sample data. Model assumptions pending validation on real batteries.</span>
          <button
            type="button"
            onClick={() => setAssumptionsOpen(true)}
            className="font-semibold text-[var(--accent-mint)] hover:text-[var(--accent-cyan)] transition-colors underline underline-offset-4 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60 rounded cursor-pointer"
          >
            Assumptions
          </button>
        </div>
      </footer>

      {/* Mobile Bottom Tab Bar */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 h-14 border-t border-[var(--border-glass)] bg-[var(--bg-nav-mobile)] backdrop-blur-xl grid grid-cols-6"
      >
        {TABS.map(({ key, label, Icon }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleTabNavigate(key)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-mint)]/60 ${
                isActive ? 'text-[var(--accent-mint)]' : 'text-[var(--text-secondary)]'
              }`}
            >
              {isActive ? (
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-1/4 right-1/4 h-[2px] rounded-full bg-gradient-to-r from-[var(--cta-from)] to-[var(--cta-to)]"
                />
              ) : null}
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span className="truncate max-w-full px-0.5">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Assumptions Modal */}
      <AssumptionsModal open={assumptionsOpen} onClose={() => setAssumptionsOpen(false)} />

      {/* Floating Ask CellScore Assistant */}
      <AskCellScoreDrawer
        sharedState={sharedAssistantState}
        aiConfigured={aiConfigured}
        onClimateReadingChange={setClimateReading}
        onApplyClimateHeatPct={(pct) =>
          handleScoreInputChange({
            ...scoreInput,
            heatAbove40CPct: clamp(pct, 0, 100),
          })
        }
      />
      </div>
    </MotionConfig>
  );
}
