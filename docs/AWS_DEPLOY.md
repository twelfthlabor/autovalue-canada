# AWS free-tier deploy runbook

Takes the warehouse + model from laptop to AWS without code changes.
All resources below fit the 12-month free tier when sized as shown.
Stop/pause everything afterwards if it was a portfolio exercise.

> **Manual prerequisites (do once, in the AWS console):**
> 1. AWS account + MFA on the root user.
> 2. IAM user with programmatic access (least privilege: S3, RDS, Lambda,
>    API Gateway, CloudWatch Logs) + access key.
> 3. Locally: `pip install awscli` (or `brew install awscli`), then
>    `aws configure --region ca-central-1` (closest to Canadian users).

## 1. Raw zone on S3 (free: 5 GB)

```bash
aws s3 mb s3://autovalue-ca-raw --region ca-central-1
aws s3 cp data/raw/price_stats_by_model_year.csv s3://autovalue-ca-raw/price_stats_by_model_year.csv
aws s3 cp data/raw/inventory_counts.csv s3://autovalue-ca-raw/inventory_counts.csv
```

## 2. Postgres on RDS (free: 750 hrs/mo `db.t3.micro`, 20 GB gp2)

Console → RDS → Create database → PostgreSQL 16, `db.t3.micro`,
storage 20 GB, database name `autovalue`, public access NO (use the
EC2/Cloud9 SG path or temporarily allow your IP). Note the endpoint, then:

```bash
export DATABASE_URL='postgresql+psycopg://autovalue:<password>@<endpoint>:5432/autovalue'
export S3_PRICE_STATS_URI=s3://autovalue-ca-raw/price_stats_by_model_year.csv
export S3_INVENTORY_URI=s3://autovalue-ca-raw/inventory_counts.csv
python analysis/etl_to_postgres.py   # same command as local/CI
python analysis/run_sql.py
```

Expected: `price_stats_rows 7673`, `valid_used_cells 5605`,
KPI weighted median ≈ `$33,771`.

## 3. Predictor on Lambda + API Gateway (free: 1M req/mo each)

```bash
# package (see aws/README.md), then:
aws lambda create-function --function-name autovalue-predict \
  --runtime python3.11 --handler lambda_predict.handler \
  --role <lambda-exec-role-arn> --zip-file fileb://dist/predict.zip \
  --timeout 10 --memory-size 256
aws lambda create-function-url-config --function-name autovalue-predict \
  --auth-type NONE --cors AllowOrigins='*'
```

Smoke test (mirrors `aws/check_parity.py` handler cases):

```bash
curl -G '<function-url>/predict' --data-urlencode 'baseValue=30000' \
  --data-urlencode 'baseLow=25000' --data-urlencode 'baseHigh=35000' \
  --data-urlencode 'baselineOdometerKm=80000' --data-urlencode 'targetOdometerKm=80000' \
  --data-urlencode 'conditionGrade=average' --data-urlencode 'accidentHistory=none' \
  --data-urlencode 'mechanicalCondition=sound' --data-urlencode 'cosmeticCondition=light' \
  --data-urlencode 'serviceHistory=partial' --data-urlencode 'wearItems=good'
# expect: {"ok": true, "valuation": {"estimate": 30000, ...}}
```

Prefer REST API + usage plans over the Function URL for a portfolio
with throttling; the handler already speaks proxy-event format for both.

## 4. Cost guardrails

- Tag everything `project=autovalue-canada`; set a $5 Billing Alarm.
- RDS: stop the instance when idle (console → Stop); storage still bills pennies.
- S3: two CSVs ≈ 1.6 MB — negligible. No NAT gateway, no VPC endpoints.
