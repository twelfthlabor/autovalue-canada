"""Python port of lib/condition-model.ts (exact semantics, stdlib only).

Both implementations evaluate the same serialized gradient-boosted trees
from public/data/condition-model.json. Parity is enforced by
aws/check_parity.py against the artifact's representativeGradeMultipliers
oracle and the behavioral vectors from lib/condition-model.test.ts.

Keep in sync with lib/condition-model.ts. JS Math.round rounds half up
(toward +inf); math.floor(x + 0.5) reproduces it, unlike banker's round().
"""

from __future__ import annotations

import json
import math
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ARTIFACT = REPO_ROOT / "public" / "data" / "condition-model.json"

GRADE_SCORE = {
    "salvage": -1,
    "extra-rough": 0,
    "rough": 1,
    "average": 2,
    "clean": 3,
    "extra-clean": 4,
}
ACCIDENT_ADJUSTMENT = {"none": 0, "minor": -0.25, "major": -1, "rebuilt": -1.5}
MECHANICAL_ADJUSTMENT = {"sound": 0, "minor-repair": -0.25, "major-repair": -0.75, "not-running": -1.5}
COSMETIC_ADJUSTMENT = {"clean": 0.15, "light": 0, "moderate": -0.25, "heavy": -0.6}
SERVICE_ADJUSTMENT = {"complete": 0.15, "partial": 0, "unknown": -0.15}
WEAR_ADJUSTMENT = {"good": 0, "due-soon": -0.1, "replace-now": -0.3}


def js_round(value: float) -> int:
    """Reproduce JS Math.round (half up) for all finite inputs."""
    return math.floor(value + 0.5)


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def nearest_hundred(value: float) -> int:
    return js_round(value / 100) * 100


class ConditionModel:
    """Evaluates serialized GBM trees from the training artifact."""

    def __init__(self, artifact_path: Path | str = DEFAULT_ARTIFACT) -> None:
        with open(artifact_path, encoding="utf-8") as handle:
            artifact = json.load(handle)
        self._artifact = artifact
        self.feature_bounds = artifact["featureBounds"]
        self.inference_center = artifact["inferenceCenter"]
        self.validation = artifact["validation"]
        self.rows = artifact["rows"]
        model = artifact["model"]
        self._initial: float = model["initial"]
        self._learning_rate: float = model["learningRate"]
        self._trees: list[dict] = model["trees"]

    @staticmethod
    def _evaluate_tree(tree: dict, features: list[float]) -> float:
        node = 0
        while tree["f"][node] >= 0:
            node = tree["l"][node] if features[tree["f"][node]] <= tree["t"][node] else tree["r"][node]
        return tree["v"][node]

    def _raw_prediction(self, score: float, log_odometer_delta: float) -> float:
        features = [score, log_odometer_delta]
        total = self._initial
        for tree in self._trees:
            total += self._learning_rate * self._evaluate_tree(tree, features)
        return total

    def condition_score(self, profile: dict) -> float:
        raw = (
            GRADE_SCORE[profile["conditionGrade"]]
            + ACCIDENT_ADJUSTMENT[profile["accidentHistory"]]
            + MECHANICAL_ADJUSTMENT[profile["mechanicalCondition"]]
            + COSMETIC_ADJUSTMENT[profile["cosmeticCondition"]]
            + SERVICE_ADJUSTMENT[profile["serviceHistory"]]
            + WEAR_ADJUSTMENT[profile["wearItems"]]
        )
        lo, hi = self.feature_bounds["conditionScore"]
        return js_round(clamp(raw, lo, hi) * 100) / 100

    def predict(
        self,
        base_value: float,
        base_low: float,
        base_high: float,
        baseline_odometer_km: float,
        target_odometer_km: float,
        profile: dict,
    ) -> dict:
        score = self.condition_score(profile)
        odo_lo, odo_hi = self.feature_bounds["odometerKm"]
        safe_baseline = clamp(baseline_odometer_km, odo_lo, odo_hi)
        safe_target = clamp(target_odometer_km, odo_lo, odo_hi)
        raw_delta = math.log1p(safe_target) - math.log1p(safe_baseline)
        d_lo, d_hi = self.feature_bounds["logOdometerDelta"]
        log_delta = clamp(raw_delta, d_lo, d_hi)

        prediction = self._raw_prediction(score, log_delta)
        if score > 2:
            prediction = max(prediction, self._raw_prediction(2, log_delta))
        prediction -= self.inference_center["logAdjustment"]

        multiplier = math.exp(prediction)
        raw_estimate = base_value * multiplier
        estimate = nearest_hundred(raw_estimate)
        model_low = raw_estimate * math.exp(self.validation["logResidualP10"])
        model_high = raw_estimate * math.exp(self.validation["logResidualP90"])
        low = nearest_hundred(min(base_low * multiplier, model_low))
        high = nearest_hundred(max(base_high * multiplier, model_high))

        return {
            "estimate": estimate,
            "low": low,
            "high": high,
            "baseValue": base_value,
            "adjustmentCad": estimate - base_value,
            "multiplier": js_round(multiplier * 10_000) / 10_000,
            "conditionScore": score,
            "logOdometerDelta": js_round(log_delta * 10_000) / 10_000,
            "isOdometerExtrapolation": raw_delta != log_delta,
        }

    def metadata(self) -> dict:
        return {
            "outcomes": self.rows["eligibleSoldOutcomes"],
            "temporalTestOutcomes": self.rows["temporalTest"],
            "maeCad": self.validation["model"]["maeCad"],
            "wapePct": self.validation["model"]["wapePct"],
            "improvementPct": self.validation["maeImprovementPct"],
        }
