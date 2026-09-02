import artifact from "../public/data/condition-model.json";

export type ConditionGrade = "extra-clean" | "clean" | "average" | "rough" | "extra-rough" | "salvage";
export type AccidentHistory = "none" | "minor" | "major" | "rebuilt";
export type MechanicalCondition = "sound" | "minor-repair" | "major-repair" | "not-running";
export type CosmeticCondition = "clean" | "light" | "moderate" | "heavy";
export type ServiceHistory = "complete" | "partial" | "unknown";
export type WearItems = "good" | "due-soon" | "replace-now";

export type ConditionProfile = {
  conditionGrade: ConditionGrade;
  accidentHistory: AccidentHistory;
  mechanicalCondition: MechanicalCondition;
  cosmeticCondition: CosmeticCondition;
  serviceHistory: ServiceHistory;
  wearItems: WearItems;
};

type SerializedTree = {
  f: number[];
  t: number[];
  l: number[];
  r: number[];
  v: number[];
};

type ConditionModelArtifact = {
  rows: { eligibleSoldOutcomes: number; train: number; temporalTest: number };
  validation: {
    model: { maeCad: number; medianAeCad: number; wapePct: number };
    maeImprovementPct: number;
    logResidualP10: number;
    logResidualP90: number;
  };
  featureBounds: {
    odometerKm: [number, number];
    logOdometerDelta: [number, number];
    conditionScore: [number, number];
  };
  inferenceCenter: { conditionScore: number; logOdometerDelta: number; logAdjustment: number };
  model: { initial: number; learningRate: number; trees: SerializedTree[] };
};

const modelArtifact = artifact as unknown as ConditionModelArtifact;

const GRADE_SCORE: Record<ConditionGrade, number> = {
  salvage: -1,
  "extra-rough": 0,
  rough: 1,
  average: 2,
  clean: 3,
  "extra-clean": 4,
};

const ACCIDENT_ADJUSTMENT: Record<AccidentHistory, number> = { none: 0, minor: -0.25, major: -1, rebuilt: -1.5 };
const MECHANICAL_ADJUSTMENT: Record<MechanicalCondition, number> = { sound: 0, "minor-repair": -0.25, "major-repair": -0.75, "not-running": -1.5 };
const COSMETIC_ADJUSTMENT: Record<CosmeticCondition, number> = { clean: 0.15, light: 0, moderate: -0.25, heavy: -0.6 };
const SERVICE_ADJUSTMENT: Record<ServiceHistory, number> = { complete: 0.15, partial: 0, unknown: -0.15 };
const WEAR_ADJUSTMENT: Record<WearItems, number> = { good: 0, "due-soon": -0.1, "replace-now": -0.3 };

function clamp(value: number, [minimum, maximum]: [number, number]) {
  return Math.max(minimum, Math.min(maximum, value));
}

function nearestHundred(value: number) {
  return Math.round(value / 100) * 100;
}

function evaluateTree(tree: SerializedTree, features: number[]) {
  let node = 0;
  while (tree.f[node] >= 0) {
    node = features[tree.f[node]] <= tree.t[node] ? tree.l[node] : tree.r[node];
  }
  return tree.v[node];
}

function rawPrediction(conditionScore: number, logOdometerDelta: number) {
  const features = [conditionScore, logOdometerDelta];
  return modelArtifact.model.trees.reduce(
    (prediction, tree) => prediction + modelArtifact.model.learningRate * evaluateTree(tree, features),
    modelArtifact.model.initial,
  );
}

export function conditionScore(profile: ConditionProfile) {
  const raw = GRADE_SCORE[profile.conditionGrade]
    + ACCIDENT_ADJUSTMENT[profile.accidentHistory]
    + MECHANICAL_ADJUSTMENT[profile.mechanicalCondition]
    + COSMETIC_ADJUSTMENT[profile.cosmeticCondition]
    + SERVICE_ADJUSTMENT[profile.serviceHistory]
    + WEAR_ADJUSTMENT[profile.wearItems];
  return Math.round(clamp(raw, modelArtifact.featureBounds.conditionScore) * 100) / 100;
}

export type ConditionValuation = {
  estimate: number;
  low: number;
  high: number;
  baseValue: number;
  adjustmentCad: number;
  multiplier: number;
  conditionScore: number;
  logOdometerDelta: number;
  isOdometerExtrapolation: boolean;
};

export function predictConditionAdjustedValue(input: {
  baseValue: number;
  baseLow: number;
  baseHigh: number;
  baselineOdometerKm: number;
  targetOdometerKm: number;
  profile: ConditionProfile;
}): ConditionValuation {
  const score = conditionScore(input.profile);
  const safeBaselineKm = clamp(input.baselineOdometerKm, modelArtifact.featureBounds.odometerKm);
  const safeTargetKm = clamp(input.targetOdometerKm, modelArtifact.featureBounds.odometerKm);
  const rawOdometerDelta = Math.log1p(safeTargetKm) - Math.log1p(safeBaselineKm);
  const logOdometerDelta = clamp(rawOdometerDelta, modelArtifact.featureBounds.logOdometerDelta);
  let prediction = rawPrediction(score, logOdometerDelta);

  // Preserve the training-time monotonic guard: a user-reported grade above
  // Average cannot receive a lower prediction than Average at equal mileage.
  if (score > 2) prediction = Math.max(prediction, rawPrediction(2, logOdometerDelta));

  // The current Canadian anchor already represents a mix of real used-car
  // conditions. Centre the transferred auction effect on an Average vehicle at
  // the anchor mileage so the historical model intercept is not counted twice.
  prediction -= modelArtifact.inferenceCenter.logAdjustment;

  const multiplier = Math.exp(prediction);
  const rawEstimate = input.baseValue * multiplier;
  const estimate = nearestHundred(rawEstimate);
  const modelLow = rawEstimate * Math.exp(modelArtifact.validation.logResidualP10);
  const modelHigh = rawEstimate * Math.exp(modelArtifact.validation.logResidualP90);
  const low = nearestHundred(Math.min(input.baseLow * multiplier, modelLow));
  const high = nearestHundred(Math.max(input.baseHigh * multiplier, modelHigh));

  return {
    estimate,
    low,
    high,
    baseValue: input.baseValue,
    adjustmentCad: estimate - input.baseValue,
    multiplier: Math.round(multiplier * 10_000) / 10_000,
    conditionScore: score,
    logOdometerDelta: Math.round(logOdometerDelta * 10_000) / 10_000,
    isOdometerExtrapolation: rawOdometerDelta !== logOdometerDelta,
  };
}

export const conditionModelMetadata = {
  outcomes: modelArtifact.rows.eligibleSoldOutcomes,
  temporalTestOutcomes: modelArtifact.rows.temporalTest,
  maeCad: modelArtifact.validation.model.maeCad,
  wapePct: modelArtifact.validation.model.wapePct,
  improvementPct: modelArtifact.validation.maeImprovementPct,
};
