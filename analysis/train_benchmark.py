"""Evaluate a current-market median benchmark with grouped cross-validation.

This is a research benchmark, not the consumer valuation shown in the product.
It predicts aggregate dealer asking-price medians, not transactions or future value.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

os.environ.setdefault("LOKY_MAX_CPU_COUNT", "8")

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, median_absolute_error, r2_score
from sklearn.model_selection import GroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "data" / "raw" / "price_stats_by_model_year.csv"
OUTPUT = ROOT / "public" / "data" / "model-metrics.json"
SNAPSHOT_YEAR = 2026
RANDOM_STATE = 42

CATEGORICAL_FEATURES = ["province", "make"]
NUMERIC_FEATURES = ["vehicle_age", "log_mileage", "days_on_market_median", "log_sample_size"]


def weighted_absolute_metrics(actual: np.ndarray, predicted: np.ndarray, weights: np.ndarray) -> dict[str, float | None]:
    absolute_error = np.abs(actual - predicted)
    percentage_error = absolute_error / np.maximum(actual, 1)
    return {
        "mae_cad": float(mean_absolute_error(actual, predicted, sample_weight=weights)),
        "median_ae_cad": float(median_absolute_error(actual, predicted, sample_weight=weights)),
        "wape_pct": float(100 * np.sum(weights * absolute_error) / np.sum(weights * actual)),
        "median_ape_pct": float(100 * np.median(percentage_error)),
        "r2": float(r2_score(actual, predicted, sample_weight=weights)) if len(actual) > 1 else None,
    }


def rounded(metrics: dict[str, float | None]) -> dict[str, float | None]:
    return {key: round(value, 3) if value is not None else None for key, value in metrics.items()}


def load_data() -> pd.DataFrame:
    frame = pd.read_csv(INPUT)
    frame = frame.loc[frame["condition"].eq("Used")].copy().reset_index(drop=True)
    frame["vehicle_age"] = (SNAPSHOT_YEAR - frame["model_year"]).clip(lower=0)
    frame["log_mileage"] = np.log1p(frame["mileage_median"].clip(lower=0))
    frame["log_sample_size"] = np.log1p(frame["vehicles"])
    frame["group"] = frame["make"].astype(str) + "|" + frame["model"].astype(str)
    return frame


def model_pipeline() -> Pipeline:
    transformer = ColumnTransformer(
        transformers=[
            ("categorical", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL_FEATURES),
            ("numeric", StandardScaler(), NUMERIC_FEATURES),
        ],
        verbose_feature_names_out=False,
    )
    model = HistGradientBoostingRegressor(
        learning_rate=0.05,
        max_iter=300,
        max_leaf_nodes=31,
        min_samples_leaf=20,
        l2_regularization=0.5,
        random_state=RANDOM_STATE,
    )
    return Pipeline([("features", transformer), ("regressor", model)])


def main() -> None:
    frame = load_data()
    features = frame[CATEGORICAL_FEATURES + NUMERIC_FEATURES]
    target = frame["price_median"].to_numpy(dtype=float)
    log_target = np.log1p(target)
    weights = frame["vehicles"].to_numpy(dtype=float)
    groups = frame["group"]

    splitter = GroupKFold(n_splits=5)
    model_predictions = np.zeros(len(frame), dtype=float)
    baseline_predictions = np.zeros(len(frame), dtype=float)
    folds: list[dict[str, object]] = []

    for fold_number, (train_index, test_index) in enumerate(splitter.split(features, log_target, groups), start=1):
        model = model_pipeline()
        baseline = DummyRegressor(strategy="median")
        model.fit(features.iloc[train_index], log_target[train_index])
        baseline.fit(features.iloc[train_index], log_target[train_index])

        model_fold = np.expm1(model.predict(features.iloc[test_index]))
        baseline_fold = np.expm1(baseline.predict(features.iloc[test_index]))
        model_predictions[test_index] = model_fold
        baseline_predictions[test_index] = baseline_fold

        train_groups = set(groups.iloc[train_index])
        test_groups = set(groups.iloc[test_index])
        assert train_groups.isdisjoint(test_groups), "Grouped CV leakage detected"
        folds.append(
            {
                "fold": fold_number,
                "train_cells": int(len(train_index)),
                "test_cells": int(len(test_index)),
                "test_make_model_groups": int(len(test_groups)),
                "model": rounded(weighted_absolute_metrics(target[test_index], model_fold, weights[test_index])),
            }
        )

    model_metrics = weighted_absolute_metrics(target, model_predictions, weights)
    baseline_metrics = weighted_absolute_metrics(target, baseline_predictions, weights)
    improvement = 100 * (baseline_metrics["mae_cad"] - model_metrics["mae_cad"]) / baseline_metrics["mae_cad"]

    province_metrics = []
    for province, indexes in frame.groupby("province").groups.items():
        index = np.asarray(list(indexes), dtype=int)
        province_metrics.append(
            {
                "province": province,
                "cells": int(len(index)),
                "vehicles": int(weights[index].sum()),
                **rounded(weighted_absolute_metrics(target[index], model_predictions[index], weights[index])),
            }
        )

    artifact = {
        "schemaVersion": 1,
        "sourceRetrievedAt": "2026-08-29",
        "status": "research-only",
        "predictionTarget": "Aggregate median dealer asking price in CAD",
        "notFor": ["individual appraisal", "transaction price", "future residual value"],
        "validation": "5-fold GroupKFold; make-model groups never cross train/test boundaries",
        "cells": int(len(frame)),
        "vehiclesRepresented": int(weights.sum()),
        "makeModelGroups": int(groups.nunique()),
        "features": CATEGORICAL_FEATURES + NUMERIC_FEATURES,
        "baseline": {"name": "Training-fold global median", **rounded(baseline_metrics)},
        "model": {"name": "Histogram gradient boosting", **rounded(model_metrics)},
        "maeImprovementVsBaselinePct": round(float(improvement), 2),
        "folds": folds,
        "byProvince": sorted(province_metrics, key=lambda row: row["province"]),
        "reproducibility": {"randomState": RANDOM_STATE, "snapshotYear": SNAPSHOT_YEAR},
    }

    if not np.isfinite(list(model_metrics.values())).all():
        raise RuntimeError("Non-finite evaluation metric")
    if improvement <= 0:
        raise RuntimeError("Model did not beat the declared baseline")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"model": rounded(model_metrics), "baseline": rounded(baseline_metrics), "mae_improvement_pct": round(improvement, 2)}, indent=2))


if __name__ == "__main__":
    main()
