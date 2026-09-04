<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Stack map

- Next.js app (Vercel) is static-first: pages read committed JSON in `public/data/`, never a live DB. Postgres/Lambda are additive and CI-verified, not wired into runtime.
- `scripts/build-market-data.mjs` owns the gates all loaders must mirror: exact CSV headers, monotonic p10≤p25≤p50≤p75≤p90, prices > 0, `vehicles >= 10`, no duplicate composite keys.
- Python lives in `analysis/` (training, ETL, SQL runner) and `aws/` (Lambda serve). TS model logic lives in `lib/condition-model.ts`.

## Commands (CI order matters)

```
npm run build:data                                   # regenerates market.json + manifest.json
DATABASE_URL=... python analysis/etl_to_postgres.py  # needs Postgres 16, asserts DB counts == CSV counts
DATABASE_URL=... python analysis/run_sql.py          # writes public/data/sql_summary.json
python aws/check_parity.py                           # stdlib only, no DB needed
npm run model:benchmark | npm run model:train-condition
npm test | npm run lint | npm run build | npm run test:e2e
```

- Full CI is `.github/workflows/ci.yml` (postgres:16 service, Python 3.11). Pushing workflow-file changes requires a token with the `workflow` scope (`gh auth refresh -s workflow`); without it the push is rejected.
- No `DATABASE_URL` → ETL/runner exit 2 by design. Market Lab reads `sql_summary.json` statically, so refresh the file, don't add a DB connection to the app.

## Environment gotchas (this Mac)

- No docker/node/npm and no AWS CLI/creds here; CI is the only place Node steps run.
- Python: use 3.11 (`/Library/Frameworks/Python.framework/Versions/3.11/bin/python3 -m venv`). `python3.13`/`3.14` have no pip and `requirements.txt` pins (numpy 2.1.3, pandas 2.2.2) lack 3.13 wheels — installs hang building from source. Never upgrade pins without checking 3.11 wheels first.
- Postgres without docker: `brew install postgresql@16`, `initdb` a throwaway cluster (`/tmp/...`), `pg_ctl -D ... -o "-p 5432" start`, `CREATE ROLE/DATABASE autovalue`.

## Data traps (verified the hard way)

- 28 New-inventory rows have blank `mileage_median`. Node `Number('')` → 0, pandas → NaN: the warehouse keeps them NULL (`mileage_median` is nullable by design) and still valid, matching the Node build. Don't "fix" by tightening the DDL.
- Postgres has no `round(double, int)`: cast the whole expression — `ROUND((...)::numeric, 2)`, not the inner term.
- Statement splitters strip full-line `--` comments before splitting on `;` (verified: semicolons inside such comments are safe anywhere). Every remaining non-empty chunk must start with WITH/SELECT. `-- Qn:` labels go on their own lines in `market_insights.sql` (exactly 6 SELECTs + 6 labels, order-matched, enforced).
- `model-metrics.json` regenerates nondeterministically across BLAS/threading (~43% vs ~45% improvement); `sql_summary.json` churns on `generatedAt`. Restore both after incidental runs — commit only intentional refreshes.

## TS↔Python parity contract

- `aws/condition_model_py.py` must mirror `lib/condition-model.ts` exactly, including JS `Math.round` half-up (`js_round`, not banker's `round()`) and `raw_delta != log_delta` float equality. `aws/check_parity.py` anchors both to the artifact's `representativeGradeMultipliers` + `lib/condition-model.test.ts` vectors — extend it when touching either implementation.
- Lambda packaging: stdlib only, zip `lambda_predict.py` + `condition_model_py.py` + `condition-model.json`, handler `lambda_predict.handler`. Deploy details: `docs/AWS_DEPLOY.md`.
