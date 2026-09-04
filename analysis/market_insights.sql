-- AutoValue Canada warehouse analytics (PostgreSQL 16, RDS-compatible).
-- Source: raw.price_stats loaded by analysis/etl_to_postgres.py from
-- data/raw/price_stats_by_model_year.csv (dealer asking prices, not sales).
-- All consumer-facing queries filter condition = 'Used' AND is_valid.
-- Snapshot year 2026 matches analysis/train_benchmark.py SNAPSHOT_YEAR.

-- Q1: median asking price by province x model year (used, valid cells).
SELECT
    province,
    model_year,
    COUNT(*) AS cells,
    SUM(vehicles) AS vehicles,
    ROUND(AVG(price_median)::numeric, 2) AS mean_of_medians_cad,
    ROUND((SUM(price_median * vehicles) / NULLIF(SUM(vehicles), 0))::numeric, 2) AS weighted_median_cad,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_median)::numeric, 2) AS p50_of_medians_cad
FROM raw.price_stats
WHERE condition = 'Used' AND is_valid
GROUP BY province, model_year
ORDER BY province, model_year DESC;

-- Q2: price dispersion (p75-p25 spread) vs sample depth by make.
SELECT
    make,
    COUNT(*) AS cells,
    SUM(vehicles) AS vehicles,
    ROUND(AVG(price_p75 - price_p25)::numeric, 2) AS mean_spread_cad,
    ROUND(AVG(price_median)::numeric, 2) AS mean_median_cad,
    ROUND((100.0 * AVG(price_p75 - price_p25) / NULLIF(AVG(price_median), 0))::numeric, 2) AS spread_pct_of_median
FROM raw.price_stats
WHERE condition = 'Used' AND is_valid
GROUP BY make
HAVING COUNT(*) >= 10
ORDER BY mean_spread_cad DESC;

-- Q3: depreciation proxy — young (2024-2026) vs older (2016-2019) medians per make|model.
WITH cohorts AS (
    SELECT
        make,
        model,
        CASE
            WHEN model_year BETWEEN 2024 AND 2026 THEN 'young'
            WHEN model_year BETWEEN 2016 AND 2019 THEN 'older'
            ELSE NULL
        END AS cohort,
        price_median,
        vehicles
    FROM raw.price_stats
    WHERE condition = 'Used' AND is_valid
      AND model_year BETWEEN 2016 AND 2026
),
agg AS (
    SELECT
        make,
        model,
        COUNT(*) FILTER (WHERE cohort = 'young') AS young_cells,
        COUNT(*) FILTER (WHERE cohort = 'older') AS older_cells,
        AVG(price_median) FILTER (WHERE cohort = 'young') AS young_mean,
        AVG(price_median) FILTER (WHERE cohort = 'older') AS older_mean
    FROM cohorts
    WHERE cohort IS NOT NULL
    GROUP BY make, model
)
SELECT
    make,
    model,
    young_cells,
    older_cells,
    ROUND(young_mean::numeric, 2) AS young_mean_cad,
    ROUND(older_mean::numeric, 2) AS older_mean_cad,
    ROUND((100.0 * (young_mean - older_mean) / NULLIF(young_mean, 0))::numeric, 2) AS depreciation_pct
FROM agg
WHERE young_cells >= 3 AND older_cells >= 3 AND young_mean > 0 AND older_mean > 0
ORDER BY depreciation_pct DESC NULLS LAST
LIMIT 20;

-- Q4: days-on-market bucket vs haggle-room proxy (median-p25)/median.
SELECT
    CASE
        WHEN days_on_market_median < 30 THEN '<30d'
        WHEN days_on_market_median <= 45 THEN '30-45d'
        WHEN days_on_market_median <= 60 THEN '46-60d'
        ELSE '60d+'
    END AS dom_bucket,
    COUNT(*) AS cells,
    SUM(vehicles) AS vehicles,
    ROUND(AVG(days_on_market_median)::numeric, 1) AS mean_dom,
    ROUND((100.0 * AVG((price_median - price_p25) / NULLIF(price_median, 0)))::numeric, 2) AS mean_haggle_room_pct,
    ROUND(AVG(price_median)::numeric, 2) AS mean_median_cad
FROM raw.price_stats
WHERE condition = 'Used' AND is_valid AND price_median > 0
GROUP BY 1
ORDER BY mean_dom;

-- Q5: national weighted median (single-row KPI for dashboard).
SELECT
    COUNT(*) AS used_valid_cells,
    SUM(vehicles) AS used_vehicles,
    ROUND((SUM(price_median * vehicles) / NULLIF(SUM(vehicles), 0))::numeric, 2) AS national_weighted_median_cad,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_median)::numeric, 2) AS national_p50_of_medians_cad,
    MIN(model_year) AS min_year,
    MAX(model_year) AS max_year
FROM raw.price_stats
WHERE condition = 'Used' AND is_valid;

-- Q6: thin-evidence cells (<40 vehicles) — transparency flag for UI.
SELECT
    province,
    make,
    model,
    model_year,
    vehicles,
    ROUND(price_median::numeric, 2) AS median_cad,
    ROUND((price_p75 - price_p25)::numeric, 2) AS spread_cad
FROM raw.price_stats
WHERE condition = 'Used' AND is_valid AND vehicles < 40
ORDER BY vehicles ASC, price_median DESC
LIMIT 50;
