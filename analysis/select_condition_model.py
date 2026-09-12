"""Pre-registered champion/challenger selection for the condition adjustment model.

Protocol locked in analysis/MODEL_SELECTION.md before the grid was executed:

  * Fit on sale years 2006-2007 (18,201 rows); validate on 2008 (33,945 rows).
  * The 2009-2010 temporal test is scored exactly once: the selected candidate
    is refit on 2006-2008 and evaluated once. No candidate sees test first.
  * Candidate families:
      (a) plain grid over max_depth, learning_rate, min_samples_leaf, loss,
          subsample and n_estimators (3^4 x 2^2 = 324 candidates);
      (b) monotonic_cst on condition_score / log_odometer_delta. Verified NOT
          supported by sklearn 1.7.0 GradientBoostingRegressor before running
          (TypeError: unexpected keyword argument), so the family is documented
          but not executed. HistGradientBoostingRegressor supports it, but that
          estimator changes the serialized tree format the TS evaluator reads.
      (c) sample-weight variants on the deployed champion hyper-parameters:
          recency (sale_year - 2005), peer count, and actual sale price.
  * Selection: lowest validation MAE; exact ties broken by fewer
    n_estimators, then lower max_depth, then lower min_samples_leaf, then id.
  * Adoption gate, evaluated once on the temporal test:
      test MAE <= 0.97 * champion test MAE (<= $1,162.24), AND
      no artifact segment with n >= 2,000 in the v2 axes degrades > 2% in MAE
      versus the champion, AND the regenerated artifact stays <= 150 KB.

The grid below is pre-registered: do not add or remove candidates after the
validation numbers are seen. Bug fixes must not change the candidate set.
"""

from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path

import numpy as np
import sklearn
from joblib import Parallel, delayed
from sklearn.ensemble import GradientBoostingRegressor

ROOT = Path(__file__).resolve().parents[1]
ARTIFACT = ROOT / "public" / "data" / "condition-model.json"
RESULTS = Path(__file__).with_name("selection-results.json")

# --- pre-registered grid -----------------------------------------------------
DEPTHS = [2, 3, 4]
LEARNING_RATES = [0.02, 0.04, 0.08]
MIN_SAMPLES_LEAF = [40, 80, 160]
LOSSES = [("huber", 0.9), ("huber", 0.95), ("squared_error", None)]
SUBSAMPLES = [0.8, 1.0]
N_ESTIMATORS = [140, 280]

CHAMPION_PARAMS = {
    "max_depth": 2,
    "learning_rate": 0.04,
    "min_samples_leaf": 80,
    "loss": "huber",
    "alpha": 0.9,
    "subsample": 0.8,
    "n_estimators": 140,
}
WEIGHT_VARIANTS = [
    ("w-recency", "recency"),
    ("w-peer-count", "peer"),
    ("w-price-level", "price"),
]

TEST_MAE_GATE_FACTOR = 0.97
SEGMENT_MIN_N = 2_000
SEGMENT_MAX_DEGRADE_PCT = 2.0
ARTIFACT_MAX_BYTES = 150 * 1024
EXPECTED_ROWS = {"fit": 18_201, "validate": 33_945, "test": 39_132, "finalTrain": 52_146}


def load_trainer():
    spec = importlib.util.spec_from_file_location(
        "train_condition_model", Path(__file__).with_name("train_condition_model.py")
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


tcm = load_trainer()


def plain_grid() -> list[dict]:
    """Deterministic nested-loop ordering; g001..g972."""
    configs: list[dict] = []
    for depth in DEPTHS:
        for rate in LEARNING_RATES:
            for leaf in MIN_SAMPLES_LEAF:
                for loss, alpha in LOSSES:
                    for subsample in SUBSAMPLES:
                        for trees in N_ESTIMATORS:
                            config = {
                                "id": f"g{len(configs) + 1:03d}",
                                "family": "plain",
                                "max_depth": depth,
                                "learning_rate": rate,
                                "min_samples_leaf": leaf,
                                "loss": loss,
                                "subsample": subsample,
                                "n_estimators": trees,
                            }
                            if alpha is not None:
                                config["alpha"] = alpha
                            configs.append(config)
    return configs


def weighted_configs() -> list[dict]:
    return [
        {"id": config_id, "family": "weighted", "weight": weight, **CHAMPION_PARAMS}
        for config_id, weight in WEIGHT_VARIANTS
    ]


def sample_weights(frame, variant) -> np.ndarray | None:
    """Pre-registered weight definitions. Recency generalizes to the final
    2006-2008 refit (2006->1, 2007->2, 2008->3)."""
    if variant is None:
        return None
    if variant == "recency":
        return (frame["sale_year"] - 2005).to_numpy(dtype=float)
    if variant == "peer":
        return frame["peer_count"].to_numpy(dtype=float)
    if variant == "price":
        return frame["finalprice"].to_numpy(dtype=float)
    raise ValueError(f"Unknown weight variant: {variant}")


def fit_model(frame, config: dict) -> GradientBoostingRegressor:
    kwargs = {
        "loss": config["loss"],
        "n_estimators": config["n_estimators"],
        "learning_rate": config["learning_rate"],
        "max_depth": config["max_depth"],
        "min_samples_leaf": config["min_samples_leaf"],
        "subsample": config["subsample"],
        "random_state": tcm.RANDOM_STATE,
    }
    if config["loss"] == "huber":
        kwargs["alpha"] = config["alpha"]
    model = GradientBoostingRegressor(**kwargs)
    model.fit(frame[tcm.FEATURES], frame["target"], sample_weight=sample_weights(frame, config.get("weight")))
    return model


def deployed_predictions(model, frame) -> np.ndarray:
    """The exact deployed path: monotonic guard, then Average/zero centering."""
    adjustment = tcm.predict_adjustment(
        model,
        frame["condition_score"].to_numpy(dtype=float),
        frame["log_odometer_delta"].to_numpy(dtype=float),
    )
    center = float(
        tcm.predict_adjustment(model, np.asarray([tcm.GRADE_SCORE["Average"]]), np.asarray([0.0]))[0]
    )
    return np.exp(frame["peer_anchor_log"].to_numpy(dtype=float) + adjustment - center)


def run_candidate(config: dict, fit_frame, validate_frame) -> dict:
    model = fit_model(fit_frame, config)
    predicted = deployed_predictions(model, validate_frame)
    actual = validate_frame["finalprice"].to_numpy(dtype=float)
    return {**config, "validation": tcm.metrics(actual, predicted)}


def rank_key(result: dict) -> tuple:
    return (
        result["validation"]["maeCad"],
        result["n_estimators"],
        result["max_depth"],
        result["min_samples_leaf"],
        result["id"],
    )


def estimate_artifact_bytes(model) -> int:
    """Champion artifact chrome minus its tree payload, plus candidate trees."""
    champion = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    reference = len(json.dumps(champion, separators=(",", ":")))
    champion_trees = len(json.dumps(champion["model"]["trees"], separators=(",", ":")))
    candidate_trees = len(
        json.dumps([tcm.export_tree(estimator[0]) for estimator in model.estimators_], separators=(",", ":"))
    )
    return reference - champion_trees + candidate_trees


def evaluate_on_test(winner: dict, frame) -> dict:
    final_train = frame.loc[frame["sale_year"].le(2008)]
    test = frame.loc[frame["sale_year"].ge(2009)]
    if len(final_train) != EXPECTED_ROWS["finalTrain"] or len(test) != EXPECTED_ROWS["test"]:
        raise RuntimeError(f"Unexpected final split sizes: {len(final_train)} / {len(test)}")

    model = fit_model(final_train, winner)
    actual = test["finalprice"].to_numpy(dtype=float)
    baseline = np.exp(test["peer_anchor_log"].to_numpy(dtype=float))
    predicted = deployed_predictions(model, test)
    log_residual = np.log(actual / predicted)
    p10 = round(float(np.quantile(log_residual, 0.1)), 6)
    p90 = round(float(np.quantile(log_residual, 0.9)), 6)
    segments = tcm.build_segments(test, actual, baseline, predicted, log_residual, p10, p90)

    champion = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    champion_metrics = champion["validation"]["model"]
    threshold = round(TEST_MAE_GATE_FACTOR * champion_metrics["maeCad"], 2)
    metrics = tcm.metrics(actual, predicted)

    violations = []
    max_degrade = {"segment": None, "axis": None, "relativePct": 0.0}
    for axis, body in segments.items():
        for candidate_slice, champion_slice in zip(body["model"], champion["validation"]["segments"][axis]["model"]):
            if champion_slice["n"] < SEGMENT_MIN_N:
                continue
            relative_pct = 100 * (candidate_slice["maeCad"] - champion_slice["maeCad"]) / champion_slice["maeCad"]
            if relative_pct > max_degrade["relativePct"]:
                max_degrade = {
                    "segment": candidate_slice["segment"],
                    "axis": axis,
                    "relativePct": round(relative_pct, 3),
                }
            if relative_pct > SEGMENT_MAX_DEGRADE_PCT:
                violations.append(
                    {
                        "axis": axis,
                        "segment": candidate_slice["segment"],
                        "n": champion_slice["n"],
                        "championMaeCad": champion_slice["maeCad"],
                        "candidateMaeCad": candidate_slice["maeCad"],
                        "relativePct": round(relative_pct, 3),
                    }
                )

    estimated_bytes = estimate_artifact_bytes(model)
    gate = {
        "testMaeMaxCad": threshold,
        "testMae": metrics["maeCad"],
        "maePass": metrics["maeCad"] <= threshold,
        "segmentMinN": SEGMENT_MIN_N,
        "segmentMaxDegradePct": SEGMENT_MAX_DEGRADE_PCT,
        "segmentViolations": violations,
        "segmentPass": not violations,
        "maxSegmentDegrade": max_degrade,
        "artifactMaxBytes": ARTIFACT_MAX_BYTES,
        "estimatedArtifactBytes": estimated_bytes,
        "artifactPass": estimated_bytes <= ARTIFACT_MAX_BYTES,
    }
    gate["pass"] = gate["maePass"] and gate["segmentPass"] and gate["artifactPass"]
    return {
        "winner": winner,
        "finalTrainRows": int(len(final_train)),
        "testRows": int(len(test)),
        "test": metrics,
        "championTest": champion_metrics,
        "logResidualP10": p10,
        "logResidualP90": p90,
        "segments": segments,
        "gate": gate,
        "verdict": "adopt" if gate["pass"] else "reject",
    }


def main() -> None:
    frame = tcm.load_outcomes()
    fit_frame = frame.loc[frame["sale_year"].le(2007)]
    validate_frame = frame.loc[frame["sale_year"].eq(2008)]
    if (len(fit_frame), len(validate_frame)) != (EXPECTED_ROWS["fit"], EXPECTED_ROWS["validate"]):
        raise RuntimeError(f"Unexpected split sizes: {len(fit_frame)} / {len(validate_frame)}")

    candidates = plain_grid() + weighted_configs()
    jobs = int(os.environ.get("SELECTION_JOBS", str(min(6, os.cpu_count() or 1))))
    print(f"Evaluating {len(candidates)} pre-registered candidates on 2008 ({len(validate_frame)} rows), jobs={jobs}")
    scored = Parallel(n_jobs=jobs, verbose=5)(
        delayed(run_candidate)(config, fit_frame, validate_frame) for config in candidates
    )
    ranked = sorted(scored, key=rank_key)
    winner = ranked[0]

    champion = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    partial = {
        "protocol": {
            "sklearnVersion": sklearn.__version__,
            "split": {
                "fitSaleYears": "2006-2007",
                "fitRows": int(len(fit_frame)),
                "validateSaleYear": 2008,
                "validateRows": int(len(validate_frame)),
                "testSaleYears": "2009-2010",
                "testRows": EXPECTED_ROWS["test"],
            },
            "selectionRule": "lowest validation maeCad; ties: fewer n_estimators, lower max_depth, lower min_samples_leaf, id",
            "adoptionGate": {
                "testMaeMaxCad": round(TEST_MAE_GATE_FACTOR * champion["validation"]["model"]["maeCad"], 2),
                "segmentMinN": SEGMENT_MIN_N,
                "segmentMaxDegradePct": SEGMENT_MAX_DEGRADE_PCT,
                "artifactMaxBytes": ARTIFACT_MAX_BYTES,
            },
            "grid": {
                "max_depth": DEPTHS,
                "learning_rate": LEARNING_RATES,
                "min_samples_leaf": MIN_SAMPLES_LEAF,
                "loss": [{"loss": loss, **({"alpha": alpha} if alpha is not None else {})} for loss, alpha in LOSSES],
                "subsample": SUBSAMPLES,
                "n_estimators": N_ESTIMATORS,
                "plainCandidates": len(plain_grid()),
                "weightVariants": [{"id": config_id, "weight": weight} for config_id, weight in WEIGHT_VARIANTS],
                "weightedBase": CHAMPION_PARAMS,
            },
            "monotonicCst": {
                "GradientBoostingRegressor": False,
                "detail": (
                    "sklearn 1.7.0 GradientBoostingRegressor.__init__ has no monotonic_cst parameter; "
                    "passing it raises TypeError. Family (b) was not executed. "
                    "HistGradientBoostingRegressor supports monotonic constraints but serializes a different "
                    "tree format than the TypeScript evaluator consumes."
                ),
            },
        },
        "championReference": {
            "artifactBytes": ARTIFACT.stat().st_size,
            "test": champion["validation"]["model"],
            "selectedInArtifact": {}
            if "selection" not in champion
            else champion["selection"],
        },
        "validation": {
            "candidateCount": len(candidates),
            "flat": scored,
            "top10": ranked[:10],
            "championRank": next(
                index
                for index, result in enumerate(ranked, start=1)
                if all(result.get(key) == value for key, value in CHAMPION_PARAMS.items())
            ),
        },
        "selection": {"winnerId": winner["id"], "winner": winner},
    }
    RESULTS.write_text(json.dumps(partial, indent=1) + "\n", encoding="utf-8")
    print(f"Validation phase done; winner {winner['id']} {json.dumps(winner)}")
    print(json.dumps(ranked[:10], indent=1))

    print("Single temporal-test evaluation for the selected candidate")
    test_result = evaluate_on_test(winner, frame)
    partial["testEvaluation"] = test_result
    partial["verdict"] = test_result["verdict"]
    RESULTS.write_text(json.dumps(partial, indent=1) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in test_result.items() if key != "segments"}, indent=1))


if __name__ == "__main__":
    main()
