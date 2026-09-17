import artifact from "../public/data/condition-model.json";

export type ConditionGrade = "extra-clean" | "clean" | "average" | "rough" | "extra-rough" | "salvage";

export type ConditionTier = "below-average" | "rough" | "average";

export type ConditionProfile = {
  conditionGrade: ConditionGrade;
};

/**
 * The auction panel resolves three effective condition levels: below-average,
 * rough and average. Above-average grades are not distinguished, so they are not
 * exposed as tiers. Below-average maps to extra-rough because the artifact prices
 * salvage and extra-rough identically; latent if a future retrain adds a split
 * below 0.5.
 */
export const CONDITION_TIER_GRADE: Record<ConditionTier, ConditionGrade> = {
  "below-average": "extra-rough",
  rough: "rough",
  average: "average",
};

export const CONDITION_TIER_LABEL: Record<ConditionTier, string> = {
  "below-average": "Below average",
  rough: "Rough",
  average: "Average or better",
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
  const gradeScore = GRADE_SCORE[profile.conditionGrade];
  return Math.round(clamp(gradeScore, modelArtifact.featureBounds.conditionScore) * 100) / 100;
}

export type ConditionValuation = {
  estimate: number;
  low: number;
  high: number;
  baseValue: number;
  adjustmentCad: number;
  multiplier: number;
  multiplierExact: number;
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
  const odometerBounds = modelArtifact.featureBounds.odometerKm;
  const safeBaselineKm = clamp(input.baselineOdometerKm, odometerBounds);
  const safeTargetKm = clamp(input.targetOdometerKm, odometerBounds);
  const modelOdometerDelta = Math.log1p(safeTargetKm) - Math.log1p(safeBaselineKm);
  const logOdometerDelta = clamp(modelOdometerDelta, modelArtifact.featureBounds.logOdometerDelta);
  const rawOdometerDelta = Math.log1p(input.targetOdometerKm) - Math.log1p(input.baselineOdometerKm);
  const odometerOutsideSupport = input.baselineOdometerKm < odometerBounds[0] || input.baselineOdometerKm > odometerBounds[1]
    || input.targetOdometerKm < odometerBounds[0] || input.targetOdometerKm > odometerBounds[1];
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
    multiplierExact: multiplier,
    conditionScore: score,
    logOdometerDelta: Math.round(logOdometerDelta * 10_000) / 10_000,
    isOdometerExtrapolation: odometerOutsideSupport || rawOdometerDelta !== logOdometerDelta,
  };
}

export const conditionModelMetadata = {
  outcomes: modelArtifact.rows.eligibleSoldOutcomes,
  temporalTestOutcomes: modelArtifact.rows.temporalTest,
  maeCad: modelArtifact.validation.model.maeCad,
  wapePct: modelArtifact.validation.model.wapePct,
  improvementPct: modelArtifact.validation.maeImprovementPct,
};
