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

The initial app is static-first. This avoids putting a paid or restricted market-data API behind an unprotected public endpoint, eliminates cold-start dependency for the core experience and keeps the source artifact exactly reproducible.

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
