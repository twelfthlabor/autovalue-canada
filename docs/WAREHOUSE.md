# Postgres warehouse (PostgreSQL 16, RDS-compatible)

The same CSVs also load into Postgres for SQL analytics. Local Docker matches
AWS RDS (PostgreSQL 16), so queries run unchanged in both places.

```bash
cp .env.example .env  # edit DATABASE_URL for RDS when needed
docker compose up -d db
python -m pip install -r requirements.txt
python analysis/etl_to_postgres.py
python analysis/run_sql.py  # writes public/data/sql_summary.json
```

S3 raw zone (optional, same boto3 path): upload the two CSVs, then set
`S3_PRICE_STATS_URI` / `S3_INVENTORY_URI` instead of using `data/raw/`.
See `analysis/market_insights.sql` for the six warehouse queries
(province-year medians, dispersion, depreciation proxy, DOM buckets,
national KPI, thin-cell flags).

