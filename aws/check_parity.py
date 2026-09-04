"""Parity gate: Python port == TypeScript evaluator == training artifact.

Anchors:
  1. public/data/condition-model.json representativeGradeMultipliers
     (emitted by analysis/train_condition_model.py).
  2. Behavioral vectors from lib/condition-model.test.ts.
  3. Lambda handler contract (200 on valid, 400 on invalid).

Exit non-zero with a diff report on any mismatch. CI runs this after
analysis/run_sql.py. Stdlib only.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "aws"))

from condition_model_py import ConditionModel  # noqa: E402
from lambda_predict import handler  # noqa: E402

NEUTRAL = {
    "accidentHistory": "none",
    "mechanicalCondition": "sound",
    "cosmeticCondition": "light",
    "serviceHistory": "partial",
    "wearItems": "good",
}
GRADE_TO_SCORE = {
    "salvage": -1,
    "extra-rough": 0,
    "rough": 1,
    "average": 2,
    "clean": 3,
    "extra-clean": 4,
}
ORACLE_NAMES = {
    "salvage": "Salvage",
    "extra-rough": "Extra Rough",
    "rough": "Rough",
    "average": "Average",
    "clean": "Clean",
    "extra-clean": "Extra Clean",
}

failures: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    print(f"{'PASS' if condition else 'FAIL'} {name}" + (f" ({detail})" if detail and not condition else ""))
    if not condition:
        failures.append(f"{name}: {detail}")


def main() -> None:
    artifact = json.loads((ROOT / "public" / "data" / "condition-model.json").read_text(encoding="utf-8"))
    oracle = artifact["representativeGradeMultipliers"]
    model = ConditionModel()

    # 1. Oracle multipliers: exact grade score at anchor mileage.
    for grade, score in GRADE_TO_SCORE.items():
        result = model.predict(30000, 25000, 35000, 80000, 80000, {"conditionGrade": grade, **NEUTRAL})
        expected = oracle[ORACLE_NAMES[grade]]
        check(
            f"oracle-multiplier[{grade}]",
            abs(result["multiplier"] - expected) <= 1e-9,
            f"got {result['multiplier']}, oracle {expected}",
        )
        check(f"oracle-score[{grade}]", result["conditionScore"] == score, f"got {result['conditionScore']}")

    # 2. TS test vectors (lib/condition-model.test.ts).
    average = model.predict(30000, 25000, 35000, 80000, 80000, {"conditionGrade": "average", **NEUTRAL})
    check("ts/average-score", average["conditionScore"] == 2, str(average["conditionScore"]))
    check("ts/average-multiplier", average["multiplier"] == 1, str(average["multiplier"]))
    check("ts/average-estimate", average["estimate"] == 30000, str(average["estimate"]))
    check("ts/average-range", average["low"] < average["estimate"] < average["high"], str(average))

    rough = model.predict(
        30000, 25000, 35000, 80000, 150000,
        {"conditionGrade": "rough", "accidentHistory": "major",
         "mechanicalCondition": "major-repair", **{k: v for k, v in NEUTRAL.items()
          if k not in ("accidentHistory", "mechanicalCondition")}},
    )
    check("ts/rough-score", rough["conditionScore"] == -0.75, str(rough["conditionScore"]))
    check("ts/rough-below-average", rough["estimate"] < average["estimate"],
          f"rough {rough['estimate']} vs avg {average['estimate']}")

    clean = model.predict(30000, 25000, 35000, 80000, 80000, {"conditionGrade": "extra-clean", **NEUTRAL})
    check("ts/monotonic-guard", clean["estimate"] >= average["estimate"],
          f"clean {clean['estimate']} vs avg {average['estimate']}")

    # 3. Handler contract via API Gateway proxy event.
    ok_event = {"queryStringParameters": {
        "baseValue": "30000", "baseLow": "25000", "baseHigh": "35000",
        "baselineOdometerKm": "80000", "targetOdometerKm": "80000",
        "conditionGrade": "average", **NEUTRAL}}
    response = handler(ok_event, None)
    body = json.loads(response["body"])
    check("handler/200", response["statusCode"] == 200 and body["ok"] is True, response["body"][:200])
    check("handler/fields", body["valuation"]["estimate"] == 30000 and "model" in body, str(body)[:200])
    check("handler/cors", response["headers"].get("Access-Control-Allow-Origin") == "*", str(response["headers"]))

    bad = handler({"queryStringParameters": {**ok_event["queryStringParameters"],
                                             "conditionGrade": "mint"}}, None)
    check("handler/400-enum", bad["statusCode"] == 400 and json.loads(bad["body"])["ok"] is False, bad["body"][:200])

    missing = handler({"queryStringParameters": {"baseValue": "30000"}}, None)
    missing_body = json.loads(missing["body"])
    check("handler/400-missing", missing["statusCode"] == 400 and len(missing_body.get("details", [])) >= 10,
          missing["body"][:200])

    print(f"\n{len(failures)} failure(s)")
    if failures:
        raise SystemExit(1)
    print("PARITY-OK: python == artifact oracle == TS behavior, handler contract holds")


if __name__ == "__main__":
    main()
