# Architecture

## Release 0.1: Vercel portfolio demo

```text
Attributed aggregate CSV
        │
        ▼
Node data build ─── schema + QA gates ─── SHA-256 provenance
        │
        ▼
Compact static JSON
        │
        ▼
Next.js application ─── Vercel CDN
        │
        ├── Consumer price-check experience
        ├── Methodology and claim boundaries
        └── Data control room
```

The initial app is static-first for the core market comparison. One small POST-only server route validates VIN input, calls the official NHTSA vPIC decoder and checks a reviewed public-listing evidence registry. The VIN is kept out of the URL and is not persisted. A decoder outage cannot break the manual price-check experience, and the supplied demonstration VIN has a verified cached decode for resilient portfolio review.

```text
VIN form ──POST──► Vercel route ──► NHTSA vPIC
                       │
                       └──► reviewed listing registry
                                  │
                                  ├──► matched-comparable OLS + deal signal
                                  └──► broad market-cell fallback
```

The pricing hierarchy is fail-closed: (1) use a reviewed exact listing and same-specification comparables when available; (2) otherwise use the decoded identity only when it maps to a published aggregate cell; (3) otherwise show the decode without a price result. The previous form selection is never treated as evidence for an unmatched VIN.

The matched model requires at least four valid positive-price/positive-odometer observations, excludes the subject VIN, estimates a linear mileage coefficient and returns a rounded fitted target plus or minus residual RMSE. It also records R², observed odometer bounds and whether the target is extrapolated. These diagnostics are descriptive for the captured asking-price sample, not completed-sale validation.

## Production target for the role

```text
Licensed market feed      Transport Canada       NRCan / Statistics Canada
          │                       │                         │
          └──────────────► S3 raw zone ◄──────────────────┘
                                  │
                           Glue data contracts
                                  │
                         S3 curated + Redshift
                                  │
                    SageMaker training / registry
                       │                    │
                 QA + drift suite     Lambda/API Gateway
                       │                    │
                  Tableau review      Vercel application
```

This separation lets the public product remain responsive while demonstrating the AWS, ETL, SQL, model-deployment and monitoring responsibilities in the target J.D. Power role.

## Accuracy and observability

### Data gates

- schema and type validation;
- composite-key uniqueness;
- valid percentile ordering;
- sample suppression enforcement;
- referential coverage for external joins;
- artifact checksum and retrieval metadata.

### Future model gates

- time-based train/validation/test splits;
- median-cell and hedonic-regression baselines;
- MAE and median absolute percentage error;
- quantile interval coverage;
- segment error by province, make, powertrain, price band and sample density;
- drift on inputs and residuals;
- champion/challenger comparison and rollback.

### Deployment boundary

Vercel hosts the interface and server-side proxy routes only. Training and long-running ETL do not run in Vercel functions. Vercel Hobby cron jobs can run only daily and have imprecise timing; the production data plane therefore belongs in AWS or GitHub Actions for the portfolio stage.
