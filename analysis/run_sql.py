"""Run analysis/market_insights.sql and publish public/data/sql_summary.json.

The JSON lets the Next.js Market Lab reuse warehouse KPIs without a live DB
connection, and gives reviewers a committed artifact proving the SQL ran.

Usage:
    python analysis/run_sql.py
    python analysis/run_sql.py --database-url postgresql+psycopg://u:p@host:5432/db
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import re
import sys
from pathlib import Path

from sqlalchemy import create_engine, text

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SQL = ROOT / "analysis" / "market_insights.sql"
DEFAULT_OUT = ROOT / "public" / "data" / "sql_summary.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run warehouse analytics SQL.")
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL"))
    parser.add_argument("--sql-path", default=str(DEFAULT_SQL))
    parser.add_argument("--out-path", default=str(DEFAULT_OUT))
    return parser.parse_args()


def split_statements(sql: str) -> list[tuple[str, str]]:
    """Split file into (label, statement); labels come from '-- Qn: ...' comments in order."""
    labels = []
    for line in sql.splitlines():
        match = re.match(r"\s*--\s*(Q\d+)\s*:\s*(.+)", line)
        if match:
            slug = re.sub(r"[^a-z0-9]+", "_", match.group(2).strip().lower()).strip("_")[:48]
            labels.append(f"{match.group(1).lower()}_{slug}")
    # Strip full-line comments first so prose semicolons can never split a statement.
    code_only = "\n".join(ln for ln in sql.splitlines() if not ln.strip().startswith("--"))
    statements: list[tuple[str, str]] = []
    for part in [p.strip() for p in code_only.split(";")]:
        if not part.strip():
            continue
        if not re.match(r"(?is)\s*(with|select)\b", part):
            raise RuntimeError("Only WITH/SELECT statements are allowed in market_insights.sql")
        statements.append(part)
    if len(statements) != 6:
        raise RuntimeError(f"Expected 6 SELECT statements, found {len(statements)}")
    if len(labels) != 6:
        raise RuntimeError(f"Expected 6 '-- Qn:' labels, found {len(labels)}")
    return list(zip(labels, statements))


def main() -> None:
    args = parse_args()
    if not args.database_url:
        print("Set DATABASE_URL (see .env.example).", file=sys.stderr)
        raise SystemExit(2)

    sql_path = Path(args.sql_path)
    statements = split_statements(sql_path.read_text(encoding="utf-8"))
    engine = create_engine(args.database_url, future=True)

    queries = []
    kpi: dict = {}
    with engine.connect() as conn:
        for label, stmt in statements:
            result = conn.execute(text(stmt))
            columns = list(result.keys())
            rows = [dict(zip(columns, row)) for row in result.fetchall()]
            # JSON-safe numerics (Decimal -> float, date -> iso).
            for row in rows:
                for key, value in list(row.items()):
                    if hasattr(value, "__float__") and not isinstance(value, (int, float, str, bool, type(None))):
                        try:
                            row[key] = float(value)
                        except (TypeError, ValueError):
                            row[key] = str(value)
            queries.append({"name": label, "rows": len(rows), "columns": columns, "sample": rows[:5]})
            print(f"{label}: {len(rows)} rows")
            if label.startswith("q5"):
                kpi = rows[0] if rows else {}

    if not kpi or "national_weighted_median_cad" not in kpi:
        raise RuntimeError("Q5 national KPI missing from results")

    out_path = Path(args.out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "schemaVersion": 1,
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source": "raw.price_stats via analysis/market_insights.sql",
        "kpi": kpi,
        "queries": queries,
    }
    out_path.write_text(json.dumps(payload, indent=2, default=str) + "\n", encoding="utf-8")
    print(f"Wrote {out_path} (kpi weighted median CAD {kpi.get('national_weighted_median_cad')})")


if __name__ == "__main__":
    main()
