"""Reproduce every number in analysis/ALTERNATE_DATA.md from the cached Larsen zip.

Sections mirror the memo:
  1a. Odometer-slope exchangeability of ungraded ("No grade") sold rows.
  1b. vin_exdum* damage-flag signal and effect on grade/odometer multipliers.
  1c. odoflagnew_dum == 0 A/B on the 2008 validation year.

Usage (venv interpreter, from the repository root):

    /Users/daniel/Desktop/repo/.venvs/autovalue-ml/bin/python analysis/probe_alternate_data.py

Reads data/cache/Larsen_used_car_bargaining_data_and_code.zip (SHA-256 checked
by analysis/train_condition_model.py); writes nothing. Peer groups and filters
match the trainer: sale_year, auction, year, make, model, vin_modeltrim; sold
(agree=1), price 300-100,000, odometer 100-350,000, vehicle age 0-25. All
stochastic fits use random_state=42.
"""

from __future__ import annotations

import importlib.util
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor

ROOT = Path(__file__).resolve().parents[1]
ZIP = ROOT / "data" / "cache" / "Larsen_used_car_bargaining_data_and_code.zip"
FLAGS = [f"vin_exdum{i}" for i in range(1, 33)]
COLS = [
    "idnew", "auction", "history_run_date", "agree", "finalprice", "year", "make", "model",
    "odo", "conrepgrade", "vin_modeltrim", "odoflagnew_dum", *FLAGS,
]
GROUP = ["sale_year", "auction", "year", "make", "model", "vin_modeltrim"]
GRADE_SCORE = {"Salvage": -1.0, "Extra Rough": 0.0, "Rough": 1.0, "Average": 2.0, "Clean": 3.0, "Extra Clean": 4.0}
CHAMP = dict(loss="huber", alpha=0.9, n_estimators=140, learning_rate=0.04, max_depth=2, min_samples_leaf=80, subsample=0.8, random_state=42)

spec = importlib.util.spec_from_file_location("tcm", ROOT / "analysis" / "train_condition_model.py")
tcm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tcm)


def load() -> pd.DataFrame:
    frames = []
    with zipfile.ZipFile(ZIP) as archive:
        for filename in ("pre_step1_ins0.csv", "pre_step1_ins1.csv"):
            with archive.open(filename) as source:
                frames.append(pd.read_csv(source, usecols=COLS, low_memory=False))
    frame = pd.concat(frames, ignore_index=True)
    frame["sale_year"] = pd.to_numeric(frame["history_run_date"].astype(str).str[-4:], errors="coerce")
    frame["condition_score"] = frame["conrepgrade"].map(GRADE_SCORE)
    frame["vehicle_age"] = frame["sale_year"] - frame["year"]
    frame["log_odometer"] = np.log1p(frame["odo"])
    frame["log_price"] = np.log(frame["finalprice"])
    return frame


def add_peer_stats(frame: pd.DataFrame, population: pd.DataFrame) -> pd.DataFrame:
    """Leave-one-out peer stats computed on `population`, attached to `frame`."""
    stats = population.groupby(GROUP).agg(
        peer_count=("log_price", "size"),
        peer_log_price_sum=("log_price", "sum"),
        peer_log_odometer=("log_odometer", "median"),
        peer_grades=("condition_score", "nunique"),
    )
    merged = frame.merge(stats.reset_index(), on=GROUP, how="left")
    merged["peer_anchor_log"] = (merged["peer_log_price_sum"] - merged["log_price"]) / (merged["peer_count"] - 1)
    merged["log_odometer_delta"] = merged["log_odometer"] - merged["peer_log_odometer"]
    merged["target"] = merged["log_price"] - merged["peer_anchor_log"]
    return merged


def ols(y: np.ndarray, columns: list[np.ndarray]):
    design = np.column_stack([np.ones(len(y)), *columns])
    beta, *_ = np.linalg.lstsq(design, y, rcond=None)
    residual = y - design @ beta
    n, k = design.shape
    sigma2 = float(residual @ residual) / (n - k)
    covariance = sigma2 * np.linalg.inv(design.T @ design)
    return beta, np.sqrt(np.diag(covariance)), covariance, residual


def report(beta, se, residual, names, label):
    """beta[0] is the intercept; names describe beta[1:]."""
    print(f"[{label}] n={len(residual):,} resid_sd={residual.std(ddof=len(beta)):.4f} intercept={beta[0]:+.5f}")
    for name, b, s in zip(names, beta[1:], se[1:]):
        print(f"    {name:<26} {b:+.5f}  se={s:.5f}  z={b / s:+.2f}")


def champion(frame_part):
    model = GradientBoostingRegressor(**CHAMP)
    model.fit(frame_part[tcm.FEATURES], frame_part["target"])
    return model


def multipliers(model):
    center = float(tcm.predict_adjustment(model, np.asarray([2.0]), np.asarray([0.0]))[0])
    grades = {
        grade: float(np.exp(tcm.predict_adjustment(model, np.asarray([score]), np.asarray([0.0]))[0] - center))
        for grade, score in GRADE_SCORE.items()
    }
    odometer = {
        delta: float(np.exp(tcm.predict_adjustment(model, np.asarray([2.0]), np.asarray([delta]))[0] - center))
        for delta in (-0.5, 0.5)
    }
    return grades, odometer


def main() -> None:
    frame = load()
    print(f"raw rows: {len(frame):,}")
    filters = (
        frame["agree"].eq(1)
        & frame["finalprice"].between(300, 100_000)
        & frame["odo"].between(100, 350_000)
        & frame["vehicle_age"].between(0, 25)
    )
    base = frame.loc[filters].copy()
    print(f"base sold rows passing price/odometer/age filters: {len(base):,}")
    print("conrepgrade in base:")
    print(base["conrepgrade"].fillna("(missing)").value_counts().to_string())
    print("\nbase rows by sale year and grade presence:")
    print(base.assign(graded=base["condition_score"].notna()).groupby(["sale_year", "graded"]).size().unstack(fill_value=0).to_string())
    print(f"\nflags NaN cells: {int(base[FLAGS].isna().sum().sum())}, odoflagnew NaN: {int(base['odoflagnew_dum'].isna().sum())}")

    # --- 1a. expanded pool: peer stats over graded + ungraded base rows -------
    pooled = add_peer_stats(base, base)
    pooled_graded = pooled.loc[pooled["peer_count"].ge(8) & pooled["condition_score"].notna() & pooled["peer_grades"].ge(2)].copy()
    pooled_ungraded = pooled.loc[pooled["peer_count"].ge(8) & pooled["condition_score"].isna()].copy()
    print(f"\n=== 1a. expanded pool: graded={len(pooled_graded):,} ungraded={len(pooled_ungraded):,} ungraded share={len(pooled_ungraded) / (len(pooled_graded) + len(pooled_ungraded)):.1%}")

    fit = pd.concat([pooled_graded.assign(group="graded"), pooled_ungraded.assign(group="ungraded")])
    fit = fit.loc[fit["sale_year"].le(2008)].copy()
    fit["ungraded"] = (fit["group"] == "ungraded").astype(float)
    fit["delta_x_ungraded"] = fit["ungraded"] * fit["log_odometer_delta"]
    print(f"2006-2008 pooled fit window: graded={int((fit['group'] == 'graded').sum()):,} ungraded={int((fit['group'] == 'ungraded').sum()):,}")
    for group_name in ("graded", "ungraded"):
        part = fit.loc[fit["group"] == group_name]
        print(
            f"    {group_name:<9} odo median={part['odo'].median():>9,.0f} delta mean={part['log_odometer_delta'].mean():+.3f} "
            f"delta sd={part['log_odometer_delta'].std():.3f} price median=${part['finalprice'].median():>8,.0f} age mean={part['vehicle_age'].mean():.1f}"
        )

    years = sorted(fit["sale_year"].unique())
    year_dummies = [fit["sale_year"].eq(year).to_numpy(dtype=float) for year in years[:-1]]  # 2008 baseline
    interaction_terms = [fit["log_odometer_delta"].to_numpy(dtype=float), fit["ungraded"].to_numpy(dtype=float), fit["delta_x_ungraded"].to_numpy(dtype=float)]
    names = ["log_odometer_delta", "ungraded", "delta_x_ungraded"]
    beta, se, cov, residual = ols(fit["target"].to_numpy(dtype=float), interaction_terms)
    report(beta, se, residual, names, "1a no year dummies")
    beta_y, se_y, cov_y, residual_y = ols(fit["target"].to_numpy(dtype=float), interaction_terms + year_dummies)
    report(beta_y, se_y, residual_y, names, "1a with sale-year dummies (2008 baseline)")
    graded_slope = beta_y[1]
    ungraded_slope = beta_y[1] + beta_y[3]
    se_diff = float(np.sqrt(cov_y[1, 1] + cov_y[3, 3] + 2 * cov_y[1, 3]))
    print(f"    graded slope={graded_slope:+.4f}  ungraded slope={ungraded_slope:+.4f}  difference={beta_y[3]:+.4f} (se {se_diff:.4f}, z={beta_y[3] / se_diff:+.2f})")
    for group_name in ("graded", "ungraded"):
        part = fit.loc[fit["group"] == group_name]
        own_residual = part["target"].to_numpy(dtype=float) - (
            beta_y[0] + beta_y[1] * part["log_odometer_delta"].to_numpy(dtype=float)
            + beta_y[2] * part["ungraded"].to_numpy(dtype=float)
            + beta_y[3] * part["delta_x_ungraded"].to_numpy(dtype=float)
            + sum(beta_y[4 + index] * part["sale_year"].eq(year).to_numpy(dtype=float) for index, year in enumerate(years[:-1]))
        )
        print(f"    residual sd {group_name:<9} = {own_residual.std(ddof=len(beta_y)):.4f}")

    # Trainer's exact population: peer stats over graded-valid rows only.
    graded_valid = base.loc[base["condition_score"].notna()].copy()
    trainer_pop = add_peer_stats(graded_valid, graded_valid)
    trainer_pop = trainer_pop.loc[trainer_pop["peer_count"].ge(8) & trainer_pop["peer_grades"].ge(2)].reset_index(drop=True)
    trainer_fit = trainer_pop.loc[trainer_pop["sale_year"].le(2008)]
    tb, ts, _, tr_res = ols(
        trainer_fit["target"].to_numpy(dtype=float),
        [trainer_fit["log_odometer_delta"].to_numpy(dtype=float), trainer_fit["condition_score"].to_numpy(dtype=float)],
    )
    report(tb, ts, tr_res, ["log_odometer_delta", "condition_score"], "trainer graded population 2006-2008")
    print(f"    trainer graded slope={tb[1]:+.4f} (se {ts[1]:.4f}); pooled graded slope={graded_slope:+.4f}")

    # --- 1b. damage flags on the full trainer population and the fit window ---
    print(f"\n=== 1b. vin_exdum* on the full graded trainer population (n={len(trainer_pop):,}, all years) ===")
    for flag in ("vin_exdum22", "vin_exdum5", "vin_exdum27"):
        values = trainer_pop[flag].to_numpy(dtype=float)
        prevalence = float(values.mean())
        raw_gap = float(trainer_pop.loc[values == 1, "target"].mean() - trainer_pop.loc[values == 0, "target"].mean())
        beta_f, se_f, _, residual_f = ols(
            trainer_pop["target"].to_numpy(dtype=float),
            [trainer_pop["log_odometer_delta"].to_numpy(dtype=float), trainer_pop["condition_score"].to_numpy(dtype=float), values],
        )
        print(
            f"    {flag:<12} prevalence={prevalence:6.2%} raw gap={raw_gap:+.4f} "
            f"controlled={beta_f[3]:+.4f} (se {se_f[3]:.4f}, z={beta_f[3] / se_f[3]:+.2f})"
        )
    print(f"    flags all-zero rows: {int(trainer_fit[FLAGS].sum(axis=1).eq(0).sum()):,}/{len(trainer_fit):,} on the 2006-2008 fit window "
          f"({trainer_fit[FLAGS].sum(axis=1).eq(0).mean():.1%})")
    for flag in ("vin_exdum22", "vin_exdum5"):
        subset = trainer_fit
        values = subset[flag].to_numpy(dtype=float)
        raw_gap = float(subset.loc[values == 1, "target"].mean() - subset.loc[values == 0, "target"].mean())
        beta_f, se_f, _, _ = ols(
            subset["target"].to_numpy(dtype=float),
            [subset["log_odometer_delta"].to_numpy(dtype=float), subset["condition_score"].to_numpy(dtype=float), values],
        )
        print(f"    2006-2008 fit window {flag:<12} prevalence={values.mean():6.2%} raw gap={raw_gap:+.4f} controlled={beta_f[3]:+.4f} (se {se_f[3]:.4f})")

    unflagged = trainer_fit.loc[trainer_fit[FLAGS].sum(axis=1).eq(0)]
    for label, part in (("all", trainer_fit), ("unflagged", unflagged)):
        b, s, _, r = ols(
            part["target"].to_numpy(dtype=float),
            [part["log_odometer_delta"].to_numpy(dtype=float), part["condition_score"].to_numpy(dtype=float)],
        )
        print(f"    OLS {label:<9} delta={b[1]:+.4f} (se {s[1]:.4f}) score={b[2]:+.4f} (se {s[2]:.4f}) resid_sd={r.std(ddof=3):.4f}")
    grades_all, odo_all = multipliers(champion(trainer_fit))
    grades_unflagged, odo_unflagged = multipliers(champion(unflagged))
    print("    representative multipliers (GBR champion, fit window), all vs unflagged-only:")
    for grade in GRADE_SCORE:
        moved = 100 * (grades_unflagged[grade] - grades_all[grade]) / grades_all[grade]
        print(f"      {grade:<12} all={grades_all[grade]:.4f} unflagged={grades_unflagged[grade]:.4f} move={moved:+.2f}%")
    for delta in (-0.5, 0.5):
        moved = 100 * (odo_unflagged[delta] - odo_all[delta]) / odo_all[delta]
        print(f"      Average @delta={delta:+.1f} all={odo_all[delta]:.4f} unflagged={odo_unflagged[delta]:.4f} move={moved:+.2f}%")

    # --- 1c. odoflagnew_dum == 0 A/B on 2008 --------------------------------
    print("\n=== 1c. odoflagnew_dum == 0 (questionable odometer) A/B on 2008 ===")
    tr_flag = trainer_pop.copy()
    tr_flag["odo_questionable"] = tr_flag["odoflagnew_dum"].eq(0)
    print("    trainer population by sale year x questionable:")
    print(tr_flag.groupby(["sale_year", "odo_questionable"]).size().unstack(fill_value=0).to_string())
    print(f"    full trainer population questionable={int(tr_flag['odo_questionable'].sum()):,} of {len(tr_flag):,}")
    fit0707 = tr_flag.loc[tr_flag["sale_year"].le(2007)]
    val08 = tr_flag.loc[tr_flag["sale_year"].eq(2008)]
    print(f"    fit 2006-2007 n={len(fit0707):,} questionable={int(fit0707['odo_questionable'].sum())}")
    print(f"    val 2008    n={len(val08):,} questionable={int(val08['odo_questionable'].sum())}")

    def evaluate(model, part):
        predicted = np.exp(
            part["peer_anchor_log"].to_numpy(dtype=float)
            + tcm.predict_adjustment(model, part["condition_score"].to_numpy(dtype=float), part["log_odometer_delta"].to_numpy(dtype=float))
            - float(tcm.predict_adjustment(model, np.asarray([2.0]), np.asarray([0.0]))[0])
        )
        return tcm.metrics(part["finalprice"].to_numpy(dtype=float), predicted)

    model_keep = champion(fit0707)
    model_drop = champion(fit0707.loc[~fit0707["odo_questionable"]])
    val_clean = val08.loc[~val08["odo_questionable"]]
    print(f"    A) train all       -> 2008 full: {evaluate(model_keep, val08)}")
    print(f"    A) train all       -> 2008 w/o flagged: {evaluate(model_keep, val_clean)}")
    print(f"    B) train w/o flag  -> 2008 full: {evaluate(model_drop, val08)}")
    print(f"    B) train w/o flag  -> 2008 w/o flagged: {evaluate(model_drop, val_clean)}")


if __name__ == "__main__":
    main()
