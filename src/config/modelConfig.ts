/**
 * CellScore — Central Model Configuration & Pure Scoring Engine
 *
 * ALL values in `CONFIG` are PLACEHOLDER ASSUMPTIONS pending calibration on real
 * Indian 2W/3W telemetry and field tear-down datasets. Edit `CONFIG` below to tune
 * weights, pack prices, credit bands, or sample presets across the entire app.
 */

export const CONFIG = {
  // PLACEHOLDER ASSUMPTIONS — Rated cycle life until end-of-warranty / 80% SoH threshold
  RATED_CYCLE_LIFE: {
    LFP: 2000,
    NMC: 1000,
  },

  // PLACEHOLDER ASSUMPTIONS — Stress multipliers applied to raw charge cycles
  // effective_cycles = cycles * (1 + heat * 1.0 + fast * 0.6 + deep * 0.5)
  PENALTY_WEIGHTS: {
    heatAbove40C: 1.0,
    fastCharge: 0.6,
    deepDischarge: 0.5,
  },

  // PLACEHOLDER ASSUMPTION — Linear calendar fade per month of pack age (0.25% / month)
  CALENDAR_FADE_PER_MONTH: 0.0025,

  // PLACEHOLDER ASSUMPTIONS — Replacement pack prices in INR (2-Wheeler & 3-Wheeler)
  NEW_PACK_PRICE_INR: {
    '2W': 55000,
    '3W': 110000,
  },

  // PLACEHOLDER ASSUMPTION — Secondary-market resale multiplier on remaining pack life
  RESIDUAL_VALUE_FACTOR: 0.8,

  // PLACEHOLDER ASSUMPTIONS — Vehicle price excluding battery pack, annual body depreciation & fair-price band
  VEHICLE_PRICE_EXCL_PACK_INR: {
    '2W': 75000,
    '3W': 130000,
  },
  BODY_DEPRECIATION_PER_YEAR: 0.15,
  FAIR_PRICE_BAND_PCT: 0.1,

  // PLACEHOLDER ASSUMPTIONS — Credit underwriting base annual interest rate (%)
  BASE_INTEREST_RATE_PCT: 12,

  // PLACEHOLDER ASSUMPTIONS — Credit score bands, LTV limits, risk spreads, and insurance flags
  BANDS: {
    A: {
      key: 'A' as const,
      label: 'Band A',
      tierName: 'Prime',
      minScore: 75,
      maxScore: 100,
      ltvPct: 70,
      rateSpreadPct: 0,
      insuranceFlag: 'Standard' as const,
      tone: 'good' as const,
    },
    B: {
      key: 'B' as const,
      label: 'Band B',
      tierName: 'Standard',
      minScore: 55,
      maxScore: 74,
      ltvPct: 55,
      rateSpreadPct: 2,
      insuranceFlag: 'Standard' as const,
      tone: 'good' as const,
    },
    C: {
      key: 'C' as const,
      label: 'Band C',
      tierName: 'Sub-prime',
      minScore: 35,
      maxScore: 54,
      ltvPct: 40,
      rateSpreadPct: 5,
      insuranceFlag: 'Surcharge' as const,
      tone: 'fair' as const,
    },
    D: {
      key: 'D' as const,
      label: 'Band D',
      tierName: 'High Risk',
      minScore: 0,
      maxScore: 34,
      ltvPct: 0,
      rateSpreadPct: null,
      insuranceFlag: 'Inspection required' as const,
      tone: 'poor' as const,
    },
  },

  // PLACEHOLDER ASSUMPTIONS — Input slider boundaries
  SLIDER_BOUNDS: {
    ageMonths: { min: 0, max: 60, step: 1 },
    cycles: { min: 0, max: 2500, step: 10 },
    sharePct: { min: 0, max: 100, step: 1 },
    loanAmountInr: { min: 10000, max: 150000, step: 1000, default: 12000 },
    tenureMonths: { min: 6, max: 24, step: 1, default: 12 },
    askingPriceInr: { min: 10000, max: 200000, step: 1000, default: 80000 },
  },

  // PLACEHOLDER ASSUMPTIONS — Compare screen baseline vehicle specs & default habits
  // Scooter A scores ~59 (Band B), Scooter B scores ~37 (Band C)
  COMPARE_BASELINE: {
    vehicleType: '2W' as const,
    chemistry: 'LFP' as const,
    ageMonths: 24,
    cycles: 600,
    approxKm: 18000,
    scooterA: {
      id: 'scooter-a',
      title: 'Scooter A: Gentle commuter',
      subtitle: 'Home overnight AC charging, shaded parking',
      fastChargePct: 10,
      heatAbove40CPct: 5,
      deepDischargePct: 10,
    },
    scooterB: {
      id: 'scooter-b',
      title: 'Scooter B: Hard-use delivery',
      subtitle: 'Midday fast top-ups, peak summer heat, deep runs',
      fastChargePct: 55,
      heatAbove40CPct: 40,
      deepDischargePct: 35,
    },
  },

  // PLACEHOLDER ASSUMPTIONS — 5 preset sample batteries for the Score screen
  SAMPLE_BATTERIES: [
    {
      id: 'commuter-lfp',
      name: 'Urban Commuter 2W (LFP · 14 mo)',
      vehicleType: '2W' as const,
      chemistry: 'LFP' as const,
      ageMonths: 14,
      cycles: 280,
      fastChargePct: 12,
      heatAbove40CPct: 8,
      deepDischargePct: 10,
    },
    {
      id: 'gentle-scooter',
      name: 'Gentle Personal Scooter (LFP · 24 mo)',
      vehicleType: '2W' as const,
      chemistry: 'LFP' as const,
      ageMonths: 24,
      cycles: 600,
      fastChargePct: 10,
      heatAbove40CPct: 5,
      deepDischargePct: 10,
    },
    {
      id: 'delivery-fleet-2w',
      name: 'Quick-Commerce Delivery 2W (LFP · 24 mo)',
      vehicleType: '2W' as const,
      chemistry: 'LFP' as const,
      ageMonths: 24,
      cycles: 600,
      fastChargePct: 55,
      heatAbove40CPct: 40,
      deepDischargePct: 35,
    },
    {
      id: 'e-rickshaw-3w',
      name: 'Commercial E-Rickshaw 3W (LFP · 30 mo)',
      vehicleType: '3W' as const,
      chemistry: 'LFP' as const,
      ageMonths: 30,
      cycles: 920,
      fastChargePct: 30,
      heatAbove40CPct: 35,
      deepDischargePct: 45,
    },
    {
      id: 'heat-stressed-nmc',
      name: 'High-Wear Fleet 2W (NMC · 32 mo)',
      vehicleType: '2W' as const,
      chemistry: 'NMC' as const,
      ageMonths: 32,
      cycles: 480,
      fastChargePct: 60,
      heatAbove40CPct: 45,
      deepDischargePct: 30,
    },
  ],

  PASSPORT_PREFIX: 'CS-2026',
  MODEL_DISPLAY_DATE: '14 Nov 2026',
} as const;

export type VehicleType = '2W' | '3W';
export type Chemistry = 'LFP' | 'NMC';
export type BandKey = 'A' | 'B' | 'C' | 'D';
export type StatusTone = 'good' | 'fair' | 'poor';
export type InsuranceFlag = 'Standard' | 'Surcharge' | 'Inspection required';

export interface BatteryInput {
  vehicleType: VehicleType;
  chemistry: Chemistry;
  ageMonths: number;
  cycles: number;
  fastChargePct: number;
  heatAbove40CPct: number;
  deepDischargePct: number;
}

export interface StressorBreakdownItem {
  id: 'heat' | 'fastCharge' | 'deepDischarge' | 'age';
  label: string;
  lifePointsLost: number;
  barWidthPct: number;
  tone: StatusTone;
}

export interface BandInfo {
  key: BandKey;
  label: string;
  tierName: string;
  minScore: number;
  maxScore: number;
  ltvPct: number;
  rateSpreadPct: number | null;
  insuranceFlag: InsuranceFlag;
  tone: StatusTone;
}

export interface ScoreResult {
  score: number;
  remainingLife: number;
  remainingLifePct: number;
  effectiveCycles: number;
  ratedCycleLife: number;
  calendarFade: number;
  newPackPriceInr: number;
  residualValueInr: number;
  band: BandInfo;
  maxLoanInr: number;
  stressors: StressorBreakdownItem[];
}

export type LenderVerdictType = 'Approve' | 'Approve with conditions' | 'Decline';

export interface LenderDecision {
  verdict: LenderVerdictType;
  verdictTone: StatusTone;
  verdictReason: string;
  maxLoanInr: number;
  interestRatePct: number | null;
  monthlyEmiInr: number | null;
  insuranceFlag: InsuranceFlag;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

export function formatINR(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  return `Rs ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(safe)}`;
}

export function formatIndianNumber(num: number): string {
  const safe = Number.isFinite(num) ? Math.round(num) : 0;
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(safe);
}

export function getBandForScore(score: number): BandInfo {
  if (score >= CONFIG.BANDS.A.minScore) return CONFIG.BANDS.A;
  if (score >= CONFIG.BANDS.B.minScore) return CONFIG.BANDS.B;
  if (score >= CONFIG.BANDS.C.minScore) return CONFIG.BANDS.C;
  return CONFIG.BANDS.D;
}

export function calculateBatteryScore(input: BatteryInput): ScoreResult {
  const ratedCycleLife = CONFIG.RATED_CYCLE_LIFE[input.chemistry];
  const heatShare = clamp(input.heatAbove40CPct, 0, 100) / 100;
  const fastShare = clamp(input.fastChargePct, 0, 100) / 100;
  const deepShare = clamp(input.deepDischargePct, 0, 100) / 100;
  const safeCycles = Math.max(0, input.cycles);
  const safeAge = Math.max(0, input.ageMonths);

  const stressMultiplier =
    1 +
    heatShare * CONFIG.PENALTY_WEIGHTS.heatAbove40C +
    fastShare * CONFIG.PENALTY_WEIGHTS.fastCharge +
    deepShare * CONFIG.PENALTY_WEIGHTS.deepDischarge;

  const effectiveCycles = safeCycles * stressMultiplier;
  const calendarFade = safeAge * CONFIG.CALENDAR_FADE_PER_MONTH;

  const remainingLife = clamp(1 - effectiveCycles / ratedCycleLife - calendarFade, 0, 1);
  const score = Math.round(remainingLife * 100);
  const remainingLifePct = Math.round(remainingLife * 100);

  const newPackPriceInr = CONFIG.NEW_PACK_PRICE_INR[input.vehicleType];
  const residualValueInr = Math.round(
    newPackPriceInr * remainingLife * CONFIG.RESIDUAL_VALUE_FACTOR,
  );

  const band = getBandForScore(score);
  const maxLoanInr = Math.round(residualValueInr * (band.ltvPct / 100));

  // Individual life points lost (0-100 scale) for the 4 tracked drivers
  const heatPts = ((safeCycles * heatShare * CONFIG.PENALTY_WEIGHTS.heatAbove40C) / ratedCycleLife) * 100;
  const fastPts = ((safeCycles * fastShare * CONFIG.PENALTY_WEIGHTS.fastCharge) / ratedCycleLife) * 100;
  const deepPts = ((safeCycles * deepShare * CONFIG.PENALTY_WEIGHTS.deepDischarge) / ratedCycleLife) * 100;
  const agePts = calendarFade * 100;

  const maxPts = Math.max(heatPts, fastPts, deepPts, agePts, 1);
  const rawStressors: Array<Omit<StressorBreakdownItem, 'barWidthPct'>> = [
    {
      id: 'heat',
      label: 'Heat (>40°C)',
      lifePointsLost: heatPts,
      tone: heatPts >= 12 ? 'poor' : heatPts >= 5 ? 'fair' : 'good',
    },
    {
      id: 'fastCharge',
      label: 'Fast charging',
      lifePointsLost: fastPts,
      tone: fastPts >= 12 ? 'poor' : fastPts >= 5 ? 'fair' : 'good',
    },
    {
      id: 'deepDischarge',
      label: 'Deep discharge',
      lifePointsLost: deepPts,
      tone: deepPts >= 10 ? 'poor' : deepPts >= 4 ? 'fair' : 'good',
    },
    {
      id: 'age',
      label: 'Calendar age',
      lifePointsLost: agePts,
      tone: agePts >= 10 ? 'poor' : agePts >= 5 ? 'fair' : 'good',
    },
  ];

  const stressors: StressorBreakdownItem[] = rawStressors
    .map((item) => ({
      ...item,
      barWidthPct: item.lifePointsLost <= 0 ? 0 : Math.max(4, (item.lifePointsLost / maxPts) * 100),
    }))
    .sort((a, b) => b.lifePointsLost - a.lifePointsLost);

  return {
    score,
    remainingLife,
    remainingLifePct,
    effectiveCycles,
    ratedCycleLife,
    calendarFade,
    newPackPriceInr,
    residualValueInr,
    band,
    maxLoanInr,
    stressors,
  };
}

export function calculateLenderDecision(
  scoreResult: ScoreResult,
  loanAmountInr: number,
  tenureMonths: number,
): LenderDecision {
  const { band, maxLoanInr } = scoreResult;
  const safeLoan = Math.max(0, loanAmountInr);
  const safeTenure = Math.max(1, tenureMonths);

  if (band.key === 'D' || band.rateSpreadPct === null) {
    return {
      verdict: 'Decline',
      verdictTone: 'poor',
      verdictReason: `Score ${scoreResult.score} falls in Band D (below ${CONFIG.BANDS.C.minScore}); pack requires physical inspection before financing.`,
      maxLoanInr: 0,
      interestRatePct: null,
      monthlyEmiInr: null,
      insuranceFlag: band.insuranceFlag,
    };
  }

  const interestRatePct = CONFIG.BASE_INTEREST_RATE_PCT + band.rateSpreadPct;
  const monthlyRate = interestRatePct / 100 / 12;
  let monthlyEmiInr: number;
  if (monthlyRate === 0) {
    monthlyEmiInr = Math.round(safeLoan / safeTenure);
  } else {
    const factor = Math.pow(1 + monthlyRate, safeTenure);
    monthlyEmiInr = Math.round((safeLoan * monthlyRate * factor) / (factor - 1));
  }

  if (safeLoan > maxLoanInr) {
    return {
      verdict: 'Decline',
      verdictTone: 'poor',
      verdictReason: `Requested loan (${formatINR(safeLoan)}) exceeds ${band.ltvPct}% LTV ceiling of ${formatINR(maxLoanInr)}.`,
      maxLoanInr,
      interestRatePct: null,
      monthlyEmiInr: null,
      insuranceFlag: band.insuranceFlag,
    };
  }

  if (band.key === 'C') {
    return {
      verdict: 'Approve with conditions',
      verdictTone: 'fair',
      verdictReason: `Band C pack eligible up to ${formatINR(maxLoanInr)} with +${band.rateSpreadPct}% risk spread and insurance surcharge.`,
      maxLoanInr,
      interestRatePct,
      monthlyEmiInr,
      insuranceFlag: band.insuranceFlag,
    };
  }

  return {
    verdict: 'Approve',
    verdictTone: 'good',
    verdictReason: `${band.label} (${band.tierName}) pack qualifies within ${band.ltvPct}% LTV ceiling at ${interestRatePct.toFixed(1)}% p.a.`,
    maxLoanInr,
    interestRatePct,
    monthlyEmiInr,
    insuranceFlag: band.insuranceFlag,
  };
}

export type PriceVerdictLabel = 'Bargain' | 'Fair' | 'Overpriced' | 'Way overpriced';

export interface FairPriceResult {
  bodyValueInr: number;
  batteryValueInr: number;
  fairValueInr: number;
  rangeLowInr: number;
  rangeHighInr: number;
  ratio: number;
  verdict: PriceVerdictLabel;
  verdictTone: 'bargain' | 'fair' | 'overpriced' | 'way-overpriced';
  scoreResult: ScoreResult;
}

export function calculateVehicleFairPrice(
  input: BatteryInput,
  askingPriceInr: number,
): FairPriceResult {
  const scoreResult = calculateBatteryScore(input);
  const batteryValueInr = scoreResult.residualValueInr;

  const baseBodyPrice = CONFIG.VEHICLE_PRICE_EXCL_PACK_INR[input.vehicleType];
  const ageYears = Math.max(0, input.ageMonths) / 12;
  const bodyValueInr = Math.round(
    baseBodyPrice * Math.pow(1 - CONFIG.BODY_DEPRECIATION_PER_YEAR, ageYears),
  );

  const fairValueInr = bodyValueInr + batteryValueInr;
  const rangeLowInr = Math.round(fairValueInr * (1 - CONFIG.FAIR_PRICE_BAND_PCT));
  const rangeHighInr = Math.round(fairValueInr * (1 + CONFIG.FAIR_PRICE_BAND_PCT));

  const safeAsk = Number.isFinite(askingPriceInr) && askingPriceInr > 0 ? askingPriceInr : 0;
  const ratio = fairValueInr > 0 ? safeAsk / fairValueInr : 0;

  let verdict: PriceVerdictLabel = 'Fair';
  let verdictTone: FairPriceResult['verdictTone'] = 'fair';

  if (ratio < 0.9) {
    verdict = 'Bargain';
    verdictTone = 'bargain';
  } else if (ratio <= 1.1) {
    verdict = 'Fair';
    verdictTone = 'fair';
  } else if (ratio <= 1.25) {
    verdict = 'Overpriced';
    verdictTone = 'overpriced';
  } else {
    verdict = 'Way overpriced';
    verdictTone = 'way-overpriced';
  }

  return {
    bodyValueInr,
    batteryValueInr,
    fairValueInr,
    rangeLowInr,
    rangeHighInr,
    ratio,
    verdict,
    verdictTone,
    scoreResult,
  };
}
