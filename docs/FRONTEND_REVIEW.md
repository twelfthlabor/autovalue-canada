# AutoValue valuation workspace

Implemented September 14, 2026 in `/Users/daniel/Desktop/repo/autovalue-ml`, on `design/interactive-price-studio`.

## Product audit

AutoValue helps Canadian used-car shoppers evaluate a listing's asking price. The live application reads 5,605 inventory cells representing 180,833 vehicles from the committed Canadian market artifact. Each cell groups province, make, model and year, and includes price percentiles, mileage, inventory count and days on market.

The browser applies the committed condition model, trained on 91,278 historical US wholesale outcomes, to that Canadian reference. The selected condition tier maps to an auction-grade equivalent; mileage adjustments respect the model's support limits. The result is a modelled asking-price reference, not an offer, transaction appraisal or depreciation forecast.

The current VIN route validates the VIN and proxies the official vPIC decoder. It does not run the older reviewed-listing registry, cached VIN workflow or OLS path described in parts of the historical architecture documents. The interface follows the actual running code. A decoded VIN without a matching market cell must never inherit a price from an unrelated vehicle.

## Research and design decisions

Creator sites, component documentation and original GitHub repositories informed the design:

- [UI Labs, Mariana Castilho](https://www.uilabs.dev/): contextual controls, parameter editing and compact interactive surfaces. Inspected the live site in Chromium.
- [DialKit, Josh Puckett](https://github.com/joshpuckett/dialkit): grouped parameter controls and presets inspired the listing/condition/VIN editor and quick condition buttons. The developer panel itself is not included.
- [Base UI tabs](https://base-ui.com/react/components/tabs) and [dialog](https://base-ui.com/react/components/dialog): used the maintained accessible primitives directly. Tabs support arrow-key focus and Enter activation; the evidence dialog dismisses with Escape and returns focus to its visible trigger. `@base-ui/react` is pinned to 1.8.0.
- [SmoothUI](https://github.com/educlopez/smoothui) and its [animated tabs](https://smoothui.dev/docs/components/animated-tabs): reviewed the original project for compact tab transitions and interaction feedback. No copied component source.
- [Rauno Freiberg's Graph Slider](https://rauno.me/craft/graph-slider): direct manipulation with a stable numeric readout informed the model-driven mileage graph. Its implementation here uses AutoValue's model and native range semantics.
- [Emil Kowalski on animation](https://emilkowal.ski/ui/you-dont-need-animations): direct input remains immediate; motion is limited to tab indicators and brief panel entry, with reduced-motion support.
- [Vaul](https://github.com/emilkowalski/vaul) was reviewed for interaction ideas. Its unmaintained status ruled it out as a new dependency.

X searches and direct creator profiles were attempted, but profiles were inaccessible and results did not establish engagement rankings. These are inspectable creator and GitHub references, not a claim to have identified the top posts on X.

The earlier cobalt layout was too tall. This version uses a centred 1,220 px maximum shell, a viewport-height budget on laptops, and two coordinated work areas. The white and cool-grey surfaces use J.D. Power’s published blue (#0087FB), with #005DA8 for readable text and a slate asking-price marker. Archivo carries vehicle names and prices; Inter handles controls, with a monospace face for units. The distinctive interaction is a working valuation instrument: edit a real input and see its effect, or pin a scenario and compare.

## Behaviour

- The main task fits at 100% zoom on 1280 × 720, 1366 × 768, 1440 × 900 and 1920 × 1080 screens. Left and right margins match. No CSS zoom or scaling workaround is used.
- Vehicle, condition and VIN are separate editor tabs. Price position, mileage, Canadian markets and comparison are separate result tabs. Longer evidence and province lists scroll independently; phone pages use normal vertical scrolling.
- The asking-price scrubber, exact numeric field and ±$500 buttons share one value. A $31,995 input is not rounded by the slider. Changing the ask does not change the model's estimate.
- Mileage drag, native keyboard slider and numeric input update the same model. The line samples 101 points from 0 to 250,000 km. The current estimate uses exact mileage, not curve interpolation. Resetting to market median restores the precise source value. Hover alone does not alter inputs.
- Provincial comparisons use the same make/model/year and display published medians before adjustments. Selecting a province changes its reference; differences may reflect inventory mix.
- Pinning stores an in-memory copy of the current scenario and its estimate/range. Changing inputs leaves the pin fixed. Restore inputs brings it back; Clear pin removes it. VIN is excluded from the pin and the pin itself is not persisted; the separate saved-checks section stores scenario inputs in browser storage and can copy them into a share link.
- Evidence remains available through Inspect the evidence: Canadian anchor, model adjustment, input coverage, support warnings and limitations.
- VIN decoding still requires an explicit action. Mocked service tests retain successful matches and no-match blocking. No new live-provider verification is claimed.
- Zero kilometres is a real input; only a blank field falls back to market median. Failed market loading provides a reload action.
- Favicon, share image and all navigation pages use the same blue visual system.

## Preview and verification

```sh
npm run build
npm run start -- --hostname 127.0.0.1 --port 3301
PLAYWRIGHT_PORT=3301 npm run test:e2e
```

Browser artifacts are local and ignored by Git under `output/playwright/` and `.playwright-cli/`. The optional Playwright port avoids unrelated local apps.

The results below are from local production verification. No model, market artifact, API contract, commit, push or deployment is part of this frontend change.

- Production build, TypeScript compilation, ESLint and `git diff --check` passed.
- 65 unit tests passed. The production browser suite passed 113 tests across desktop and mobile, with 25 viewport-specific skips.
- Normal-zoom geometry assertions cover full-workspace fit, matching margins, visible price-panel content and no horizontal overflow at four laptop/desktop sizes. Manual browser inspection also covered 320, 390 and 768 px widths.
- Browser coverage includes price scrubbing, graph drag versus hover, precise market-median restoration, condition changes, regional data matching, pin/restore, dialog focus restoration, keyboard tab activation, load recovery and mocked VIN safety paths.
- The historical connector test injects its old transition to stress geometry; production pricing input remains immediate. Existing data-derived model-metric assertions remain intact.
- After the final phone input-spacing adjustment, the production build and three focused responsive/viewport checks passed again (one desktop-only skip).
- The production interaction walkthrough reported zero browser errors or warnings.
- Final screenshots: `output/playwright/workspace-desktop.png`, `workspace-laptop.png`, `workspace-mobile.png`, `workspace-condition-mileage.png`, `workspace-markets.png`, and `workspace-compare.png`.


## Blue palette and research-page revision

The user requested J.D. Power blue and a more deliberate design for the other tabs. The brand reference is the published [J.D. Power brand book](https://discover.jdpa.com/hubfs/Files/Industry%20Campaigns/Valuation%20Services/2020%20J.D.%20Power%20Brand%20Book_011121.pdf), which names #0087FB in its primary gradient. The live cars site was also inspected, but its current teal/orange treatments are not the requested blue. AutoValue retains its own name and identity.

- Replaced the large slogans, nested cards, numbered benefit blocks and dark technical diagram on the research pages with simple page titles, an in-page index and readable sections.
- Market Lab now includes a provincial coverage explorer. Selecting a province reveals its inventory, cell count, makes and year span; the chart can switch between vehicle counts and market-cell counts. Every summary comes from the released market rows.
- Methodology uses a reading column, concise definitions and a source list. Research benchmark figures now come from the generated metrics artifact instead of hard-coded historical values.
- How We Calculate now has a working example using the actual condition model. Mileage and condition change the equation, while selecting an equation term explains it. Reset restores the original inputs. Removed the unused static PriceAnatomy component.
- Kept data provenance, validation folds, all segment rows, source limitations and VIN boundaries. Green is reserved for validation/status cues; the interactive controls, chart accents, selected provinces and comparison panels use blue.
- Browser screenshots cover all routes at 1440 px and research pages at 390 px. Overflow checks also cover 320, 768 and 1280 px. Updated screenshots use the `blue-` prefix under `output/playwright/`.

Final blue-revision verification: production build, ESLint, 65 unit tests and 118 Playwright tests passed; 26 viewport-specific cases were skipped. The production walkthrough logged no browser errors or warnings. The calculation example fits the 1280 × 720 viewport at normal zoom. Market artifacts, the pricing model and VIN API have no diff. The local production preview runs on port 3301.

## Interface polish pass

A later pass modernised the surfaces, numerals, motion and accessibility. Implementation centred on `app/globals.css`, `components/valuation-workbench.tsx`, `components/mileage-curve.tsx` and `components/calculation-example.tsx`; the fix round touched the first three. This pass added no dependencies, changed neither `package.json` nor the lockfile, and moved no model, market data or API surface.

Sources and what landed:

- [Jakub Krehel: Details that make interfaces feel better](https://jakub.kr/writing/details-that-make-interfaces-feel-better): layered border-as-box-shadow hairline rings instead of flat borders, a concentric radius scale, `text-wrap: balance`/`pretty`, a tabular-numerals audit, and optical alignment of band markers and callouts.
- [Emil Kowalski: You Don't Need Animations](https://emilkowal.ski/ui/you-dont-need-animations): motion under 300ms (the estimate settle pulse runs 280ms), interruptible transitions, no animation for repeated or keyboard-driven actions, and a reduced-motion kill switch.
- [Bklit UI](https://github.com/bklit/bklit-ui) chart-token pattern (MIT; the pattern was copied, not the dependency): gradient and rounded bar fills plus chart styling tokens for the coverage bars, fold bars, mileage curve and price-band paint.
- [Rauno Freiberg: craft notes](https://rauno.me/craft/novelty): restrained novelty budget, generous hit areas and motion legibility, applied through the settle pulse and hover states.

Considered and rejected: NumberFlow-style digit-roll on valuation numbers (the suite reads numeric text synchronously, so animating it would be flaky; only a decorative glow was added), React View Transitions (react@19.2.8 does not export `ViewTransition`, verified), and new UI or Tailwind dependencies (static-first, minimal-dependency project).

The verification fix round:

- CTA gradient darkened from `#1ba1ff`/`#0087fb` to `#0a74d6`/`#005da8`, so white text passes AA (4.69:1 worst stop; 5.09:1 or better on hover); the result-panel focus ring uses `#005da8` (6.71:1).
- The load-error "Reload market data" button is styled like other system actions (40px minimum height, system gradient).
- Band median dot and connector restored to ink under a single band rule set (ink connector 14.1:1); callouts use weight 600 and tabular figures.
- `--faint` darkened to `#5d6b79` (5.0:1 or better on used surfaces); negative zero now shows ±$0.
- VIN decode scrolling respects reduced motion; the settle pulse is 280ms; mobile coverage bars measure ~42px and segment-table headers are 10px; SVG gradient ids are namespaced with `useId`.

Final verification (local production build): `npm run lint` clean; `npm test` 65 passed; `PLAYWRIGHT_PORT=3301 npm run test:e2e` 118 passed / 26 skipped (chromium-desktop + mobile-chrome); `npm run build` succeeded; zero horizontal overflow at 320/390/768/1280 on all four routes; reduced motion disables the added animation with the estimate text still visible; numeric text confirmed non-animated (a single settled mutation, expectations computed from the model); contrast measured independently; band geometry specs 54 passed / 24 skipped / 0 failed. That run covered Chromium only; the Playwright config now adds webkit-desktop and mobile-safari, and CI installs WebKit. Real iOS hardware and Firefox remain untested. No commit, push or deployment was performed.

Known limitations: light-only theme; the band caption row can read non-left-to-right at very narrow widths when labels are clamped (pre-existing layout algorithm, unchanged here); normal-motion band markers are immediate by prior design (`transition: none`) while the historical connector spec injects the old spring only to stress geometry; the preview server runs at http://127.0.0.1:3301.

### Condition-form simplification

The condition form now collects the overall grade only. The user approved removing accident/title, mechanical, cosmetic, service and tire/brake fields for two reasons: the training table has no separate labels for those dimensions, so they cannot become ML features, and the fitted trees split the condition score only at 0.5 / 1.5 / 2.5, so the adjustments behind the removed fields were individually inert at every level. Combinations could still cross a threshold, which made the controls unpredictable rather than useful (service and tires were inert outright; cosmetic moved only at the heavy setting; accident/mechanical only at major/rebuilt). The grade maps directly: salvage -1, extra-rough 0, rough 1, average 2, clean 3, extra-clean 4, bounded to [-1, 4]; `lib/condition-model.ts` and `aws/condition_model_py.py` stay in parity.

The evidence dialog labels the factor "Condition" and renders `Auction-grade equivalent <score> (scale -1 to 4)` (salvage `-1.00`, rough `1.00`); the condition note now reads "The panel supports three tiers and does not distinguish above-average grades; the form does not offer them." An earlier note text triggered a 5px panel overflow at 320 × 568; tightening narrow-width spacing only fixed it, and the panel fits with zero overflow at 320/360/390/768/1280/1440.

Final verification: `npm run lint` clean; 65 unit tests passed; `npm run build` clean; `PLAYWRIGHT_PORT=3301 npm run test:e2e` 118 passed / 26 skipped; the parity script reports 64 checks with 0 failures; a probe on the default RAV4 with the odometer setting unchanged gives average $31,000, rough $28,600, extra-rough and salvage $22,700; a UI sweep of all four routes at desktop, mobile, 320 and 768 px passed with zero horizontal overflow and zero console errors, with 21 snapshots under `output/playwright/final2-*.png`.

Known cosmetic nit: in the evidence dialog at desktop width the salvage value wraps with an orphan "4)" in its column; readable, unfixed.

### Condition tiers

The Condition tab now offers three tiers instead of the six auction grades: below average ("Salvage, rebuilt, or branded title"), rough ("Needs mechanical or cosmetic work") and average or better ("Typical used condition"). Each row shows the live dollar delta for the current vehicle and entered odometer, captioned "vs avg tier" (title: "Difference vs the Average tier at the same mileage"); the default RAV4 at 89,000 km gives average $31,000, rough $28,600 and below average $22,700. The panel note reads "The panel supports three tiers and does not distinguish above-average grades; the form does not offer them." The tiers match the three effective levels the auction panel resolves (multipliers 0.7577, 0.9091, 1.0): Clean vs Average is +0.05% on the Larsen panel (not distinguishable, z=0.25), Extra Clean is 2.2% below Average (z=-4.8), and retraining for six distinct monotone levels costs +1.2% to +3.4% MAE. The model, artifact and Lambda contract are unchanged: the API still accepts all six grade strings, and TS/Python parity stays at 64 checks.

Tier verification: 68 unit tests passed; `PLAYWRIGHT_PORT=3301 npm run test:e2e` 118 passed / 26 skipped; `npm run build` clean; zero horizontal overflow at 320/360/390/768/1280/1440; screenshots `output/playwright/tiers-*.png`.
