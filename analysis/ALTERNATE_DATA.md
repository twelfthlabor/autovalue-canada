# Alternate and additional training data — assessment

Probed 2026-09-12 against the cached Larsen archive (SHA-256 `7827d220…05008fa`). Product and licence pages retrieved the same day. No data was purchased, no model or artifact changed, and nothing here authorises a training run under a new licence.

---

## 1. More of the Larsen archive

### 1a. Ungraded sold rows ("No grade") — not exchangeable as-is

The archive has 260,299 sold rows that pass the trainer's price/odometer/age filters. 116,392 of them (44.7%) carry `conrepgrade = No grade`, which the loader drops. After peer qualification (≥8 peers) the expanded pool is 103,619 graded and 52,930 ungraded rows; on the 2006–2008 fit window it is 59,535 graded and 38,820 ungraded. On the broad traits the two populations are not close:

| window 2006–2008 | graded | ungraded |
|---|---:|---:|
| median odometer | 41,823 km | 92,396 km |
| mean vehicle age | 3.1 yr | 6.2 yr |
| median sale price | $9,400 | $5,350 |

I fit the trainer's own target (`log(sale / leave-one-out peer anchor)`) on the pooled window with a slope interaction, peer stats computed over the pooled population (no grade-nunique requirement), 2008-baseline year dummies:

| | coefficient | se | z |
|---|---:|---:|---:|
| graded log-odometer slope | −0.3056 | 0.0029 | −104.6 |
| ungraded slope | −0.4389 | — | — |
| interaction (ungraded − graded) | −0.1332 | 0.0051 | −26.1 |

Residual dispersion is 0.2533 (graded) versus 0.2881 (ungraded). The ungraded slope is 43% steeper and the residual spread ~14% wider, so they fail an exchangeability check. Dropping them does bias the odometer slope — toward zero — but adding them to the current single-population fit would transfer that steeper slope to the newer, cleaner cars the deployed model actually serves. The trainer's graded slope on its own population is −0.2594 (se 0.0027), against −0.3056 for graded rows in the pooled anchor construction; even the anchor population choice moves the slope by 18%.

**Verdict:** not worth adding as a drop-in. A two-stage or explicit interaction variant is only worth a pre-registered pilot if the consumer base includes 2000s-era high-mileage cars; this probe does not support mixing them into the current conditional model.

### 1b. `vin_exdum*` damage flags — real signal, unrecoverable semantics

The Readme codebook describes them only as: "32 dummies from the auction house's database specifying different types of damage or background information on the vehicle." The individual flags are not enumerated anywhere in the archive; `step1_regression.do` uses `vin_exdum*` as generic controls and adds no names. `odoflagnew_dum` is documented: 1 = odometer considered accurate, 0 = questionable.

Measured on the 91,278-row graded trainer population:

| flag | prevalence | raw target gap | controlled coefficient (delta + score) |
|---|---:|---:|---:|
| `vin_exdum22` | 4.32% | −0.2471 | −0.2003 (se 0.0054, z −36.9) |
| `vin_exdum5` | 0.69% | −0.0024 | −0.0478 (se 0.0121, z −3.9) |
| `vin_exdum27` | 4.24% | −0.1539 | — |

The `vin_exdum22` numbers reproduce the figures in the brief (4.3%, −0.247) exactly; on the 2006–2008 fit window alone the prevalence is 3.69% and the raw gap −0.2628. The flags carry real, large residual signal. They also move the learned grade mapping: training the champion on rows with no flags at all raises the GBR Rough multiplier by +3.4% and Extra Rough/Salvage by +9.7% relative to training on all rows, while the odometer multipliers move less than 0.5% (Average at delta ±0.5: −0.47% / +0.30%). In other words, today the grade multipliers absorb undisclosed-damage discounts that the consumer form cannot express.

**Verdict:** park it. Adding the flags would help accuracy on the historical panel, but the 32 flags cannot be mapped to the consumer accident/title input without the auction house's or author's flag dictionary, which is not in the cached archive. Even with names, a seller's disclosure dummy is not the buyer's self-reported accident history. Revisit only if a documented mapping appears.

### 1c. `odoflagnew_dum == 0` — exclude from training, keep the metric fixed

These are rows the auction house marked as having a questionable odometer. The trainer population contains 961 of them (1.05%): 0 in 2006, 98 in 2007, 164 in 2008, 660 in 2009, 39 in 2010. The brief's 842 appears to use a different eligibility cut; the number that matters for the pre-registered split is 98 fit rows out of 18,201 (0.54%).

Champion hyper-parameters, fit on 2006–2007, evaluated on 2008:

| training rows | 2008 full | 2008 without flagged |
|---|---:|---:|
| all 18,201 | MAE $1,322.17 · medAE $1,007.57 · WAPE 12.746% | $1,323.50 · $1,009.97 · 12.715% |
| drop the 98 flagged | **$1,319.73** · $1,007.13 · 12.722% | $1,321.05 · $1,009.34 · 12.691% |

**Recommendation:** drop `odoflagnew_dum == 0` rows from future fits (a consistent −$2.44 MAE, −0.18%), and leave the 2008 evaluation set unchanged so comparisons stay on frozen ground. The effect is small enough that it is housekeeping for the next refit, not a challenger to pre-register.

**What was run:** a scratch probe using the venv Python that reloads both `pre_step1_ins*.csv` files with `usecols` extended to `odoflagnew_dum` and `vin_exdum1-32`, rebuilds the trainer's filters and peer stats, then runs the OLS/interaction and champion-GBR A/B described above. Reproduce with `/Users/daniel/Desktop/repo/.venvs/autovalue-ml/bin/python`; the peer group is `sale_year, auction, year, make, model, vin_modeltrim`, and all models use `random_state=42`.

---

## 2. OmniaAuto row-level data

Pages fetched 2026-09-12: `/terms`, `/snapshot`, `/feed`. The 2026-08-17 terms version is current.

**Licence — what the terms actually say.** Snapshots are "licensed for your organization's own internal use: price and stock your inventory, run your analysis, share it inside your company, quote figures in your own reporting." Redistribution is excluded: "reselling the file, publishing it, or shipping it inside a product you sell" needs a separate redistribution licence, and §4 forbids building a competing listings dataset from the data. The terms contain **no model-training clause** — unlike MarketCheck, there is no AI/ML restriction, but there is also no explicit grant for training models on the data or for deploying a model trained on it. "Run your analysis" plausibly covers internal experimentation; publicly shipping a model derived from the data is squarely in the "product you sell" grey zone. **Conclusion: the snapshot licence is not display-only — it covers internal analysis — and the operative restriction is redistribution; model training and internal validation are simply not addressed.** Written confirmation from OmniaAuto should be obtained before any training run, and a redistribution licence before any derived model ships publicly. No purchase was made.

**Pricing (their pages, CAD plus GST/HST).** Snapshots are one-time, billed on unique VINs: CA$39 minimum covers the first 2,500 VINs, then CA$0.0060 down to CA$0.00196 as the slice grows; Canada-wide at current coverage (~619,937 rows) prices at CA$1,517.33. Feed subscriptions: one province CA$199–999/mo, region CA$899/mo, Canada-wide CA$1,999/mo, IP-pinned and internal-use only. A free 100-row sample (one province, one per email, no card) carries the same internal-use licence and is enough to validate the schema.

**Minimal pilot.** First the free sample for column/format checks. Then a snapshot of **Ontario × Toyota × model years 2018–2022, RAV4 only** — narrow enough to plausibly stay under the 2,500-VIN minimum (CA$39); widen to all Toyota models across the years only if the builder shows the count still inside the first block. The builder displays the exact count and price before checkout, so the cost is measurable without committing. The file carries everything `lib/market.ts` needs for the dormant Stage-1 OLS path (`deriveComparableBenchmark`, currently exercised only by `lib/market.test.ts`): VIN, trim, mileage, price, InitialPrice, DaysOnMarket, City/Province/PostalCode/Latitude/Longitude, transmission, seller, condition flags.

**How it feeds Stage 1.** Ingest offline to a comparables table keyed by `province × make × model × year × trim`; map rows to `ComparableObservation` (VIN, price → askingPrice, mileage → odometerKm, City/Province + lat/long → location, transmission) and run the existing OLS per subject group to produce a mileage-adjusted benchmark. It anchors Stage 1; it does not train Stage 2 — these are asking prices, not completed sales, and condition is not an observed grade.

**Join / coverage gate before adoption (proposed, offline only).** (1) every row has VIN + year + make + model as promised, VIN checksum-valid share ≥ 95%; (2) one row per VIN after dedupe (`Is_Cross_Listed` checked); (3) ≥ 90% of pilot rows map to an existing `market.json` composite key (province × make × model × year) so the two sources can be compared; (4) per subject group ≥ 10 valid comparables with odometer support spanning the subject odometer, then the OLS R²/rmse recorded; (5) price sanity: snapshot median within ±10% of the published cell p50 and p10/p90 inside the published range for ≥ 80% of overlapping cells; (6) mileage in km and within 100–350,000; (7) an offline backtest on held-out cells beating the raw cell median before any runtime wiring. Any of these failing stops the pilot. Even when it passes, adoption stays a licence decision, not an engineering one.

---

## 3. Other sources

- **MarketCheck — ruled out, now explicitly.** Their Terms of Service (last updated 2026-03-24) list "(c) AI / Model Training Restrictions: Use MarketCheck data to train, fine-tune, or improve any generalized machine learning or artificial intelligence models" under prohibited uses. <https://www.marketcheck.com/terms_of_service> (retrieved 2026-09-12).
- **Canadian Black Book — ruled out.** CBB Terms of Use require prior written consent to "create derivative works from" the Content; the affiliated Black Book (US) terms go further and prohibit using data "to directly or indirectly create, train, test, improve" any ML/AI system. <https://www.canadianblackbook.com/terms> and <https://www.blackbook.com/terms> (retrieved 2026-09-12).
- **Statistics Canada used-vehicle CPI — verified, macro trend only.** Table 18-10-0004-01 (monthly CPI, not seasonally adjusted; release 2026-08-17) publishes the "Purchase of used passenger vehicles" special aggregate, which StatCan itself references from Daily charts. Open Government Licence – Canada. <https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000401>, DOI <https://doi.org/10.25318/1810000401-eng> (retrieved 2026-09-12). Usable as a national trend feature, never as a vehicle-level price.
- **Manheim Used Vehicle Value Index — verified, US trend proxy.** Official methodology: mix/mileage/seasonality-adjusted wholesale index, January 1997 = 100, built from >5M US transactions annually, monthly releases with a downloadable workbook. <https://www.manheim.com/data-and-insights/used-vehicle-value-index/> (retrieved 2026-09-12). US wholesale conditions, so a trend input at most for the Canadian anchor.

## Bottom line

More Larsen is only useful for the odometer component and only through a pre-registered expanded-population or two-stage design; as-is it would shift the slope for the wrong population. The damage flags are informative but semantically closed. Dropping 98 questionable-odometer fit rows is free housekeeping. OmniaAuto row-level data is the one genuinely additive source for Stage 1, but its terms do not address model training, so a written licence clarification — and later a redistribution licence if a derived model ships — comes before any pilot purchase.
