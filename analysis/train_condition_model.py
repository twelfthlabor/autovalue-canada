"""Train the deployable condition-and-mileage adjustment model.

The model learns relative sold-price adjustments from the public Larsen (2020)
wholesale auction outcomes. At product inference time its prediction is used only
as a delta around a current Canadian market anchor; it is never treated as a
standalone 2006-2010 price forecast.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import urllib.request
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, median_absolute_error

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "data" / "condition-model.json"
CACHE = ROOT / "data" / "cache" / "Larsen_used_car_bargaining_data_and_code.zip"
SOURCE_URL = "https://data.nber.org/data/used-car-bargaining/Larsen_used_car_bargaining_data_and_code.zip"
SOURCE_SHA256 = "7827d220499700868fec28e09288e67b7c35ae8235e9b13e486d123ae05008fa"
RANDOM_STATE = 42

GRADE_SCORE = {
    "Salvage": -1.0,
    "Extra Rough": 0.0,
    "Rough": 1.0,
    "Average": 2.0,
    "Clean": 3.0,
    "Extra Clean": 4.0,
}
FEATURES = ["condition_score", "log_odometer_delta"]
CSV_COLUMNS = [
    "idnew", "auction", "history_run_date", "agree", "finalprice", "year",
    "make", "model", "odo", "conrepgrade", "vin_modeltrim",
]


def source_bytes() -> bytes:
    override = os.environ.get("AUTOVALUE_AUCTION_ZIP")
    path = Path(override) if override else CACHE
    if path.exists():
        payload = path.read_bytes()
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "AutoValue-Canada research model"})
        with urllib.request.urlopen(request, timeout=180) as response:
            payload = response.read()
        path.write_bytes(payload)

    digest = hashlib.sha256(payload).hexdigest()
    if digest != SOURCE_SHA256:
        raise RuntimeError(f"Unexpected Larsen source digest: {digest}")
    return payload


def load_outcomes() -> pd.DataFrame:
    payload = source_bytes()
    frames: list[pd.DataFrame] = []
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        for filename in ("pre_step1_ins0.csv", "pre_step1_ins1.csv"):
            with archive.open(filename) as source:
                frames.append(pd.read_csv(source, usecols=CSV_COLUMNS, low_memory=False))

    frame = pd.concat(frames, ignore_index=True)
    frame["sale_year"] = pd.to_numeric(frame["history_run_date"].astype(str).str[-4:], errors="coerce")
    frame["condition_score"] = frame["conrepgrade"].map(GRADE_SCORE)
    frame["vehicle_age"] = frame["sale_year"] - frame["year"]
    frame["log_odometer"] = np.log1p(frame["odo"])
    frame["log_price"] = np.log(frame["finalprice"])

    valid = (
        frame["agree"].eq(1)
        & frame["condition_score"].notna()
        & frame["finalprice"].between(300, 100_000)
        & frame["odo"].between(100, 350_000)
        & frame["vehicle_age"].between(0, 25)
    )
    frame = frame.loc[valid].copy()

    # Compare only close peers: same sale year, auction, model year, make,
    # model and VIN-derived trim code. The leave-one-out anchor prevents a
    # subject vehicle from setting its own expected peer price.
    group = ["sale_year", "auction", "year", "make", "model", "vin_modeltrim"]
    frame["peer_count"] = frame.groupby(group)["log_price"].transform("size")
    frame["peer_grades"] = frame.groupby(group)["condition_score"].transform("nunique")
    frame["peer_log_price_sum"] = frame.groupby(group)["log_price"].transform("sum")
    frame["peer_log_odometer"] = frame.groupby(group)["log_odometer"].transform("median")
    frame = frame.loc[frame["peer_count"].ge(8) & frame["peer_grades"].ge(2)].copy()
    frame["peer_anchor_log"] = (frame["peer_log_price_sum"] - frame["log_price"]) / (frame["peer_count"] - 1)
    frame["log_odometer_delta"] = frame["log_odometer"] - frame["peer_log_odometer"]
    frame["target"] = frame["log_price"] - frame["peer_anchor_log"]
    return frame.reset_index(drop=True)


def metrics(actual: np.ndarray, predicted: np.ndarray) -> dict[str, float]:
    absolute_error = np.abs(actual - predicted)
    return {
        "maeCad": round(float(mean_absolute_error(actual, predicted)), 2),
        "medianAeCad": round(float(median_absolute_error(actual, predicted)), 2),
        "wapePct": round(float(100 * absolute_error.sum() / actual.sum()), 3),
    }


def export_tree(estimator) -> dict[str, list[int] | list[float]]:
    tree = estimator.tree_
    return {
        "f": tree.feature.astype(int).tolist(),
        "t": np.round(tree.threshold, 7).tolist(),
        "l": tree.children_left.astype(int).tolist(),
        "r": tree.children_right.astype(int).tolist(),
        "v": np.round(tree.value[:, 0, 0], 9).tolist(),
    }


def predict_adjustment(model: GradientBoostingRegressor, score: np.ndarray, odometer_delta: np.ndarray) -> np.ndarray:
    rows = pd.DataFrame({"condition_score": score, "log_odometer_delta": odometer_delta})
    prediction = model.predict(rows)
    # The historical wholesale sample does not show an incremental Clean / Extra
    # Clean premium after peer matching. Guard against the small non-monotonic
    # artifact without inventing a premium the outcomes do not support.
    average_rows = rows.assign(condition_score=GRADE_SCORE["Average"])
    average_prediction = model.predict(average_rows)
    return np.where(score > GRADE_SCORE["Average"], np.maximum(prediction, average_prediction), prediction)


def main() -> None:
    frame = load_outcomes()
    train = frame.loc[frame["sale_year"].le(2008)]
    test = frame.loc[frame["sale_year"].ge(2009)]
    if len(train) < 20_000 or len(test) < 10_000:
        raise RuntimeError("Insufficient temporal train/test outcomes")

    model = GradientBoostingRegressor(
        loss="huber",
        alpha=0.9,
        n_estimators=140,
        learning_rate=0.04,
        max_depth=2,
        min_samples_leaf=80,
        subsample=0.8,
        random_state=RANDOM_STATE,
    )
    model.fit(train[FEATURES], train["target"])

    model_adjustment = predict_adjustment(
        model,
        test["condition_score"].to_numpy(dtype=float),
        test["log_odometer_delta"].to_numpy(dtype=float),
    )
    inference_center = float(predict_adjustment(model, np.asarray([GRADE_SCORE["Average"]]), np.asarray([0.0]))[0])
    deployed_adjustment = model_adjustment - inference_center
    predicted_price = np.exp(test["peer_anchor_log"].to_numpy(dtype=float) + deployed_adjustment)
    baseline_price = np.exp(test["peer_anchor_log"].to_numpy(dtype=float))
    actual_price = test["finalprice"].to_numpy(dtype=float)
    baseline_metrics = metrics(actual_price, baseline_price)
    model_metrics = metrics(actual_price, predicted_price)
    improvement = 100 * (baseline_metrics["maeCad"] - model_metrics["maeCad"]) / baseline_metrics["maeCad"]
    log_residual = np.log(actual_price / predicted_price)

    grade_multipliers = {
        grade: round(float(np.exp(predict_adjustment(model, np.asarray([score]), np.asarray([0.0]))[0] - inference_center)), 4)
        for grade, score in GRADE_SCORE.items()
    }

    artifact = {
        "schemaVersion": 1,
        "modelType": "gradient-boosted sold-price adjustment",
        "status": "production-prototype",
        "predictionRole": "Condition and odometer adjustment around a current Canadian peer-market anchor",
        "source": {
            "name": "Larsen (2020) dealer-to-dealer used-car auction outcomes",
            "url": "https://www.nber.org/research/data/dealer-dealer-used-car-bargaining-and-auction-data-larsen-2020",
            "downloadUrl": SOURCE_URL,
            "sha256": SOURCE_SHA256,
            "saleYears": [2006, 2010],
            "market": "United States wholesale auctions",
        },
        "target": "log(completed wholesale sale price / leave-one-out matched-peer price)",
        "features": FEATURES,
        "gradeScore": GRADE_SCORE,
        "rows": {"eligibleSoldOutcomes": int(len(frame)), "train": int(len(train)), "temporalTest": int(len(test))},
        "validation": {
            "split": "Train sale years 2006-2008; test sale years 2009-2010",
            "baseline": {"name": "Leave-one-out matched-peer geometric mean", **baseline_metrics},
            "model": model_metrics,
            "maeImprovementPct": round(float(improvement), 2),
            "logResidualP10": round(float(np.quantile(log_residual, 0.1)), 6),
            "logResidualP90": round(float(np.quantile(log_residual, 0.9)), 6),
        },
        "representativeGradeMultipliers": grade_multipliers,
        "inferenceCenter": {"conditionScore": 2, "logOdometerDelta": 0, "logAdjustment": round(inference_center, 9)},
        "featureBounds": {
            "odometerKm": [100, 350_000],
            "logOdometerDelta": [round(float(frame["log_odometer_delta"].quantile(0.01)), 6), round(float(frame["log_odometer_delta"].quantile(0.99)), 6)],
            "conditionScore": [-1, 4],
        },
        "monotonicGuard": "Scores above Average cannot predict less than Average at the same odometer delta",
        "model": {
            "initial": round(float(np.asarray(model.init_.constant_).ravel()[0]), 9),
            "learningRate": model.learning_rate,
            "trees": [export_tree(tree[0]) for tree in model.estimators_],
        },
        "limitations": [
            "The training outcomes are 2006-2010 US wholesale transactions, not current Canadian retail sales.",
            "The model is used only for relative condition and odometer adjustments around current Canadian evidence.",
            "Accident, mechanical, cosmetic, service and wear inputs are consolidated into an auction-grade equivalent; their individual dollar effects are not separately learned.",
            "A completed sale, inspection and history report remain the only ground truth for an individual vehicle.",
        ],
        "reproducibility": {"randomState": RANDOM_STATE},
    }
    summary = {"rows": artifact["rows"], "baseline": baseline_metrics, "model": model_metrics, "maeImprovementPct": artifact["validation"]["maeImprovementPct"], "gradeMultipliers": grade_multipliers}
    print(json.dumps(summary, indent=2))
    if improvement <= 0:
        raise RuntimeError("Condition adjustment model did not beat the matched-peer baseline")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(artifact, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
