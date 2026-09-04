"""AWS Lambda handler serving the condition-adjusted valuation model.

Deploy: zip this file with condition_model_py.py plus a copy of
public/data/condition-model.json, set CONDITION_MODEL_PATH if the
artifact lives elsewhere in the package. No third-party dependencies.

Accepts API Gateway proxy events (v1/v2 query params or JSON body) and
direct-invoke dicts. Responds with API Gateway proxy format + CORS.

Example:
    GET /predict?baseValue=30000&baseLow=25000&baseHigh=35000
        &baselineOdometerKm=80000&targetOdometerKm=80000
        &conditionGrade=average&accidentHistory=none
        &mechanicalCondition=sound&cosmeticCondition=light
        &serviceHistory=partial&wearItems=good
"""

from __future__ import annotations

import json
import math
import os
from pathlib import Path

from condition_model_py import (
    ACCIDENT_ADJUSTMENT,
    COSMETIC_ADJUSTMENT,
    GRADE_SCORE,
    MECHANICAL_ADJUSTMENT,
    SERVICE_ADJUSTMENT,
    WEAR_ADJUSTMENT,
    ConditionModel,
)

ENUMS = {
    "conditionGrade": set(GRADE_SCORE),
    "accidentHistory": set(ACCIDENT_ADJUSTMENT),
    "mechanicalCondition": set(MECHANICAL_ADJUSTMENT),
    "cosmeticCondition": set(COSMETIC_ADJUSTMENT),
    "serviceHistory": set(SERVICE_ADJUSTMENT),
    "wearItems": set(WEAR_ADJUSTMENT),
}
NUMERICS = ("baseValue", "baseLow", "baseHigh", "baselineOdometerKm", "targetOdometerKm")

_MODEL: ConditionModel | None = None


def _artifact_path() -> Path:
    override = os.environ.get("CONDITION_MODEL_PATH")
    if override:
        return Path(override)
    task_root = os.environ.get("LAMBDA_TASK_ROOT")
    if task_root and (Path(task_root) / "condition-model.json").exists():
        return Path(task_root) / "condition-model.json"
    return Path(__file__).resolve().parents[1] / "public" / "data" / "condition-model.json"


def get_model() -> ConditionModel:
    global _MODEL
    if _MODEL is None:
        _MODEL = ConditionModel(_artifact_path())
    return _MODEL


def _coerce_number(name: str, value: object, errors: list[str]) -> float | None:
    try:
        number = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        errors.append(f"{name} must be a number")
        return None
    if not math.isfinite(number):
        errors.append(f"{name} must be finite")
        return None
    return number


def parse_params(raw: dict) -> tuple[dict | None, list[str]]:
    errors: list[str] = []
    params: dict = {}
    for name in NUMERICS:
        if name not in raw or raw[name] in (None, ""):
            errors.append(f"missing {name}")
            continue
        value = _coerce_number(name, raw[name], errors)
        if value is not None:
            params[name] = value
    for name in ("baseValue", "baseLow", "baseHigh"):
        if name in params and params[name] <= 0:
            errors.append(f"{name} must be positive")
    for name in ("baselineOdometerKm", "targetOdometerKm"):
        if name in params and params[name] < 0:
            errors.append(f"{name} must be >= 0")

    profile: dict = {}
    for name, allowed in ENUMS.items():
        value = raw.get(name)
        if value not in allowed:
            errors.append(f"{name} must be one of {sorted(allowed)}")
        else:
            profile[name] = value
    if not errors:
        params["profile"] = profile
        return params, []
    return None, errors


def _event_params(event: dict) -> dict:
    if not isinstance(event, dict):
        return {}
    query = event.get("queryStringParameters") or {}
    if query:
        return dict(query)
    body = event.get("body")
    if isinstance(body, str) and body.strip():
        try:
            parsed = json.loads(body)
        except json.JSONDecodeError:
            return {"__bad_body__": True}
        return parsed if isinstance(parsed, dict) else {}
    if any(key in event for key in NUMERICS):
        return {k: v for k, v in event.items() if k in NUMERICS or k in ENUMS}
    return {}


def _response(status: int, payload: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
        "body": json.dumps(payload),
    }


def handler(event: dict, context: object = None) -> dict:
    _ = context
    raw = _event_params(event or {})
    if raw.get("__bad_body__"):
        return _response(400, {"ok": False, "error": "body must be valid JSON"})
    params, errors = parse_params(raw)
    if params is None:
        return _response(400, {"ok": False, "error": "invalid parameters", "details": errors})
    valuation = get_model().predict(
        base_value=params["baseValue"],
        base_low=params["baseLow"],
        base_high=params["baseHigh"],
        baseline_odometer_km=params["baselineOdometerKm"],
        target_odometer_km=params["targetOdometerKm"],
        profile=params["profile"],
    )
    return _response(200, {"ok": True, "valuation": valuation, "model": get_model().metadata()})
