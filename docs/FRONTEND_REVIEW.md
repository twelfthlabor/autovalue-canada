# Frontend skill review and applied design direction

## Sources reviewed

1. [PracticalSwan frontend-design](https://github.com/PracticalSwan/agent-skills/blob/main/frontend-design/SKILL.md) — the strongest task-fit rubric in the reviewed set. It treats accessibility, functional correctness, responsive behavior and rendered verification as hard gates rather than polish.
2. [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines) — the most established implementation checklist reviewed. It emphasizes concise action labels, consistent numbers/currency, useful error exits and systematic interface review.
3. [Frontend Agent Skills](https://github.com/hueyexe/frontend-agent-skills) — a useful decomposition of visual composition, forms, information architecture, accessibility and UX writing instead of one monolithic visual-style prompt.

Popularity was not used as a substitute for fit. The chosen direction combines the most relevant guidance with AutoValue's existing evidence-led visual language.

## Applied direction: clean evidence console (v0.3 redesign)

The primary job is to decide whether a listing price deserves more scrutiny. The interface is styled after modern fintech dashboards (Mercury/Stripe): white cards on a warm gray canvas, hairline borders, serif display numerals, one orange accent, and a glass sticky header with an active-link state.

- VIN decode is an explicit action and the response identifies the official source.
- Asking price, odometer and condition inputs remain visible and user-controlled; labels sit at a readable 12.5–14px with uppercase micro-labels reserved for kickers.
- No seller snapshot, demo VIN or stale listing card is embedded in the consumer flow.
- The result names the missing listing feed so a future licensed connector has a clear place to attach.
- The valuation sheet is structured for scanning: headline stat tiles (ML value / seller ask), a percentile distribution strip with the ML estimate and listing ask marked on the track, a price-anatomy equation (anchor + adjustment = value), icon-led factor coverage, and a four-column method footer.
- Keyboard focus is visible across links, buttons, inputs, selects and disclosure controls.
- Motion is CSS-only, transform/opacity-based and bounded: tokenized easing (`--out`, `--spring`), staggered valuation-sheet reveals with per-card pop-in, spring-gliding price-band markers, shine-sweep and press feedback on actions, drift-tinted hero gradients and a live-status pulse. Inter Variable was added as the UI face; no component dependency was added. `prefers-reduced-motion` collapses all of it.
- The one-page desktop sheet fits a 720px-tall viewport with margin to spare; short-screen and tall-screen tiers tune density without dropping asserted content.

## Verification gates

- Live VIN decode and no-snapshot listing behavior have end-to-end coverage.
- Supported VINs must map to a released Canadian market cell and produce a bounded prediction.
- Desktop and mobile end-to-end coverage keeps the valuation sheet within the intended one-page workflow.
- Production build, TypeScript, lint and responsive rendered checks must pass before release.
