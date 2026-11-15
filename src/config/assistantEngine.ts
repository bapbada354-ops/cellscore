import {
  CONFIG,
  calculateBatteryScore,
  calculateLenderDecision,
  calculateVehicleFairPrice,
  formatINR,
  type BatteryInput,
  type FairPriceResult,
  type LenderDecision,
  type ScoreResult,
} from './modelConfig';

export type AssistantTabKey = 'home' | 'score' | 'compare' | 'lender' | 'price' | 'track';

export interface GroundedMapLink {
  title: string;
  uri: string;
  snippets: Array<{ text: string; uri?: string }>;
}

export interface ClimateLocationReading {
  locationName: string;
  climateProfile: string;
  peakTempRangeC: string;
  suggestedHeatPct: number;
  chargingAdvice: string;
  summary: string;
  mapLinks: GroundedMapLink[];
  latitude?: number | null;
  longitude?: number | null;
  updatedAt?: string;
}

export type AssistantChipId =
  | 'why-score'
  | 'raise-score'
  | 'what-band'
  | 'loan-decision'
  | 'price-fair'
  | 'aadhaar'
  | 'accuracy'
  | 'climate';

export interface AssistantChip {
  id: AssistantChipId;
  label: string;
}

export interface AssistantSharedState {
  activeTab: AssistantTabKey;
  activeBatteryLabel: string;
  input: BatteryInput;
  scoreResult: ScoreResult;
  compare: {
    scooterA: { label: string; input: BatteryInput; scoreResult: ScoreResult };
    scooterB: { label: string; input: BatteryInput; scoreResult: ScoreResult };
    valueGapInr: number;
    lifeGapPct: number;
  };
  lender: {
    batteryLabel: string;
    loanAmountInr: number;
    tenureMonths: number;
    scoreResult: ScoreResult;
    decision: LenderDecision;
  };
  price: {
    hasEvaluated: boolean;
    batteryLabel: string;
    askingPriceInr: number;
    roleMode: 'buyer' | 'seller';
    result: FairPriceResult;
  };
  climate?: ClimateLocationReading | null;
}

export function buildAssistantSharedState(params: {
  activeTab: AssistantTabKey;
  scoreInput: BatteryInput;
  scooterAInput: BatteryInput;
  scooterBInput: BatteryInput;
  lenderBatteryKey: 'scooter-a' | 'scooter-b' | 'custom';
  loanAmountInr: number;
  tenureMonths: number;
  priceBatteryKey: 'custom' | 'scooter-a' | 'scooter-b';
  askingPriceInr: number;
  priceRoleMode: 'buyer' | 'seller';
  hasEvaluatedPrice: boolean;
  climate?: ClimateLocationReading | null;
}): AssistantSharedState {
  const scoreRes = calculateBatteryScore(params.scoreInput);
  const resA = calculateBatteryScore(params.scooterAInput);
  const resB = calculateBatteryScore(params.scooterBInput);

  const lenderInput =
    params.lenderBatteryKey === 'scooter-a'
      ? params.scooterAInput
      : params.lenderBatteryKey === 'scooter-b'
        ? params.scooterBInput
        : params.scoreInput;
  const lenderScoreResult =
    params.lenderBatteryKey === 'scooter-a'
      ? resA
      : params.lenderBatteryKey === 'scooter-b'
        ? resB
        : scoreRes;
  const lenderBatteryLabel =
    params.lenderBatteryKey === 'scooter-a'
      ? CONFIG.COMPARE_BASELINE.scooterA.title
      : params.lenderBatteryKey === 'scooter-b'
        ? CONFIG.COMPARE_BASELINE.scooterB.title
        : 'Custom (from Score)';
  const lenderDecision = calculateLenderDecision(
    lenderScoreResult,
    params.loanAmountInr,
    params.tenureMonths,
  );

  const priceInput =
    params.priceBatteryKey === 'scooter-a'
      ? params.scooterAInput
      : params.priceBatteryKey === 'scooter-b'
        ? params.scooterBInput
        : params.scoreInput;
  const priceBatteryLabel =
    params.priceBatteryKey === 'scooter-a'
      ? CONFIG.COMPARE_BASELINE.scooterA.title
      : params.priceBatteryKey === 'scooter-b'
        ? CONFIG.COMPARE_BASELINE.scooterB.title
        : 'Current Score inputs';
  const priceResult = calculateVehicleFairPrice(priceInput, params.askingPriceInr);

  // Determine the primary battery currently in focus on the user's active screen
  let activeBatteryLabel = 'Current Score battery';
  let activeInput = params.scoreInput;
  let activeScoreResult = scoreRes;

  if (params.activeTab === 'compare') {
    activeBatteryLabel = CONFIG.COMPARE_BASELINE.scooterA.title;
    activeInput = params.scooterAInput;
    activeScoreResult = resA;
  } else if (params.activeTab === 'lender') {
    activeBatteryLabel = lenderBatteryLabel;
    activeInput = lenderInput;
    activeScoreResult = lenderScoreResult;
  } else if (params.activeTab === 'price') {
    activeBatteryLabel = priceBatteryLabel;
    activeInput = priceInput;
    activeScoreResult = priceResult.scoreResult;
  }

  return {
    activeTab: params.activeTab,
    activeBatteryLabel,
    input: activeInput,
    scoreResult: activeScoreResult,
    compare: {
      scooterA: {
        label: CONFIG.COMPARE_BASELINE.scooterA.title,
        input: params.scooterAInput,
        scoreResult: resA,
      },
      scooterB: {
        label: CONFIG.COMPARE_BASELINE.scooterB.title,
        input: params.scooterBInput,
        scoreResult: resB,
      },
      valueGapInr: Math.abs(resA.residualValueInr - resB.residualValueInr),
      lifeGapPct: Math.abs(resA.remainingLifePct - resB.remainingLifePct),
    },
    lender: {
      batteryLabel: lenderBatteryLabel,
      loanAmountInr: params.loanAmountInr,
      tenureMonths: params.tenureMonths,
      scoreResult: lenderScoreResult,
      decision: lenderDecision,
    },
    price: {
      hasEvaluated: params.hasEvaluatedPrice || params.activeTab === 'price',
      batteryLabel: priceBatteryLabel,
      askingPriceInr: params.askingPriceInr,
      roleMode: params.priceRoleMode,
      result: priceResult,
    },
    climate: params.climate ?? null,
  };
}

export function getAssistantChips(state: AssistantSharedState): AssistantChip[] {
  return [
    { id: 'why-score', label: 'Why is my score what it is?' },
    { id: 'raise-score', label: 'How do I raise my score?' },
    { id: 'what-band', label: `What does ${state.scoreResult.band.label} mean?` },
    { id: 'loan-decision', label: 'Why this loan decision?' },
    { id: 'price-fair', label: 'Is this price fair?' },
    {
      id: 'climate',
      label: state.climate
        ? `Climate in ${state.climate.locationName}?`
        : 'How does my local climate affect charging?',
    },
    { id: 'aadhaar', label: 'What is Battery Pack Aadhaar?' },
    { id: 'accuracy', label: 'How accurate is this?' },
  ];
}

export function answerAssistantChip(
  chipId: AssistantChipId,
  state: AssistantSharedState,
  aiConfigured = true,
): string {
  const { scoreResult, input } = state;

  switch (chipId) {
    case 'why-score': {
      const ranked = scoreResult.stressors
        .map((s) => `${s.label} (-${s.lifePointsLost.toFixed(1)}%)`)
        .join(', ');
      const biggest = scoreResult.stressors[0];

      if (state.activeTab === 'compare') {
        const a = state.compare.scooterA.scoreResult;
        const b = state.compare.scooterB.scoreResult;
        const aTop = a.stressors[0];
        const bTop = b.stressors[0];
        return `Scooter A scores ${a.score} (${a.band.label}) while Scooter B scores ${b.score} (${b.band.label}), a ${state.compare.lifeGapPct}% life gap (${formatINR(state.compare.valueGapInr)} value gap). For Scooter A, stressors rank: ${a.stressors.map((s) => `${s.label} (-${s.lifePointsLost.toFixed(1)}%)`).join(', ')}; biggest is ${aTop.label}. Scooter B's biggest stressor is ${bTop.label} (-${bTop.lifePointsLost.toFixed(1)}%).`;
      }

      return `${state.activeBatteryLabel} scores ${scoreResult.score} out of 100 (${scoreResult.band.label}, ${scoreResult.band.tierName}), with ${scoreResult.remainingLifePct}% remaining life and ${formatINR(scoreResult.residualValueInr)} residual value. Stressors ranked by life points lost: ${ranked}. Biggest drag: ${biggest.label} (-${biggest.lifePointsLost.toFixed(1)}%).`;
    }

    case 'raise-score': {
      const habitMap: Array<{
        stressorId: 'heat' | 'fastCharge' | 'deepDischarge';
        field: 'heatAbove40CPct' | 'fastChargePct' | 'deepDischargePct';
        label: string;
      }> = [
        { stressorId: 'heat', field: 'heatAbove40CPct', label: 'time above 40°C' },
        { stressorId: 'fastCharge', field: 'fastChargePct', label: 'fast-charge share' },
        { stressorId: 'deepDischarge', field: 'deepDischargePct', label: 'deep-discharge share' },
      ];

      let bestHabit = habitMap[0];
      let bestPts = -1;
      for (const h of habitMap) {
        const match = scoreResult.stressors.find((s) => s.id === h.stressorId);
        const pts = match ? match.lifePointsLost : 0;
        if (input[h.field] > 0 && pts > bestPts) {
          bestPts = pts;
          bestHabit = h;
        }
      }

      if (bestPts <= 0) {
        return `All adjustable habits (heat, fast charging, and deep discharge) are already at 0% on ${state.activeBatteryLabel}. Current score ${scoreResult.score} (${formatINR(scoreResult.residualValueInr)}) reflects ${input.cycles} charge cycles and ${input.ageMonths} months of calendar age.`;
      }

      const improved = calculateBatteryScore({
        ...input,
        [bestHabit.field]: 0,
      });
      const scoreGain = improved.score - scoreResult.score;
      const valueGain = improved.residualValueInr - scoreResult.residualValueInr;

      return `Reducing ${bestHabit.label} from ${input[bestHabit.field]}% to 0% lifts ${state.activeBatteryLabel} from ${scoreResult.score} to ${improved.score} (+${scoreGain} pts, ${improved.band.label}) and raises residual value by ${formatINR(valueGain)} to ${formatINR(improved.residualValueInr)}.`;
    }

    case 'what-band': {
      const b = scoreResult.band;
      const rateText =
        b.rateSpreadPct !== null
          ? `${CONFIG.BASE_INTEREST_RATE_PCT + b.rateSpreadPct}% p.a. (${CONFIG.BASE_INTEREST_RATE_PCT}% base + ${b.rateSpreadPct}% spread)`
          : 'financing declined';
      return `${b.label} (${b.tierName}) covers scores ${b.minScore}–${b.maxScore}. Under current CONFIG assumptions, it carries a ${b.ltvPct}% maximum LTV, ${rateText}, and a "${b.insuranceFlag}" insurance flag.`;
    }

    case 'loan-decision': {
      const { lender } = state;
      const band = lender.scoreResult.band;
      const d = lender.decision;
      const ratePart =
        d.interestRatePct !== null
          ? `interest rate ${d.interestRatePct.toFixed(1)}% p.a. (EMI ${formatINR(d.monthlyEmiInr ?? 0)}/mo over ${lender.tenureMonths} mo)`
          : 'no loan rate eligible';
      return `For ${lender.batteryLabel} (score ${lender.scoreResult.score}, ${band.label}), the verdict is "${d.verdict}". Residual value is ${formatINR(lender.scoreResult.residualValueInr)} with ${band.ltvPct}% LTV, setting a max loan limit of ${formatINR(d.maxLoanInr)} vs. ${formatINR(lender.loanAmountInr)} requested, ${ratePart}, and "${d.insuranceFlag}" insurance.`;
    }

    case 'price-fair': {
      if (!state.price.hasEvaluated) {
        return 'Open the Price tab to check an asking price against the vehicle body value and battery residual value.';
      }
      const p = state.price;
      if (p.askingPriceInr <= 0) {
        return `Estimated fair value for ${p.batteryLabel} is ${formatINR(p.result.fairValueInr)} (range ${formatINR(p.result.rangeLowInr)} to ${formatINR(p.result.rangeHighInr)}). Enter an asking price on the Price tab to get a Bargain, Fair, Overpriced, or Way overpriced verdict.`;
      }
      return `At an asking price of ${formatINR(p.askingPriceInr)}, ${p.batteryLabel} is rated "${p.result.verdict}" (${p.result.ratio.toFixed(2)}× fair value). Estimated fair value is ${formatINR(p.result.fairValueInr)} (${formatINR(p.result.bodyValueInr)} body + ${formatINR(p.result.batteryValueInr)} battery; fair range ${formatINR(p.result.rangeLowInr)} to ${formatINR(p.result.rangeHighInr)}).`;
    }

    case 'aadhaar':
      return 'A proposed government system that would give every EV battery pack a unique 21-character ID and QR code and a digital record of its data. It is currently a draft.';

    case 'accuracy':
      return 'This is a prototype using sample data and placeholder assumptions. It needs validation on real batteries.';

    case 'climate':
      if (state.climate) {
        return `In ${state.climate.locationName} (${state.climate.climateProfile}, peak ${state.climate.peakTempRangeC}), Google Maps climate grounding estimates ~${state.climate.suggestedHeatPct}% time above 40°C (currently set to ${state.input.heatAbove40CPct}%). ${state.climate.chargingAdvice}`;
      }
      if (!aiConfigured) {
        return `Right now "Time above 40°C" is set to ${state.input.heatAbove40CPct}%. Higher summer heat accelerates battery wear—adjust the "Time above 40°C" slider on the Score screen to see how thermal exposure impacts health and value.`;
      }
      return `Right now "Time above 40°C" is set to ${state.input.heatAbove40CPct}%. Use "Use my location" on the Score screen or tap "Share location" below so CellScore can check Google Maps climate & temperature data for your city.`;
  }
}

export function matchClosestChipId(question: string): AssistantChipId {
  const q = question.toLowerCase();
  if (/(climate|weather|temp|temperature|heat|location|city|maps|hot|summer|charging reading)/.test(q)) {
    return 'climate';
  }
  if (/(aadhaar|passport|draft|21-character|government|policy|regulation)/.test(q)) {
    return 'aadhaar';
  }
  if (/(accurate|accuracy|real|prototype|trust|validat|placeholder)/.test(q)) {
    return 'accuracy';
  }
  if (/(price|fair|worth|bargain|overpriced|offer|seller|buyer|cost|asking)/.test(q)) {
    return 'price-fair';
  }
  if (/(loan|lender|emi|approve|decline|ltv|interest|rate|credit|borrow|finance|insurance)/.test(q)) {
    return 'loan-decision';
  }
  if (/(band|tier|grade|prime|sub-prime)/.test(q)) {
    return 'what-band';
  }
  if (/(raise|improve|increase|higher|better|fix|reduce|help)/.test(q)) {
    return 'raise-score';
  }
  return 'why-score';
}
