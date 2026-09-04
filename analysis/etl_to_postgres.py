"""Load Canadian market CSVs into PostgreSQL (local Docker == RDS-compatible).

Raw zone mirrors docs/ARCHITECTURE.md: S3 raw -> Postgres curated.
Same boto3 code path reads local files or s3:// URIs, so the free-tier
story (upload once to S3, run against RDS) needs no code change.

Idempotent: each run recreates raw.price_stats / raw.inventory_counts
inside one transaction. Quality gates mirror scripts/build-market-data.mjs
but are NON-fatal here: failing rows are kept with is_valid=false and a
rejection_reason, so warehouse counts always reconcile to source CSVs.

Usage:
    python analysis/etl_to_postgres.py
    python analysis/etl_to_postgres.py --database-url postgresql+psycopg://u:p@host:5432/db
    S3_PRICE_STATS_URI=s3://bucket/price_stats_by_model_year.csv python analysis/etl_to_postgres.py
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlparse

import pandas as pd
from sqlalchemy import create_engine, text

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PRICE_STATS = ROOT / "data" / "raw" / "price_stats_by_model_year.csv"
DEFAULT_INVENTORY = ROOT / "data" / "raw" / "inventory_counts.csv"

# Must stay in sync with scripts/build-market-data.mjs expectedHeaders.
PRICE_STATS_COLUMNS = [
    "province", "make", "model", "model_year", "condition", "vehicles",
    "price_p10", "price_p25", "price_median", "price_p75", "price_p90",
    "price_mean", "mileage_median", "days_on_market_median",
]
INVENTORY_COLUMNS = ["province", "make", "model", "model_year", "condition", "vehicles"]

NUMERIC_PRICE_STATS = [
    "model_year", "vehicles",
    "price_p10", "price_p25", "price_median", "price_p75", "price_p90",
    "price_mean", "mileage_median", "days_on_market_median",
]
# Gates mirror the Node build; mileage/DOM may be blank for New inventory
# (28 rows: Node coerces '' -> 0 via Number(''), warehouse preserves NULL).
REQUIRED_NUMERICS = [
    "model_year", "vehicles",
    "price_p10", "price_p25", "price_median", "price_p75", "price_p90",
    "price_mean",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Load market CSVs into Postgres raw schema.")
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL"), help="SQLAlchemy URL")
    parser.add_argument("--s3-price-stats-uri", default=os.environ.get("S3_PRICE_STATS_URI") or "")
    parser.add_argument("--s3-inventory-uri", default=os.environ.get("S3_INVENTORY_URI") or "")
    parser.add_argument("--aws-region", default=os.environ.get("AWS_REGION", "ca-central-1"))
    return parser.parse_args()


def download_s3_uri(uri: str, region: str) -> Path:
    """Download s3://bucket/key to a temp file via boto3 (imported lazily)."""
    try:
        import boto3
    except ImportError as exc:
        raise RuntimeError("boto3 is required for s3:// sources (pip install -r requirements.txt)") from exc
    parsed = urlparse(uri)
    if parsed.scheme != "s3" or not parsed.netloc:
        raise ValueError(f"Invalid S3 URI: {uri}")
    tmp = Path(tempfile.mkstemp(suffix=".csv")[1])
    boto3.client("s3", region_name=region).download_file(parsed.netloc, parsed.path.lstrip("/"), str(tmp))
    return tmp


def resolve_source(local: Path, s3_uri: str, region: str) -> Path:
    if s3_uri.strip():
        print(f"Reading from S3: {s3_uri}")
        return download_s3_uri(s3_uri.strip(), region)
    if not local.exists():
        raise FileNotFoundError(f"Missing source CSV: {local}")
    return local


def read_validated_csv(path: Path, expected: list[str], numerics: list[str]) -> pd.DataFrame:
    frame = pd.read_csv(path)
    if list(frame.columns) != expected:
        raise RuntimeError(f"Unexpected schema in {path.name}: {list(frame.columns)}")
    if len(frame) == 0:
        raise RuntimeError(f"Zero rows in {path.name}")
    for column in numerics:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    return frame


def flag_price_stats_quality(frame: pd.DataFrame) -> pd.DataFrame:
    """Mirror Node build gates; flag instead of drop so counts reconcile."""
    out = frame.copy()
    reasons = pd.Series(["" for _ in range(len(out))], index=out.index)

    prices = out[["price_p10", "price_p25", "price_median", "price_p75", "price_p90"]]
    monotonic = (
        prices.notna().all(axis=1)
        & (prices["price_p10"] <= prices["price_p25"])
        & (prices["price_p25"] <= prices["price_median"])
        & (prices["price_median"] <= prices["price_p75"])
        & (prices["price_p75"] <= prices["price_p90"])
    )
    positive = (prices > 0).all(axis=1).fillna(False)
    size_ok = (out["vehicles"] >= 10).fillna(False)
    numerics_ok = out[REQUIRED_NUMERICS].notna().all(axis=1)

    out["is_valid"] = bool(True)
    out["is_valid"] = monotonic & positive & size_ok & numerics_ok
    reasons[~monotonicsafe(monotonic)] = "percentile_order"
    reasons[~monotonicsafe(positive)] = reasons[~monotonicsafe(positive)].where(
        reasons[~monotonicsafe(positive)] != "", "non_positive_price"
    )
    reasons[~monotonicsafe(size_ok)] = reasons[~monotonicsafe(size_ok)].where(
        reasons[~monotonicsafe(size_ok)] != "", "sample_below_10"
    )
    reasons[~monotonicsafe(numerics_ok)] = reasons[~monotonicsafe(numerics_ok)].where(
        reasons[~monotonicsafe(numerics_ok)] != "", "non_numeric_field"
    )
    out["rejection_reason"] = reasons.where(~out["is_valid"], "")
    return out


def monotonicsafe(series: pd.Series) -> pd.Series:
    return series.fillna(False).astype(bool)


DDL = """
CREATE SCHEMA IF NOT EXISTS raw;
DROP TABLE IF EXISTS raw.price_stats;
-- mileage_median is nullable: 28 New-inventory rows ship blank mileage.
-- (The Node build coerces blank to 0, the warehouse preserves NULL.)
CREATE TABLE raw.price_stats (
    province TEXT NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    model_year INTEGER NOT NULL,
    condition TEXT NOT NULL,
    vehicles INTEGER NOT NULL,
    price_p10 DOUBLE PRECISION NOT NULL,
    price_p25 DOUBLE PRECISION NOT NULL,
    price_median DOUBLE PRECISION NOT NULL,
    price_p75 DOUBLE PRECISION NOT NULL,
    price_p90 DOUBLE PRECISION NOT NULL,
    price_mean DOUBLE PRECISION NOT NULL,
    mileage_median DOUBLE PRECISION,
    days_on_market_median DOUBLE PRECISION NOT NULL,
    is_valid BOOLEAN NOT NULL,
    rejection_reason TEXT NOT NULL DEFAULT ''
);
DROP TABLE IF EXISTS raw.inventory_counts;
CREATE TABLE raw.inventory_counts (
    province TEXT NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    model_year INTEGER NOT NULL,
    condition TEXT NOT NULL,
    vehicles INTEGER NOT NULL
);
"""

INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_price_stats_lookup ON raw.price_stats (province, make, model, model_year);",
    "CREATE INDEX IF NOT EXISTS idx_price_stats_condition ON raw.price_stats (condition);",
    "CREATE INDEX IF NOT EXISTS idx_inventory_lookup ON raw.inventory_counts (province, make, model, model_year);",
]


def ddl_statements(ddl: str) -> list[str]:
    """Split DDL on semicolons after stripping -- comments (so comments are free-form)."""
    lines = [ln for ln in ddl.splitlines() if not ln.strip().startswith("--")]
    return [s.strip() for s in "\n".join(lines).split(";") if s.strip()]


def main() -> None:
    args = parse_args()
    if not args.database_url:
        print("Set DATABASE_URL (see .env.example).", file=sys.stderr)
        raise SystemExit(2)

    price_path = resolve_source(DEFAULT_PRICE_STATS, args.s3_price_stats_uri, args.aws_region)
    inventory_path = resolve_source(DEFAULT_INVENTORY, args.s3_inventory_uri, args.aws_region)

    price = flag_price_stats_quality(
        read_validated_csv(price_path, PRICE_STATS_COLUMNS, NUMERIC_PRICE_STATS)
    )
    inventory = read_validated_csv(inventory_path, INVENTORY_COLUMNS, ["model_year", "vehicles"])
    inventory["vehicles"] = inventory["vehicles"].astype(int)

    engine = create_engine(args.database_url, future=True)
    with engine.begin() as conn:
        for statement in ddl_statements(DDL):
            conn.execute(text(statement))
        price.to_sql("price_stats", conn, schema="raw", if_exists="append", index=False, chunksize=1000, method="multi")
        inventory.to_sql("inventory_counts", conn, schema="raw", if_exists="append", index=False, chunksize=1000, method="multi")
        for statement in INDEXES:
            conn.execute(text(statement))
        db_price = conn.execute(text("SELECT count(*) FROM raw.price_stats")).scalar()
        db_used = conn.execute(
            text("SELECT count(*) FROM raw.price_stats WHERE condition = 'Used' AND is_valid")
        ).scalar()
        db_vehicles = conn.execute(text("SELECT COALESCE(SUM(vehicles),0) FROM raw.price_stats")).scalar()
        db_inv = conn.execute(text("SELECT count(*) FROM raw.inventory_counts")).scalar()

    assert db_price == len(price), f"price_stats row mismatch: db={db_price} csv={len(price)}"
    assert db_inv == len(inventory), f"inventory row mismatch: db={db_inv} csv={len(inventory)}"

    summary = {
        "price_stats_rows": int(db_price),
        "price_stats_valid_used_cells": int(db_used),
        "price_stats_vehicles": int(db_vehicles),
        "price_stats_invalid_rows": int((~price["is_valid"]).sum()),
        "inventory_rows": int(db_inv),
        "source": {"price_stats": str(price_path), "inventory": str(inventory_path)},
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
