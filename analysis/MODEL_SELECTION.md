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

Executed 2026-09-12 with sklearn 1.7.0, `random_state=42`, 6 parallel workers. The complete 327-row table is `analysis/selection-results.json`; the ranked copy appears in the appendix.

### Monotonic check (recorded before the run)

`sklearn.ensemble.GradientBoostingRegressor` in sklearn 1.7.0 has no `monotonic_cst` parameter (`TypeError` on construction), so family (b) could not be executed. The deployed post-hoc guard therefore stays in `analysis/train_condition_model.py`, `lib/condition-model.ts` and `aws/condition_model_py.py`; its behaviour remains covered by the existing TS and parity tests (Clean/Extra Clean never fall below Average at equal mileage). `HistGradientBoostingRegressor` does support monotonic constraints, but it serializes a different tree format than the TypeScript evaluator consumes, so that migration is out of scope.

### Validation grid — 2008, 33,945 rows, 327 candidates

The champion (`g049`) ranks **39 of 327** on validation MAE at **$1,322.17** — the deployed hyper-parameters were never selected against a held-out year, and this split shows it.

Top 10:

| # | id | configuration | val MAE | val medAE | val WAPE |
|---|---|---|---|---|---|
| 1 | `w-price-level` | depth 2, lr 0.04, leaf 80, huber α 0.9, subsample 0.8, 140 trees, weight=price | $1,280.42 | $971.38 | 12.343% |
| 2 | `w-peer-count` | depth 2, lr 0.04, leaf 80, huber α 0.9, subsample 0.8, 140 trees, weight=peer | $1,287.28 | $966.16 | 12.409% |
| 3 | `g001` | depth 2, lr 0.02, leaf 40, huber α 0.9, subsample 0.8, 140 trees | $1,288.98 | $979.09 | 12.426% |
| 4 | `g013` | depth 2, lr 0.02, leaf 80, huber α 0.9, subsample 0.8, 140 trees | $1,288.98 | $979.52 | 12.426% |
| 5 | `g025` | depth 2, lr 0.02, leaf 160, huber α 0.9, subsample 0.8, 140 trees | $1,290.04 | $981.3 | 12.436% |
| 6 | `g027` | depth 2, lr 0.02, leaf 160, huber α 0.9, subsample 1.0, 140 trees | $1,290.09 | $979.65 | 12.436% |
| 7 | `g003` | depth 2, lr 0.02, leaf 40, huber α 0.9, subsample 1.0, 140 trees | $1,290.72 | $979.77 | 12.442% |
| 8 | `g015` | depth 2, lr 0.02, leaf 80, huber α 0.9, subsample 1.0, 140 trees | $1,290.73 | $979.77 | 12.443% |
| 9 | `g029` | depth 2, lr 0.02, leaf 160, huber α 0.95, subsample 0.8, 140 trees | $1,295.39 | $983.88 | 12.488% |
| 10 | `g031` | depth 2, lr 0.02, leaf 160, huber α 0.95, subsample 1.0, 140 trees | $1,295.7 | $984.56 | 12.49% |

Best configuration per parameter value:

| Parameter value | id | val MAE | configuration |
|---|---|---|---|
| `max_depth` = 2 | `w-price-level` | $1,280.42 | depth 2, lr 0.04, leaf 80, huber α 0.9, subsample 0.8, 140 trees, weight=price |
| `max_depth` = 3 | `g133` | $1,307.59 | depth 3, lr 0.02, leaf 160, huber α 0.9, subsample 0.8, 140 trees |
| `max_depth` = 4 | `g219` | $1,332.3 | depth 4, lr 0.02, leaf 40, huber α 0.9, subsample 1.0, 140 trees |
| `learning_rate` = 0.02 | `g001` | $1,288.98 | depth 2, lr 0.02, leaf 40, huber α 0.9, subsample 0.8, 140 trees |
| `learning_rate` = 0.04 | `w-price-level` | $1,280.42 | depth 2, lr 0.04, leaf 80, huber α 0.9, subsample 0.8, 140 trees, weight=price |
| `learning_rate` = 0.08 | `g087` | $1,340.94 | depth 2, lr 0.08, leaf 80, huber α 0.9, subsample 1.0, 140 trees |
| `min_samples_leaf` = 40 | `g001` | $1,288.98 | depth 2, lr 0.02, leaf 40, huber α 0.9, subsample 0.8, 140 trees |
| `min_samples_leaf` = 80 | `w-price-level` | $1,280.42 | depth 2, lr 0.04, leaf 80, huber α 0.9, subsample 0.8, 140 trees, weight=price |
| `min_samples_leaf` = 160 | `g025` | $1,290.04 | depth 2, lr 0.02, leaf 160, huber α 0.9, subsample 0.8, 140 trees |
| `subsample` = 0.8 | `w-price-level` | $1,280.42 | depth 2, lr 0.04, leaf 80, huber α 0.9, subsample 0.8, 140 trees, weight=price |
| `subsample` = 1.0 | `g027` | $1,290.09 | depth 2, lr 0.02, leaf 160, huber α 0.9, subsample 1.0, 140 trees |
| `n_estimators` = 140 | `w-price-level` | $1,280.42 | depth 2, lr 0.04, leaf 80, huber α 0.9, subsample 0.8, 140 trees, weight=price |
| `n_estimators` = 280 | `g004` | $1,317.97 | depth 2, lr 0.02, leaf 40, huber α 0.9, subsample 1.0, 280 trees |

Sample-weight family (champion hyper-parameters):

| id | weight | val MAE | val medAE | val WAPE | overall rank |
|---|---|---|---|---|---|
| `w-price-level` | price | $1,280.42 | $971.38 | 12.343% | 1 |
| `w-peer-count` | peer | $1,287.28 | $966.16 | 12.409% | 2 |
| `w-recency` | recency | $1,325.55 | $1,009.81 | 12.778% | 45 |

Deeper trees, higher learning rates and 280-tree ensembles all lost on validation; the grid's best plain candidate (`g001`, depth 2, lr 0.02, 140 trees) reached $1,288.98. What actually moved the needle was loss shaping: `w-price-level` won at **$1,280.42** ($41.75/row better than the champion), with `w-peer-count` second at $1,287.28 and `w-recency` mid-pack at $1,325.55.

### Selection

Selected candidate: **`w-price-level`** — champion hyper-parameters with sample weight = actual sale price, by the pre-registered lowest-validation-MAE rule. No candidate was scored on test during selection.

### Single test evaluation — 2009-2010, 39,132 rows

`w-price-level` refit on 2006-2008, scored once:

| Metric | Champion | `w-price-level` | Change |
|---|---:|---:|---:|
| MAE | $1,198.19 | $1,142.13 | -4.68% |
| Median absolute error | $884.56 | $842.74 | -4.73% |
| WAPE | 11.601% | 11.058% | -4.68% |

Log-residual P10/P90 for the challenger: -0.169941 / 0.254546.

### Adoption gate

| Gate | Threshold | Observed | Result |
|---|---|---|---|
| Test MAE | ≤ $1,162.24 | $1,142.13 | pass |
| Segment degradation (n ≥ 2,000) | none > 2% | `$0-5k` +6.92% | **FAIL** |
| Artifact size | ≤ 150 KB | ≈ 37,891 B estimated | pass |

**Verdict: reject.** The champion artifact stays unchanged. Seventeen of the eighteen qualifying segments improve with price weighting — 2010 −11.74%, S6 −10.58%, $20k+ −9.49%, $10–20k −8.31% — but the cheapest band pays for it: `$0-5k` MAE rises from $722.48 to $772.49 (+6.92%) on 8,496 rows. Weighting the loss by price shifts capacity toward expensive vehicles, and the pre-registered gate forbids accepting that trade.

Full qualification table (segments with n ≥ 2,000):

| Axis | Segment | n | Champion MAE | `w-price-level` MAE | Change |
|---|---|---|---:|---:|---:|
| saleYear | 2010 | 3,016 | $1,015.96 | $896.65 | -11.74% |
| logOdometerDeltaSextile | S6 | 6,522 | $1,473.95 | $1,318.06 | -10.58% |
| priceBand | $20k+ | 3,355 | $2,129.83 | $1,927.76 | -9.49% |
| peerCountTercile | T3 | 12,830 | $1,230.58 | $1,127.32 | -8.39% |
| priceBand | $10-20k | 14,737 | $1,442.71 | $1,322.87 | -8.31% |
| logOdometerDeltaSextile | S5 | 6,522 | $1,053.31 | $966.47 | -8.24% |
| auctionGrade | Clean | 9,607 | $1,351.31 | $1,263.81 | -6.48% |
| auctionGrade | Rough | 9,184 | $1,095.69 | $1,045.13 | -4.61% |
| logOdometerDeltaSextile | S4 | 6,037 | $944.66 | $902.49 | -4.46% |
| saleYear | 2009 | 36,116 | $1,213.41 | $1,162.63 | -4.18% |
| peerCountTercile | T2 | 13,232 | $1,161.13 | $1,114.96 | -3.98% |
| auctionGrade | Average | 18,546 | $1,145.42 | $1,104.30 | -3.59% |
| logOdometerDeltaSextile | S1 | 6,522 | $1,581.84 | $1,550.04 | -2.01% |
| peerCountTercile | T1 | 13,070 | $1,203.91 | $1,184.17 | -1.64% |
| priceBand | $5-10k | 12,544 | $983.95 | $970.02 | -1.42% |
| logOdometerDeltaSextile | S3 | 7,007 | $984.87 | $974.06 | -1.10% |
| logOdometerDeltaSextile | S2 | 6,522 | $1,147.52 | $1,136.32 | -0.98% |
| priceBand | $0-5k | 8,496 | $722.48 | $772.49 | +6.92% |

### Decision

- The challenger is rejected under the pre-registered gate; `public/data/condition-model.json` remains the WS-1 artifact (38,076 bytes, schema v2).
- Family (b) is closed until the estimator/tree-format migration is scoped; the post-hoc monotonic guard stays.
- Price-weighted training is a promising direction (best validation and test MAE of 327 candidates) but needs an explicit fix for the $0–5k band. Any revision is a new pre-registration; it must not be tuned against the 2009–2010 numbers already observed here.
- Run note: the first execution computed the single test evaluation but crashed while estimating artifact bytes (`model.estimators_` is a 2-D array; fixed to `estimator[0]`). The rerun reproduced the identical winner and identical test metrics deterministically. No other candidate was ever scored on test.
- Defect-fix rerun (2026-09-12): after restricting the champion lookup to `family == "plain"` and recording `validation.rankedIds`, the script ran again. It reproduced the identical winner, validation table and single-candidate test evaluation ($1,142.13 MAE, gate still rejected); only the stored ranking fields changed (`championRank` 39, ordered ids). No candidate was re-scored on test.

## Appendix — full validation grid, ordered by the pre-registered rule (lowest 2008 MAE; ties: fewer trees, lower depth, lower leaf, then id)

| Rank | id | family | weight | max_depth | learning_rate | min_samples_leaf | loss | alpha | subsample | n_estimators | val MAE | val medAE | val WAPE |
|---|---|---|---|---|---|---|---|---|---|---|---:|---:|---:|
| 1 | `w-price-level` | weighted | price | 2 | 0.04 | 80 | huber | 0.9 | 0.8 | 140 | 1280.42 | 971.38 | 12.343 |
| 2 | `w-peer-count` | weighted | peer | 2 | 0.04 | 80 | huber | 0.9 | 0.8 | 140 | 1287.28 | 966.16 | 12.409 |
| 3 | `g001` | plain |  | 2 | 0.02 | 40 | huber | 0.9 | 0.8 | 140 | 1288.98 | 979.09 | 12.426 |
| 4 | `g013` | plain |  | 2 | 0.02 | 80 | huber | 0.9 | 0.8 | 140 | 1288.98 | 979.52 | 12.426 |
| 5 | `g025` | plain |  | 2 | 0.02 | 160 | huber | 0.9 | 0.8 | 140 | 1290.04 | 981.3 | 12.436 |
| 6 | `g027` | plain |  | 2 | 0.02 | 160 | huber | 0.9 | 1.0 | 140 | 1290.09 | 979.65 | 12.436 |
| 7 | `g003` | plain |  | 2 | 0.02 | 40 | huber | 0.9 | 1.0 | 140 | 1290.72 | 979.77 | 12.442 |
| 8 | `g015` | plain |  | 2 | 0.02 | 80 | huber | 0.9 | 1.0 | 140 | 1290.73 | 979.77 | 12.443 |
| 9 | `g029` | plain |  | 2 | 0.02 | 160 | huber | 0.95 | 0.8 | 140 | 1295.39 | 983.88 | 12.488 |
| 10 | `g031` | plain |  | 2 | 0.02 | 160 | huber | 0.95 | 1.0 | 140 | 1295.7 | 984.56 | 12.49 |
| 11 | `g007` | plain |  | 2 | 0.02 | 40 | huber | 0.95 | 1.0 | 140 | 1295.93 | 983.51 | 12.493 |
| 12 | `g019` | plain |  | 2 | 0.02 | 80 | huber | 0.95 | 1.0 | 140 | 1295.93 | 983.51 | 12.493 |
| 13 | `g005` | plain |  | 2 | 0.02 | 40 | huber | 0.95 | 0.8 | 140 | 1296.08 | 982.45 | 12.494 |
| 14 | `g017` | plain |  | 2 | 0.02 | 80 | huber | 0.95 | 0.8 | 140 | 1296.17 | 982.47 | 12.495 |
| 15 | `g009` | plain |  | 2 | 0.02 | 40 | squared_error |  | 0.8 | 140 | 1305.12 | 987.7 | 12.581 |
| 16 | `g033` | plain |  | 2 | 0.02 | 160 | squared_error |  | 0.8 | 140 | 1305.47 | 987.72 | 12.585 |
| 17 | `g021` | plain |  | 2 | 0.02 | 80 | squared_error |  | 0.8 | 140 | 1305.85 | 988.11 | 12.588 |
| 18 | `g133` | plain |  | 3 | 0.02 | 160 | huber | 0.9 | 0.8 | 140 | 1307.59 | 996.72 | 12.605 |
| 19 | `g111` | plain |  | 3 | 0.02 | 40 | huber | 0.9 | 1.0 | 140 | 1308.26 | 998.84 | 12.612 |
| 20 | `g035` | plain |  | 2 | 0.02 | 160 | squared_error |  | 1.0 | 140 | 1308.49 | 990.18 | 12.614 |
| 21 | `g011` | plain |  | 2 | 0.02 | 40 | squared_error |  | 1.0 | 140 | 1308.93 | 991.61 | 12.618 |
| 22 | `g135` | plain |  | 3 | 0.02 | 160 | huber | 0.9 | 1.0 | 140 | 1309.36 | 999.67 | 12.622 |
| 23 | `g023` | plain |  | 2 | 0.02 | 80 | squared_error |  | 1.0 | 140 | 1310.06 | 989.95 | 12.629 |
| 24 | `g109` | plain |  | 3 | 0.02 | 40 | huber | 0.9 | 0.8 | 140 | 1310.12 | 998.99 | 12.629 |
| 25 | `g123` | plain |  | 3 | 0.02 | 80 | huber | 0.9 | 1.0 | 140 | 1310.58 | 1001.14 | 12.634 |
| 26 | `g121` | plain |  | 3 | 0.02 | 80 | huber | 0.9 | 0.8 | 140 | 1311.19 | 1000.79 | 12.64 |
| 27 | `g004` | plain |  | 2 | 0.02 | 40 | huber | 0.9 | 1.0 | 280 | 1317.97 | 1005.61 | 12.705 |
| 28 | `g016` | plain |  | 2 | 0.02 | 80 | huber | 0.9 | 1.0 | 280 | 1318.01 | 1005.52 | 12.706 |
| 29 | `g039` | plain |  | 2 | 0.04 | 40 | huber | 0.9 | 1.0 | 140 | 1319.07 | 1006.41 | 12.716 |
| 30 | `g014` | plain |  | 2 | 0.02 | 80 | huber | 0.9 | 0.8 | 280 | 1319.36 | 1005.3 | 12.719 |
| 31 | `g051` | plain |  | 2 | 0.04 | 80 | huber | 0.9 | 1.0 | 140 | 1319.37 | 1006.13 | 12.719 |
| 32 | `g002` | plain |  | 2 | 0.02 | 40 | huber | 0.9 | 0.8 | 280 | 1319.57 | 1006.55 | 12.721 |
| 33 | `g028` | plain |  | 2 | 0.02 | 160 | huber | 0.9 | 1.0 | 280 | 1320.04 | 1006.28 | 12.725 |
| 34 | `g037` | plain |  | 2 | 0.04 | 40 | huber | 0.9 | 0.8 | 140 | 1320.58 | 1006.78 | 12.73 |
| 35 | `g061` | plain |  | 2 | 0.04 | 160 | huber | 0.9 | 0.8 | 140 | 1321.07 | 1005.17 | 12.735 |
| 36 | `g026` | plain |  | 2 | 0.02 | 160 | huber | 0.9 | 0.8 | 280 | 1321.14 | 1006.52 | 12.736 |
| 37 | `g137` | plain |  | 3 | 0.02 | 160 | huber | 0.95 | 0.8 | 140 | 1321.25 | 1006.11 | 12.737 |
| 38 | `g063` | plain |  | 2 | 0.04 | 160 | huber | 0.9 | 1.0 | 140 | 1321.42 | 1006.54 | 12.738 |
| 39 | `g049` | plain |  | 2 | 0.04 | 80 | huber | 0.9 | 0.8 | 140 | 1322.17 | 1007.57 | 12.746 |
| 40 | `g115` | plain |  | 3 | 0.02 | 40 | huber | 0.95 | 1.0 | 140 | 1322.22 | 1009.2 | 12.746 |
| 41 | `g139` | plain |  | 3 | 0.02 | 160 | huber | 0.95 | 1.0 | 140 | 1323.08 | 1009.44 | 12.754 |
| 42 | `g127` | plain |  | 3 | 0.02 | 80 | huber | 0.95 | 1.0 | 140 | 1323.3 | 1009.64 | 12.757 |
| 43 | `g113` | plain |  | 3 | 0.02 | 40 | huber | 0.95 | 0.8 | 140 | 1324.21 | 1010.91 | 12.765 |
| 44 | `g125` | plain |  | 3 | 0.02 | 80 | huber | 0.95 | 0.8 | 140 | 1324.7 | 1011.43 | 12.77 |
| 45 | `w-recency` | weighted | recency | 2 | 0.04 | 80 | huber | 0.9 | 0.8 | 140 | 1325.55 | 1009.81 | 12.778 |
| 46 | `g020` | plain |  | 2 | 0.02 | 80 | huber | 0.95 | 1.0 | 280 | 1328.55 | 1012.89 | 12.807 |
| 47 | `g008` | plain |  | 2 | 0.02 | 40 | huber | 0.95 | 1.0 | 280 | 1329.2 | 1012.65 | 12.813 |
| 48 | `g055` | plain |  | 2 | 0.04 | 80 | huber | 0.95 | 1.0 | 140 | 1329.22 | 1013.94 | 12.814 |
| 49 | `g067` | plain |  | 2 | 0.04 | 160 | huber | 0.95 | 1.0 | 140 | 1330.03 | 1012.84 | 12.821 |
| 50 | `g032` | plain |  | 2 | 0.02 | 160 | huber | 0.95 | 1.0 | 280 | 1330.05 | 1013.33 | 12.822 |
| 51 | `g043` | plain |  | 2 | 0.04 | 40 | huber | 0.95 | 1.0 | 140 | 1330.2 | 1014.24 | 12.823 |
| 52 | `g030` | plain |  | 2 | 0.02 | 160 | huber | 0.95 | 0.8 | 280 | 1330.89 | 1014.34 | 12.83 |
| 53 | `g006` | plain |  | 2 | 0.02 | 40 | huber | 0.95 | 0.8 | 280 | 1331.17 | 1012.31 | 12.832 |
| 54 | `g065` | plain |  | 2 | 0.04 | 160 | huber | 0.95 | 0.8 | 140 | 1331.51 | 1013.1 | 12.836 |
| 55 | `g018` | plain |  | 2 | 0.02 | 80 | huber | 0.95 | 0.8 | 280 | 1331.68 | 1013.54 | 12.837 |
| 56 | `g219` | plain |  | 4 | 0.02 | 40 | huber | 0.9 | 1.0 | 140 | 1332.3 | 1017.95 | 12.843 |
| 57 | `g229` | plain |  | 4 | 0.02 | 80 | huber | 0.9 | 0.8 | 140 | 1332.68 | 1017.04 | 12.847 |
| 58 | `g053` | plain |  | 2 | 0.04 | 80 | huber | 0.95 | 0.8 | 140 | 1333.14 | 1013.89 | 12.851 |
| 59 | `g231` | plain |  | 4 | 0.02 | 80 | huber | 0.9 | 1.0 | 140 | 1333.14 | 1018.51 | 12.851 |
| 60 | `g243` | plain |  | 4 | 0.02 | 160 | huber | 0.9 | 1.0 | 140 | 1333.44 | 1017.79 | 12.854 |
| 61 | `g041` | plain |  | 2 | 0.04 | 40 | huber | 0.95 | 0.8 | 140 | 1333.51 | 1013.2 | 12.855 |
| 62 | `g217` | plain |  | 4 | 0.02 | 40 | huber | 0.9 | 0.8 | 140 | 1333.66 | 1019.33 | 12.856 |
| 63 | `g241` | plain |  | 4 | 0.02 | 160 | huber | 0.9 | 0.8 | 140 | 1334.54 | 1016.01 | 12.865 |
| 64 | `g087` | plain |  | 2 | 0.08 | 80 | huber | 0.9 | 1.0 | 140 | 1340.94 | 1020.39 | 12.927 |
| 65 | `g075` | plain |  | 2 | 0.08 | 40 | huber | 0.9 | 1.0 | 140 | 1342.14 | 1021.61 | 12.938 |
| 66 | `g088` | plain |  | 2 | 0.08 | 80 | huber | 0.9 | 1.0 | 280 | 1344.09 | 1022.92 | 12.957 |
| 67 | `g099` | plain |  | 2 | 0.08 | 160 | huber | 0.9 | 1.0 | 140 | 1344.41 | 1023.56 | 12.96 |
| 68 | `g119` | plain |  | 3 | 0.02 | 40 | squared_error |  | 1.0 | 140 | 1344.5 | 1021.61 | 12.961 |
| 69 | `g040` | plain |  | 2 | 0.04 | 40 | huber | 0.9 | 1.0 | 280 | 1344.84 | 1024.84 | 12.964 |
| 70 | `g052` | plain |  | 2 | 0.04 | 80 | huber | 0.9 | 1.0 | 280 | 1344.88 | 1024.62 | 12.965 |
| 71 | `g143` | plain |  | 3 | 0.02 | 160 | squared_error |  | 1.0 | 140 | 1345.22 | 1023.05 | 12.968 |
| 72 | `g235` | plain |  | 4 | 0.02 | 80 | huber | 0.95 | 1.0 | 140 | 1346.01 | 1024.49 | 12.975 |
| 73 | `g076` | plain |  | 2 | 0.08 | 40 | huber | 0.9 | 1.0 | 280 | 1346.02 | 1024.22 | 12.976 |
| 74 | `g141` | plain |  | 3 | 0.02 | 160 | squared_error |  | 0.8 | 140 | 1346.18 | 1021.76 | 12.977 |
| 75 | `g064` | plain |  | 2 | 0.04 | 160 | huber | 0.9 | 1.0 | 280 | 1346.2 | 1025.44 | 12.977 |
| 76 | `g117` | plain |  | 3 | 0.02 | 40 | squared_error |  | 0.8 | 140 | 1346.24 | 1019.88 | 12.978 |
| 77 | `g129` | plain |  | 3 | 0.02 | 80 | squared_error |  | 0.8 | 140 | 1346.73 | 1020.95 | 12.982 |
| 78 | `g131` | plain |  | 3 | 0.02 | 80 | squared_error |  | 1.0 | 140 | 1347.05 | 1024.53 | 12.985 |
| 79 | `g223` | plain |  | 4 | 0.02 | 40 | huber | 0.95 | 1.0 | 140 | 1347.05 | 1025.43 | 12.985 |
| 80 | `g247` | plain |  | 4 | 0.02 | 160 | huber | 0.95 | 1.0 | 140 | 1347.59 | 1025.63 | 12.991 |
| 81 | `g100` | plain |  | 2 | 0.08 | 160 | huber | 0.9 | 1.0 | 280 | 1347.67 | 1026.8 | 12.991 |
| 82 | `g233` | plain |  | 4 | 0.02 | 80 | huber | 0.95 | 0.8 | 140 | 1348.4 | 1026.85 | 12.998 |
| 83 | `g221` | plain |  | 4 | 0.02 | 40 | huber | 0.95 | 0.8 | 140 | 1348.45 | 1025.73 | 12.999 |
| 84 | `g047` | plain |  | 2 | 0.04 | 40 | squared_error |  | 1.0 | 140 | 1348.68 | 1022.42 | 13.001 |
| 85 | `g134` | plain |  | 3 | 0.02 | 160 | huber | 0.9 | 0.8 | 280 | 1348.88 | 1025.5 | 13.003 |
| 86 | `g112` | plain |  | 3 | 0.02 | 40 | huber | 0.9 | 1.0 | 280 | 1348.95 | 1026.23 | 13.004 |
| 87 | `g097` | plain |  | 2 | 0.08 | 160 | huber | 0.9 | 0.8 | 140 | 1349.02 | 1025.45 | 13.004 |
| 88 | `g012` | plain |  | 2 | 0.02 | 40 | squared_error |  | 1.0 | 280 | 1349.1 | 1022.42 | 13.005 |
| 89 | `g169` | plain |  | 3 | 0.04 | 160 | huber | 0.9 | 0.8 | 140 | 1349.23 | 1024.62 | 13.006 |
| 90 | `g245` | plain |  | 4 | 0.02 | 160 | huber | 0.95 | 0.8 | 140 | 1349.4 | 1025.87 | 13.008 |
| 91 | `g147` | plain |  | 3 | 0.04 | 40 | huber | 0.9 | 1.0 | 140 | 1349.41 | 1027.18 | 13.008 |
| 92 | `g024` | plain |  | 2 | 0.02 | 80 | squared_error |  | 1.0 | 280 | 1349.47 | 1023.32 | 13.009 |
| 93 | `g145` | plain |  | 3 | 0.04 | 40 | huber | 0.9 | 0.8 | 140 | 1349.58 | 1028.21 | 13.01 |
| 94 | `g059` | plain |  | 2 | 0.04 | 80 | squared_error |  | 1.0 | 140 | 1349.66 | 1023.36 | 13.011 |
| 95 | `g036` | plain |  | 2 | 0.02 | 160 | squared_error |  | 1.0 | 280 | 1349.67 | 1021.16 | 13.011 |
| 96 | `g124` | plain |  | 3 | 0.02 | 80 | huber | 0.9 | 1.0 | 280 | 1349.73 | 1028.3 | 13.011 |
| 97 | `g073` | plain |  | 2 | 0.08 | 40 | huber | 0.9 | 0.8 | 140 | 1350.09 | 1027.64 | 13.015 |
| 98 | `g071` | plain |  | 2 | 0.04 | 160 | squared_error |  | 1.0 | 140 | 1350.17 | 1022.38 | 13.016 |
| 99 | `g057` | plain |  | 2 | 0.04 | 80 | squared_error |  | 0.8 | 140 | 1350.31 | 1021.73 | 13.017 |
| 100 | `g159` | plain |  | 3 | 0.04 | 80 | huber | 0.9 | 1.0 | 140 | 1350.81 | 1028.65 | 13.022 |
| 101 | `g022` | plain |  | 2 | 0.02 | 80 | squared_error |  | 0.8 | 280 | 1350.98 | 1023.18 | 13.023 |
| 102 | `g110` | plain |  | 3 | 0.02 | 40 | huber | 0.9 | 0.8 | 280 | 1351.02 | 1029.96 | 13.024 |
| 103 | `g157` | plain |  | 3 | 0.04 | 80 | huber | 0.9 | 0.8 | 140 | 1351.23 | 1028.3 | 13.026 |
| 104 | `g085` | plain |  | 2 | 0.08 | 80 | huber | 0.9 | 0.8 | 140 | 1351.47 | 1029.86 | 13.028 |
| 105 | `g038` | plain |  | 2 | 0.04 | 40 | huber | 0.9 | 0.8 | 280 | 1351.55 | 1030.51 | 13.029 |
| 106 | `g122` | plain |  | 3 | 0.02 | 80 | huber | 0.9 | 0.8 | 280 | 1351.83 | 1029.28 | 13.032 |
| 107 | `g034` | plain |  | 2 | 0.02 | 160 | squared_error |  | 0.8 | 280 | 1352.43 | 1022.6 | 13.037 |
| 108 | `g045` | plain |  | 2 | 0.04 | 40 | squared_error |  | 0.8 | 140 | 1352.45 | 1021.82 | 13.038 |
| 109 | `g069` | plain |  | 2 | 0.04 | 160 | squared_error |  | 0.8 | 140 | 1352.49 | 1020.98 | 13.038 |
| 110 | `g050` | plain |  | 2 | 0.04 | 80 | huber | 0.9 | 0.8 | 280 | 1352.59 | 1030.31 | 13.039 |
| 111 | `g010` | plain |  | 2 | 0.02 | 40 | squared_error |  | 0.8 | 280 | 1352.7 | 1023.26 | 13.04 |
| 112 | `g136` | plain |  | 3 | 0.02 | 160 | huber | 0.9 | 1.0 | 280 | 1352.7 | 1028.01 | 13.04 |
| 113 | `g171` | plain |  | 3 | 0.04 | 160 | huber | 0.9 | 1.0 | 140 | 1353.28 | 1028.88 | 13.045 |
| 114 | `g062` | plain |  | 2 | 0.04 | 160 | huber | 0.9 | 0.8 | 280 | 1354.23 | 1028.85 | 13.055 |
| 115 | `g068` | plain |  | 2 | 0.04 | 160 | huber | 0.95 | 1.0 | 280 | 1355.24 | 1030.72 | 13.064 |
| 116 | `g103` | plain |  | 2 | 0.08 | 160 | huber | 0.95 | 1.0 | 140 | 1356.18 | 1030.43 | 13.073 |
| 117 | `g044` | plain |  | 2 | 0.04 | 40 | huber | 0.95 | 1.0 | 280 | 1356.93 | 1031.85 | 13.081 |
| 118 | `g079` | plain |  | 2 | 0.08 | 40 | huber | 0.95 | 1.0 | 140 | 1357.21 | 1031.49 | 13.083 |
| 119 | `g056` | plain |  | 2 | 0.04 | 80 | huber | 0.95 | 1.0 | 280 | 1357.49 | 1033.34 | 13.086 |
| 120 | `g091` | plain |  | 2 | 0.08 | 80 | huber | 0.95 | 1.0 | 140 | 1357.5 | 1032.84 | 13.086 |
| 121 | `g101` | plain |  | 2 | 0.08 | 160 | huber | 0.95 | 0.8 | 140 | 1360.06 | 1035.13 | 13.111 |
| 122 | `g207` | plain |  | 3 | 0.08 | 160 | huber | 0.9 | 1.0 | 140 | 1360.61 | 1033.96 | 13.116 |
| 123 | `g104` | plain |  | 2 | 0.08 | 160 | huber | 0.95 | 1.0 | 280 | 1360.86 | 1033.36 | 13.119 |
| 124 | `g080` | plain |  | 2 | 0.08 | 40 | huber | 0.95 | 1.0 | 280 | 1361.23 | 1034.76 | 13.122 |
| 125 | `g092` | plain |  | 2 | 0.08 | 80 | huber | 0.95 | 1.0 | 280 | 1362.39 | 1037.17 | 13.133 |
| 126 | `g195` | plain |  | 3 | 0.08 | 80 | huber | 0.9 | 1.0 | 140 | 1362.68 | 1037.07 | 13.136 |
| 127 | `g220` | plain |  | 4 | 0.02 | 40 | huber | 0.9 | 1.0 | 280 | 1362.87 | 1038.34 | 13.138 |
| 128 | `g089` | plain |  | 2 | 0.08 | 80 | huber | 0.95 | 0.8 | 140 | 1363.18 | 1035.09 | 13.141 |
| 129 | `g232` | plain |  | 4 | 0.02 | 80 | huber | 0.9 | 1.0 | 280 | 1363.8 | 1039.07 | 13.147 |
| 130 | `g098` | plain |  | 2 | 0.08 | 160 | huber | 0.9 | 0.8 | 280 | 1363.83 | 1037.44 | 13.147 |
| 131 | `g173` | plain |  | 3 | 0.04 | 160 | huber | 0.95 | 0.8 | 140 | 1363.87 | 1033.4 | 13.148 |
| 132 | `g183` | plain |  | 3 | 0.08 | 40 | huber | 0.9 | 1.0 | 140 | 1363.92 | 1034.09 | 13.148 |
| 133 | `g077` | plain |  | 2 | 0.08 | 40 | huber | 0.95 | 0.8 | 140 | 1363.94 | 1035.02 | 13.148 |
| 134 | `g160` | plain |  | 3 | 0.04 | 80 | huber | 0.9 | 1.0 | 280 | 1363.97 | 1036.23 | 13.149 |
| 135 | `g255` | plain |  | 4 | 0.04 | 40 | huber | 0.9 | 1.0 | 140 | 1364.11 | 1037.21 | 13.15 |
| 136 | `g267` | plain |  | 4 | 0.04 | 80 | huber | 0.9 | 1.0 | 140 | 1364.18 | 1039.11 | 13.151 |
| 137 | `g116` | plain |  | 3 | 0.02 | 40 | huber | 0.95 | 1.0 | 280 | 1364.22 | 1034.94 | 13.151 |
| 138 | `g074` | plain |  | 2 | 0.08 | 40 | huber | 0.9 | 0.8 | 280 | 1364.47 | 1037.45 | 13.153 |
| 139 | `g163` | plain |  | 3 | 0.04 | 80 | huber | 0.95 | 1.0 | 140 | 1364.53 | 1038.33 | 13.154 |
| 140 | `g151` | plain |  | 3 | 0.04 | 40 | huber | 0.95 | 1.0 | 140 | 1364.61 | 1037.01 | 13.155 |
| 141 | `g161` | plain |  | 3 | 0.04 | 80 | huber | 0.95 | 0.8 | 140 | 1364.73 | 1037.53 | 13.156 |
| 142 | `g128` | plain |  | 3 | 0.02 | 80 | huber | 0.95 | 1.0 | 280 | 1364.89 | 1037.35 | 13.157 |
| 143 | `g138` | plain |  | 3 | 0.02 | 160 | huber | 0.95 | 0.8 | 280 | 1365.0 | 1033.57 | 13.159 |
| 144 | `g205` | plain |  | 3 | 0.08 | 160 | huber | 0.9 | 0.8 | 140 | 1365.04 | 1035.01 | 13.159 |
| 145 | `g251` | plain |  | 4 | 0.02 | 160 | squared_error |  | 1.0 | 140 | 1365.18 | 1033.31 | 13.16 |
| 146 | `g149` | plain |  | 3 | 0.04 | 40 | huber | 0.95 | 0.8 | 140 | 1365.21 | 1035.17 | 13.161 |
| 147 | `g249` | plain |  | 4 | 0.02 | 160 | squared_error |  | 0.8 | 140 | 1365.23 | 1031.32 | 13.161 |
| 148 | `g181` | plain |  | 3 | 0.08 | 40 | huber | 0.9 | 0.8 | 140 | 1365.33 | 1035.64 | 13.162 |
| 149 | `g279` | plain |  | 4 | 0.04 | 160 | huber | 0.9 | 1.0 | 140 | 1365.49 | 1036.92 | 13.163 |
| 150 | `g054` | plain |  | 2 | 0.04 | 80 | huber | 0.95 | 0.8 | 280 | 1365.57 | 1037.94 | 13.164 |
| 151 | `g114` | plain |  | 3 | 0.02 | 40 | huber | 0.95 | 0.8 | 280 | 1365.61 | 1034.7 | 13.164 |
| 152 | `g253` | plain |  | 4 | 0.04 | 40 | huber | 0.9 | 0.8 | 140 | 1365.98 | 1039.39 | 13.168 |
| 153 | `g066` | plain |  | 2 | 0.04 | 160 | huber | 0.95 | 0.8 | 280 | 1366.06 | 1038.02 | 13.169 |
| 154 | `g158` | plain |  | 3 | 0.04 | 80 | huber | 0.9 | 0.8 | 280 | 1366.1 | 1038.56 | 13.169 |
| 155 | `g265` | plain |  | 4 | 0.04 | 80 | huber | 0.9 | 0.8 | 140 | 1366.11 | 1039.23 | 13.169 |
| 156 | `g218` | plain |  | 4 | 0.02 | 40 | huber | 0.9 | 0.8 | 280 | 1366.18 | 1038.42 | 13.17 |
| 157 | `g230` | plain |  | 4 | 0.02 | 80 | huber | 0.9 | 0.8 | 280 | 1366.45 | 1038.65 | 13.173 |
| 158 | `g086` | plain |  | 2 | 0.08 | 80 | huber | 0.9 | 0.8 | 280 | 1366.46 | 1041.92 | 13.173 |
| 159 | `g175` | plain |  | 3 | 0.04 | 160 | huber | 0.95 | 1.0 | 140 | 1366.5 | 1037.73 | 13.173 |
| 160 | `g042` | plain |  | 2 | 0.04 | 40 | huber | 0.95 | 0.8 | 280 | 1366.56 | 1037.81 | 13.174 |
| 161 | `g170` | plain |  | 3 | 0.04 | 160 | huber | 0.9 | 0.8 | 280 | 1366.68 | 1034.36 | 13.175 |
| 162 | `g277` | plain |  | 4 | 0.04 | 160 | huber | 0.9 | 0.8 | 140 | 1366.74 | 1038.9 | 13.175 |
| 163 | `g126` | plain |  | 3 | 0.02 | 80 | huber | 0.95 | 0.8 | 280 | 1366.82 | 1036.92 | 13.176 |
| 164 | `g146` | plain |  | 3 | 0.04 | 40 | huber | 0.9 | 0.8 | 280 | 1366.86 | 1037.87 | 13.176 |
| 165 | `g148` | plain |  | 3 | 0.04 | 40 | huber | 0.9 | 1.0 | 280 | 1367.19 | 1038.02 | 13.18 |
| 166 | `g193` | plain |  | 3 | 0.08 | 80 | huber | 0.9 | 0.8 | 140 | 1367.24 | 1039.93 | 13.18 |
| 167 | `g172` | plain |  | 3 | 0.04 | 160 | huber | 0.9 | 1.0 | 280 | 1367.29 | 1039.04 | 13.181 |
| 168 | `g244` | plain |  | 4 | 0.02 | 160 | huber | 0.9 | 1.0 | 280 | 1367.37 | 1038.9 | 13.181 |
| 169 | `g140` | plain |  | 3 | 0.02 | 160 | huber | 0.95 | 1.0 | 280 | 1367.47 | 1037.32 | 13.182 |
| 170 | `g227` | plain |  | 4 | 0.02 | 40 | squared_error |  | 1.0 | 140 | 1367.72 | 1033.36 | 13.185 |
| 171 | `g239` | plain |  | 4 | 0.02 | 80 | squared_error |  | 1.0 | 140 | 1367.88 | 1032.27 | 13.186 |
| 172 | `g242` | plain |  | 4 | 0.02 | 160 | huber | 0.9 | 0.8 | 280 | 1368.37 | 1039.46 | 13.191 |
| 173 | `g237` | plain |  | 4 | 0.02 | 80 | squared_error |  | 0.8 | 140 | 1368.66 | 1033.24 | 13.194 |
| 174 | `g225` | plain |  | 4 | 0.02 | 40 | squared_error |  | 0.8 | 140 | 1368.79 | 1034.59 | 13.195 |
| 175 | `g208` | plain |  | 3 | 0.08 | 160 | huber | 0.9 | 1.0 | 280 | 1369.62 | 1041.18 | 13.203 |
| 176 | `g291` | plain |  | 4 | 0.08 | 40 | huber | 0.9 | 1.0 | 140 | 1370.06 | 1040.42 | 13.207 |
| 177 | `g256` | plain |  | 4 | 0.04 | 40 | huber | 0.9 | 1.0 | 280 | 1371.04 | 1042.23 | 13.217 |
| 178 | `g196` | plain |  | 3 | 0.08 | 80 | huber | 0.9 | 1.0 | 280 | 1371.11 | 1043.48 | 13.217 |
| 179 | `g268` | plain |  | 4 | 0.04 | 80 | huber | 0.9 | 1.0 | 280 | 1371.82 | 1043.56 | 13.224 |
| 180 | `g303` | plain |  | 4 | 0.08 | 80 | huber | 0.9 | 1.0 | 140 | 1372.55 | 1044.48 | 13.231 |
| 181 | `g184` | plain |  | 3 | 0.08 | 40 | huber | 0.9 | 1.0 | 280 | 1374.17 | 1039.65 | 13.247 |
| 182 | `g313` | plain |  | 4 | 0.08 | 160 | huber | 0.9 | 0.8 | 140 | 1375.28 | 1040.64 | 13.258 |
| 183 | `g266` | plain |  | 4 | 0.04 | 80 | huber | 0.9 | 0.8 | 280 | 1375.59 | 1044.91 | 13.261 |
| 184 | `g289` | plain |  | 4 | 0.08 | 40 | huber | 0.9 | 0.8 | 140 | 1375.75 | 1041.67 | 13.262 |
| 185 | `g254` | plain |  | 4 | 0.04 | 40 | huber | 0.9 | 0.8 | 280 | 1375.77 | 1043.76 | 13.262 |
| 186 | `g182` | plain |  | 3 | 0.08 | 40 | huber | 0.9 | 0.8 | 280 | 1375.79 | 1040.68 | 13.263 |
| 187 | `g194` | plain |  | 3 | 0.08 | 80 | huber | 0.9 | 0.8 | 280 | 1376.17 | 1043.87 | 13.266 |
| 188 | `g315` | plain |  | 4 | 0.08 | 160 | huber | 0.9 | 1.0 | 140 | 1376.79 | 1044.98 | 13.272 |
| 189 | `g280` | plain |  | 4 | 0.04 | 160 | huber | 0.9 | 1.0 | 280 | 1376.84 | 1044.02 | 13.273 |
| 190 | `g209` | plain |  | 3 | 0.08 | 160 | huber | 0.95 | 0.8 | 140 | 1377.56 | 1039.37 | 13.28 |
| 191 | `g292` | plain |  | 4 | 0.08 | 40 | huber | 0.9 | 1.0 | 280 | 1377.72 | 1043.49 | 13.281 |
| 192 | `g278` | plain |  | 4 | 0.04 | 160 | huber | 0.9 | 0.8 | 280 | 1377.9 | 1042.99 | 13.283 |
| 193 | `g304` | plain |  | 4 | 0.08 | 80 | huber | 0.9 | 1.0 | 280 | 1378.19 | 1046.99 | 13.286 |
| 194 | `g301` | plain |  | 4 | 0.08 | 80 | huber | 0.9 | 0.8 | 140 | 1378.21 | 1046.31 | 13.286 |
| 195 | `g206` | plain |  | 3 | 0.08 | 160 | huber | 0.9 | 0.8 | 280 | 1378.21 | 1041.51 | 13.286 |
| 196 | `g316` | plain |  | 4 | 0.08 | 160 | huber | 0.9 | 1.0 | 280 | 1378.65 | 1045.87 | 13.29 |
| 197 | `g102` | plain |  | 2 | 0.08 | 160 | huber | 0.95 | 0.8 | 280 | 1378.84 | 1042.57 | 13.292 |
| 198 | `g072` | plain |  | 2 | 0.04 | 160 | squared_error |  | 1.0 | 280 | 1378.94 | 1041.11 | 13.293 |
| 199 | `g152` | plain |  | 3 | 0.04 | 40 | huber | 0.95 | 1.0 | 280 | 1379.64 | 1039.92 | 13.3 |
| 200 | `g078` | plain |  | 2 | 0.08 | 40 | huber | 0.95 | 0.8 | 280 | 1379.7 | 1043.67 | 13.3 |
| 201 | `g090` | plain |  | 2 | 0.08 | 80 | huber | 0.95 | 0.8 | 280 | 1379.76 | 1043.23 | 13.301 |
| 202 | `g187` | plain |  | 3 | 0.08 | 40 | huber | 0.95 | 1.0 | 140 | 1379.99 | 1039.79 | 13.303 |
| 203 | `g236` | plain |  | 4 | 0.02 | 80 | huber | 0.95 | 1.0 | 280 | 1380.5 | 1044.17 | 13.308 |
| 204 | `g164` | plain |  | 3 | 0.04 | 80 | huber | 0.95 | 1.0 | 280 | 1380.79 | 1043.22 | 13.311 |
| 205 | `g224` | plain |  | 4 | 0.02 | 40 | huber | 0.95 | 1.0 | 280 | 1380.83 | 1045.4 | 13.311 |
| 206 | `g060` | plain |  | 2 | 0.04 | 80 | squared_error |  | 1.0 | 280 | 1381.01 | 1043.62 | 13.313 |
| 207 | `g259` | plain |  | 4 | 0.04 | 40 | huber | 0.95 | 1.0 | 140 | 1381.23 | 1046.78 | 13.315 |
| 208 | `g107` | plain |  | 2 | 0.08 | 160 | squared_error |  | 1.0 | 140 | 1381.54 | 1044.9 | 13.318 |
| 209 | `g162` | plain |  | 3 | 0.04 | 80 | huber | 0.95 | 0.8 | 280 | 1381.86 | 1045.16 | 13.321 |
| 210 | `g199` | plain |  | 3 | 0.08 | 80 | huber | 0.95 | 1.0 | 140 | 1381.9 | 1044.71 | 13.321 |
| 211 | `g271` | plain |  | 4 | 0.04 | 80 | huber | 0.95 | 1.0 | 140 | 1381.99 | 1045.49 | 13.322 |
| 212 | `g095` | plain |  | 2 | 0.08 | 80 | squared_error |  | 1.0 | 140 | 1382.73 | 1045.05 | 13.329 |
| 213 | `g174` | plain |  | 3 | 0.04 | 160 | huber | 0.95 | 0.8 | 280 | 1382.88 | 1041.36 | 13.331 |
| 214 | `g269` | plain |  | 4 | 0.04 | 80 | huber | 0.95 | 0.8 | 140 | 1383.0 | 1045.21 | 13.332 |
| 215 | `g281` | plain |  | 4 | 0.04 | 160 | huber | 0.95 | 0.8 | 140 | 1383.24 | 1046.57 | 13.334 |
| 216 | `g290` | plain |  | 4 | 0.08 | 40 | huber | 0.9 | 0.8 | 280 | 1383.27 | 1047.73 | 13.335 |
| 217 | `g234` | plain |  | 4 | 0.02 | 80 | huber | 0.95 | 0.8 | 280 | 1383.42 | 1045.21 | 13.336 |
| 218 | `g211` | plain |  | 3 | 0.08 | 160 | huber | 0.95 | 1.0 | 140 | 1383.59 | 1041.22 | 13.338 |
| 219 | `g150` | plain |  | 3 | 0.04 | 40 | huber | 0.95 | 0.8 | 280 | 1384.04 | 1045.67 | 13.342 |
| 220 | `g197` | plain |  | 3 | 0.08 | 80 | huber | 0.95 | 0.8 | 140 | 1384.05 | 1046.17 | 13.342 |
| 221 | `g048` | plain |  | 2 | 0.04 | 40 | squared_error |  | 1.0 | 280 | 1384.15 | 1043.38 | 13.343 |
| 222 | `g248` | plain |  | 4 | 0.02 | 160 | huber | 0.95 | 1.0 | 280 | 1384.29 | 1045.56 | 13.344 |
| 223 | `g222` | plain |  | 4 | 0.02 | 40 | huber | 0.95 | 0.8 | 280 | 1384.35 | 1045.71 | 13.345 |
| 224 | `g257` | plain |  | 4 | 0.04 | 40 | huber | 0.95 | 0.8 | 140 | 1384.38 | 1047.33 | 13.345 |
| 225 | `g105` | plain |  | 2 | 0.08 | 160 | squared_error |  | 0.8 | 140 | 1384.55 | 1043.25 | 13.347 |
| 226 | `g314` | plain |  | 4 | 0.08 | 160 | huber | 0.9 | 0.8 | 280 | 1384.6 | 1046.5 | 13.347 |
| 227 | `g185` | plain |  | 3 | 0.08 | 40 | huber | 0.95 | 0.8 | 140 | 1384.64 | 1044.89 | 13.348 |
| 228 | `g283` | plain |  | 4 | 0.04 | 160 | huber | 0.95 | 1.0 | 140 | 1384.9 | 1045.48 | 13.35 |
| 229 | `g246` | plain |  | 4 | 0.02 | 160 | huber | 0.95 | 0.8 | 280 | 1385.14 | 1044.17 | 13.353 |
| 230 | `g176` | plain |  | 3 | 0.04 | 160 | huber | 0.95 | 1.0 | 280 | 1385.68 | 1042.67 | 13.358 |
| 231 | `g188` | plain |  | 3 | 0.08 | 40 | huber | 0.95 | 1.0 | 280 | 1385.93 | 1042.54 | 13.36 |
| 232 | `g083` | plain |  | 2 | 0.08 | 40 | squared_error |  | 1.0 | 140 | 1386.3 | 1044.38 | 13.364 |
| 233 | `g295` | plain |  | 4 | 0.08 | 40 | huber | 0.95 | 1.0 | 140 | 1386.96 | 1043.96 | 13.37 |
| 234 | `g058` | plain |  | 2 | 0.04 | 80 | squared_error |  | 0.8 | 280 | 1387.2 | 1044.47 | 13.372 |
| 235 | `g302` | plain |  | 4 | 0.08 | 80 | huber | 0.9 | 0.8 | 280 | 1387.25 | 1051.32 | 13.373 |
| 236 | `g093` | plain |  | 2 | 0.08 | 80 | squared_error |  | 0.8 | 140 | 1387.78 | 1047.99 | 13.378 |
| 237 | `g081` | plain |  | 2 | 0.08 | 40 | squared_error |  | 0.8 | 140 | 1387.84 | 1048.15 | 13.379 |
| 238 | `g200` | plain |  | 3 | 0.08 | 80 | huber | 0.95 | 1.0 | 280 | 1388.02 | 1051.15 | 13.38 |
| 239 | `g260` | plain |  | 4 | 0.04 | 40 | huber | 0.95 | 1.0 | 280 | 1388.13 | 1047.6 | 13.381 |
| 240 | `g070` | plain |  | 2 | 0.04 | 160 | squared_error |  | 0.8 | 280 | 1389.5 | 1047.15 | 13.395 |
| 241 | `g167` | plain |  | 3 | 0.04 | 80 | squared_error |  | 1.0 | 140 | 1389.92 | 1049.77 | 13.399 |
| 242 | `g108` | plain |  | 2 | 0.08 | 160 | squared_error |  | 1.0 | 280 | 1390.03 | 1049.78 | 13.4 |
| 243 | `g272` | plain |  | 4 | 0.04 | 80 | huber | 0.95 | 1.0 | 280 | 1390.09 | 1051.0 | 13.4 |
| 244 | `g307` | plain |  | 4 | 0.08 | 80 | huber | 0.95 | 1.0 | 140 | 1390.15 | 1049.76 | 13.401 |
| 245 | `g120` | plain |  | 3 | 0.02 | 40 | squared_error |  | 1.0 | 280 | 1390.6 | 1047.72 | 13.405 |
| 246 | `g046` | plain |  | 2 | 0.04 | 40 | squared_error |  | 0.8 | 280 | 1390.77 | 1048.44 | 13.407 |
| 247 | `g317` | plain |  | 4 | 0.08 | 160 | huber | 0.95 | 0.8 | 140 | 1390.84 | 1047.05 | 13.408 |
| 248 | `g296` | plain |  | 4 | 0.08 | 40 | huber | 0.95 | 1.0 | 280 | 1391.58 | 1046.23 | 13.415 |
| 249 | `g155` | plain |  | 3 | 0.04 | 40 | squared_error |  | 1.0 | 140 | 1391.77 | 1048.94 | 13.417 |
| 250 | `g132` | plain |  | 3 | 0.02 | 80 | squared_error |  | 1.0 | 280 | 1392.04 | 1049.48 | 13.419 |
| 251 | `g293` | plain |  | 4 | 0.08 | 40 | huber | 0.95 | 0.8 | 140 | 1392.54 | 1052.08 | 13.424 |
| 252 | `g210` | plain |  | 3 | 0.08 | 160 | huber | 0.95 | 0.8 | 280 | 1392.97 | 1047.41 | 13.428 |
| 253 | `g212` | plain |  | 3 | 0.08 | 160 | huber | 0.95 | 1.0 | 280 | 1393.05 | 1049.94 | 13.429 |
| 254 | `g319` | plain |  | 4 | 0.08 | 160 | huber | 0.95 | 1.0 | 140 | 1393.45 | 1050.63 | 13.433 |
| 255 | `g284` | plain |  | 4 | 0.04 | 160 | huber | 0.95 | 1.0 | 280 | 1393.71 | 1051.72 | 13.435 |
| 256 | `g270` | plain |  | 4 | 0.04 | 80 | huber | 0.95 | 0.8 | 280 | 1393.75 | 1052.72 | 13.436 |
| 257 | `g282` | plain |  | 4 | 0.04 | 160 | huber | 0.95 | 0.8 | 280 | 1393.95 | 1049.53 | 13.438 |
| 258 | `g305` | plain |  | 4 | 0.08 | 80 | huber | 0.95 | 0.8 | 140 | 1394.08 | 1052.71 | 13.439 |
| 259 | `g153` | plain |  | 3 | 0.04 | 40 | squared_error |  | 0.8 | 140 | 1394.15 | 1049.32 | 13.44 |
| 260 | `g308` | plain |  | 4 | 0.08 | 80 | huber | 0.95 | 1.0 | 280 | 1394.43 | 1051.18 | 13.442 |
| 261 | `g198` | plain |  | 3 | 0.08 | 80 | huber | 0.95 | 0.8 | 280 | 1394.66 | 1050.1 | 13.444 |
| 262 | `g258` | plain |  | 4 | 0.04 | 40 | huber | 0.95 | 0.8 | 280 | 1394.78 | 1053.77 | 13.446 |
| 263 | `g118` | plain |  | 3 | 0.02 | 40 | squared_error |  | 0.8 | 280 | 1394.8 | 1050.89 | 13.446 |
| 264 | `g144` | plain |  | 3 | 0.02 | 160 | squared_error |  | 1.0 | 280 | 1395.2 | 1047.2 | 13.45 |
| 265 | `g320` | plain |  | 4 | 0.08 | 160 | huber | 0.95 | 1.0 | 280 | 1395.42 | 1053.58 | 13.452 |
| 266 | `g186` | plain |  | 3 | 0.08 | 40 | huber | 0.95 | 0.8 | 280 | 1395.44 | 1052.43 | 13.452 |
| 267 | `g130` | plain |  | 3 | 0.02 | 80 | squared_error |  | 0.8 | 280 | 1395.95 | 1050.43 | 13.457 |
| 268 | `g179` | plain |  | 3 | 0.04 | 160 | squared_error |  | 1.0 | 140 | 1396.1 | 1048.41 | 13.458 |
| 269 | `g165` | plain |  | 3 | 0.04 | 80 | squared_error |  | 0.8 | 140 | 1396.16 | 1049.1 | 13.459 |
| 270 | `g142` | plain |  | 3 | 0.02 | 160 | squared_error |  | 0.8 | 280 | 1396.77 | 1045.27 | 13.465 |
| 271 | `g177` | plain |  | 3 | 0.04 | 160 | squared_error |  | 0.8 | 140 | 1397.64 | 1046.59 | 13.473 |
| 272 | `g096` | plain |  | 2 | 0.08 | 80 | squared_error |  | 1.0 | 280 | 1400.1 | 1054.92 | 13.497 |
| 273 | `g318` | plain |  | 4 | 0.08 | 160 | huber | 0.95 | 0.8 | 280 | 1401.59 | 1052.69 | 13.511 |
| 274 | `g294` | plain |  | 4 | 0.08 | 40 | huber | 0.95 | 0.8 | 280 | 1401.83 | 1057.64 | 13.514 |
| 275 | `g306` | plain |  | 4 | 0.08 | 80 | huber | 0.95 | 0.8 | 280 | 1402.07 | 1057.15 | 13.516 |
| 276 | `g084` | plain |  | 2 | 0.08 | 40 | squared_error |  | 1.0 | 280 | 1404.55 | 1054.02 | 13.54 |
| 277 | `g106` | plain |  | 2 | 0.08 | 160 | squared_error |  | 0.8 | 280 | 1404.57 | 1052.65 | 13.54 |
| 278 | `g252` | plain |  | 4 | 0.02 | 160 | squared_error |  | 1.0 | 280 | 1405.7 | 1053.82 | 13.551 |
| 279 | `g156` | plain |  | 3 | 0.04 | 40 | squared_error |  | 1.0 | 280 | 1405.72 | 1056.46 | 13.551 |
| 280 | `g263` | plain |  | 4 | 0.04 | 40 | squared_error |  | 1.0 | 140 | 1406.06 | 1057.15 | 13.554 |
| 281 | `g240` | plain |  | 4 | 0.02 | 80 | squared_error |  | 1.0 | 280 | 1406.2 | 1056.71 | 13.556 |
| 282 | `g180` | plain |  | 3 | 0.04 | 160 | squared_error |  | 1.0 | 280 | 1406.41 | 1053.27 | 13.558 |
| 283 | `g082` | plain |  | 2 | 0.08 | 40 | squared_error |  | 0.8 | 280 | 1406.49 | 1055.81 | 13.558 |
| 284 | `g275` | plain |  | 4 | 0.04 | 80 | squared_error |  | 1.0 | 140 | 1406.63 | 1056.54 | 13.56 |
| 285 | `g287` | plain |  | 4 | 0.04 | 160 | squared_error |  | 1.0 | 140 | 1407.37 | 1054.43 | 13.567 |
| 286 | `g285` | plain |  | 4 | 0.04 | 160 | squared_error |  | 0.8 | 140 | 1407.53 | 1049.92 | 13.569 |
| 287 | `g250` | plain |  | 4 | 0.02 | 160 | squared_error |  | 0.8 | 280 | 1407.6 | 1052.63 | 13.569 |
| 288 | `g228` | plain |  | 4 | 0.02 | 40 | squared_error |  | 1.0 | 280 | 1407.7 | 1060.78 | 13.57 |
| 289 | `g094` | plain |  | 2 | 0.08 | 80 | squared_error |  | 0.8 | 280 | 1408.03 | 1058.07 | 13.573 |
| 290 | `g201` | plain |  | 3 | 0.08 | 80 | squared_error |  | 0.8 | 140 | 1408.53 | 1054.63 | 13.578 |
| 291 | `g191` | plain |  | 3 | 0.08 | 40 | squared_error |  | 1.0 | 140 | 1408.8 | 1059.9 | 13.581 |
| 292 | `g168` | plain |  | 3 | 0.04 | 80 | squared_error |  | 1.0 | 280 | 1409.28 | 1060.07 | 13.585 |
| 293 | `g273` | plain |  | 4 | 0.04 | 80 | squared_error |  | 0.8 | 140 | 1409.29 | 1055.42 | 13.586 |
| 294 | `g226` | plain |  | 4 | 0.02 | 40 | squared_error |  | 0.8 | 280 | 1410.18 | 1057.87 | 13.594 |
| 295 | `g213` | plain |  | 3 | 0.08 | 160 | squared_error |  | 0.8 | 140 | 1410.33 | 1054.79 | 13.595 |
| 296 | `g166` | plain |  | 3 | 0.04 | 80 | squared_error |  | 0.8 | 280 | 1410.6 | 1056.72 | 13.598 |
| 297 | `g238` | plain |  | 4 | 0.02 | 80 | squared_error |  | 0.8 | 280 | 1410.69 | 1056.55 | 13.599 |
| 298 | `g203` | plain |  | 3 | 0.08 | 80 | squared_error |  | 1.0 | 140 | 1410.74 | 1058.96 | 13.599 |
| 299 | `g215` | plain |  | 3 | 0.08 | 160 | squared_error |  | 1.0 | 140 | 1410.86 | 1054.25 | 13.601 |
| 300 | `g154` | plain |  | 3 | 0.04 | 40 | squared_error |  | 0.8 | 280 | 1411.25 | 1058.56 | 13.604 |
| 301 | `g178` | plain |  | 3 | 0.04 | 160 | squared_error |  | 0.8 | 280 | 1411.81 | 1052.22 | 13.61 |
| 302 | `g261` | plain |  | 4 | 0.04 | 40 | squared_error |  | 0.8 | 140 | 1412.54 | 1056.82 | 13.617 |
| 303 | `g204` | plain |  | 3 | 0.08 | 80 | squared_error |  | 1.0 | 280 | 1414.01 | 1060.28 | 13.631 |
| 304 | `g288` | plain |  | 4 | 0.04 | 160 | squared_error |  | 1.0 | 280 | 1414.01 | 1054.06 | 13.631 |
| 305 | `g189` | plain |  | 3 | 0.08 | 40 | squared_error |  | 0.8 | 140 | 1414.17 | 1058.02 | 13.632 |
| 306 | `g216` | plain |  | 3 | 0.08 | 160 | squared_error |  | 1.0 | 280 | 1415.54 | 1055.03 | 13.646 |
| 307 | `g276` | plain |  | 4 | 0.04 | 80 | squared_error |  | 1.0 | 280 | 1415.84 | 1060.44 | 13.649 |
| 308 | `g264` | plain |  | 4 | 0.04 | 40 | squared_error |  | 1.0 | 280 | 1416.14 | 1063.72 | 13.651 |
| 309 | `g323` | plain |  | 4 | 0.08 | 160 | squared_error |  | 1.0 | 140 | 1416.32 | 1055.2 | 13.653 |
| 310 | `g192` | plain |  | 3 | 0.08 | 40 | squared_error |  | 1.0 | 280 | 1416.59 | 1064.58 | 13.656 |
| 311 | `g311` | plain |  | 4 | 0.08 | 80 | squared_error |  | 1.0 | 140 | 1417.33 | 1059.03 | 13.663 |
| 312 | `g321` | plain |  | 4 | 0.08 | 160 | squared_error |  | 0.8 | 140 | 1418.06 | 1054.6 | 13.67 |
| 313 | `g286` | plain |  | 4 | 0.04 | 160 | squared_error |  | 0.8 | 280 | 1418.87 | 1051.68 | 13.678 |
| 314 | `g324` | plain |  | 4 | 0.08 | 160 | squared_error |  | 1.0 | 280 | 1419.45 | 1053.58 | 13.683 |
| 315 | `g299` | plain |  | 4 | 0.08 | 40 | squared_error |  | 1.0 | 140 | 1419.46 | 1064.07 | 13.683 |
| 316 | `g309` | plain |  | 4 | 0.08 | 80 | squared_error |  | 0.8 | 140 | 1421.54 | 1062.98 | 13.704 |
| 317 | `g274` | plain |  | 4 | 0.04 | 80 | squared_error |  | 0.8 | 280 | 1421.88 | 1060.43 | 13.707 |
| 318 | `g202` | plain |  | 3 | 0.08 | 80 | squared_error |  | 0.8 | 280 | 1422.32 | 1061.26 | 13.711 |
| 319 | `g312` | plain |  | 4 | 0.08 | 80 | squared_error |  | 1.0 | 280 | 1422.63 | 1060.02 | 13.714 |
| 320 | `g190` | plain |  | 3 | 0.08 | 40 | squared_error |  | 0.8 | 280 | 1423.48 | 1064.44 | 13.722 |
| 321 | `g300` | plain |  | 4 | 0.08 | 40 | squared_error |  | 1.0 | 280 | 1424.03 | 1065.47 | 13.728 |
| 322 | `g262` | plain |  | 4 | 0.04 | 40 | squared_error |  | 0.8 | 280 | 1424.13 | 1065.6 | 13.729 |
| 323 | `g214` | plain |  | 3 | 0.08 | 160 | squared_error |  | 0.8 | 280 | 1425.0 | 1058.34 | 13.737 |
| 324 | `g297` | plain |  | 4 | 0.08 | 40 | squared_error |  | 0.8 | 140 | 1426.66 | 1067.59 | 13.753 |
| 325 | `g322` | plain |  | 4 | 0.08 | 160 | squared_error |  | 0.8 | 280 | 1430.01 | 1063.02 | 13.785 |
| 326 | `g310` | plain |  | 4 | 0.08 | 80 | squared_error |  | 0.8 | 280 | 1433.58 | 1069.4 | 13.82 |
| 327 | `g298` | plain |  | 4 | 0.08 | 40 | squared_error |  | 0.8 | 280 | 1435.72 | 1072.11 | 13.84 |
