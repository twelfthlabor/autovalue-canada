# Condition model: champion/challenger selection

## Status

Pre-registered 2026-09-12, before any candidate was scored on the 2008 validation split. The grid, selection rule and adoption gate below are fixed. `analysis/selection-results.json` carries the full machine-readable table; this memo records the pre-registration and, once run, the results.

## Why this pass exists

The champion hyper-parameters (depth 2, learning rate 0.04, min samples per leaf 80, Huber α 0.9, subsample 0.8, 140 trees) were never chosen against a held-out year. Sale years 2006–2008 were one training block and 2009–2010 was only ever used for reporting, so nothing in the pipeline separated model selection from final evaluation. This pass adds that separation: fit on 2006–2007, choose on 2008, and touch 2009–2010 exactly once.

## Protocol

### Split

- Fit: sale years 2006–2007, 18,201 outcomes.
- Validate: sale year 2008, 33,945 outcomes.
- Test: sale years 2009–2010, 39,132 outcomes. Evaluated once, for the selected candidate only, after it is refit on 2006–2008.

Peer groups include sale year, so no row's peer anchor crosses the split and the target construction needs no change. Candidate models are scored through the deployed inference path: monotonic guard (grades above Average cannot fall below Average at equal mileage), then centering on an Average vehicle at zero odometer delta.

### Candidate families (pre-registered)

**(a) Plain grid — 324 candidates.** Full cross product (3⁴ × 2²):

| Parameter | Values |
|---|---|
| `max_depth` | 2, 3, 4 |
| `learning_rate` | 0.02, 0.04, 0.08 |
| `min_samples_leaf` | 40, 80, 160 |
| `loss` | Huber α 0.9, Huber α 0.95, squared error |
| `subsample` | 0.8, 1.0 |
| `n_estimators` | 140, 280 |

**(b) Monotonic constraints — not executable.** Checked before the run: `sklearn.ensemble.GradientBoostingRegressor` in sklearn 1.7.0 has no `monotonic_cst` parameter and passing it raises `TypeError: __init__() got an unexpected keyword argument 'monotonic_cst'`. `HistGradientBoostingRegressor` does support monotonic constraints, but it serializes a different tree format than the one the TypeScript evaluator and Lambda port consume, so switching estimator is out of scope for this pass. The post-hoc guard stays unless a future pass migrates the estimator and its artifact format.

**(c) Sample-weight variants — 3 candidates.** Applied to the deployed champion hyper-parameters, so no weight family can be paired post-hoc with a winning grid point:

| id | Weight |
|---|---|
| `w-recency` | `sale_year - 2005` (2006→1, 2007→2; on the final refit 2008→3) |
| `w-peer-count` | `peer_count` |
| `w-price-level` | actual sale price in USD, so the log-space loss tracks dollar MAE |

### Selection rule

Lowest validation MAE. Exact ties are broken by fewer `n_estimators`, then lower `max_depth`, then lower `min_samples_leaf`, then config id. The rule and the tie-breaks are deterministic and were fixed before the run.

### Adoption gate (single test evaluation)

The selected candidate is adopted only if all three hold:

1. Test MAE ≤ 0.97 × champion test MAE = 0.97 × $1,198.19 = **$1,162.24**.
2. No v2-artifact segment with **n ≥ 2,000** degrades by **more than 2%** in MAE relative to the champion on the same test rows.
3. The regenerated artifact stays **≤ 150 KB**.

If any condition fails, the champion artifact is kept unchanged and this memo records the rejection. A rejected challenger is a successful outcome of the protocol, not a failed run.

### Test discipline

No candidate is fit or scored on 2009–2010 during selection. The single test evaluation happens after the winner is fixed, on the refit model, and is the only number in this document that comes from those rows.

## Results

_Pending execution._
