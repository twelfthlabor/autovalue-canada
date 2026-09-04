# Lambda prediction service

Serves the trained condition-and-mileage adjustment as an HTTP API.
Pure-Python port of `lib/condition-model.ts` — stdlib only, no layers.

| File | Purpose |
|---|---|
| `condition_model_py.py` | Exact port of the TS evaluator over `public/data/condition-model.json` |
| `lambda_predict.py` | API Gateway proxy handler (`handler`), query/body/direct input, 200/400 + CORS |
| `check_parity.py` | Gate proving python == artifact oracle == TS behavior (CI runs it) |

## Local check

```bash
python -m pip install -r requirements.txt  # nothing extra needed (stdlib only)
python aws/check_parity.py
```

## Package for Lambda (Python 3.11, arm64 or x86_64 to match the function)

```bash
mkdir -p dist && cp aws/lambda_predict.py aws/condition_model_py.py dist/
cp public/data/condition-model.json dist/
python -c "import zipfile,pathlib; z=zipfile.ZipFile('dist/predict.zip','w',zipfile.ZIP_DEFLATED); [z.write(p,p.name) for p in map(pathlib.Path,('dist/lambda_predict.py','dist/condition_model_py.py','dist/condition-model.json'))]; z.close()"
```

Handler: `lambda_predict.handler`. Optional env: `CONDITION_MODEL_PATH`
(defaults to the bundled `condition-model.json`, else repo `public/data/`).

Full free-tier deploy (S3 + RDS + Lambda + API Gateway): `docs/AWS_DEPLOY.md`.
