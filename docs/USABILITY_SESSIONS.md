# Usability session kit

Facilitator kit for the five release-test sessions required by the success measures in [PRODUCT_SPEC.md](PRODUCT_SPEC.md). Five active Canadian used-car shoppers, about 20 minutes each, in person or over screen share.

This kit is preparation. The sessions have not been run, and nothing here runs them: the human maintainer recruits and moderates. Outcomes feed the release criteria: 5 sessions, at least 4 of 5 participants correctly explain the median and typical band, no participant reads the result as a guaranteed sale value, and median time to complete a check under 90 seconds.

Session at a glance: 2 min intro and consent, 12 min tasks, 3 min wrap-up, buffer for setup.

## 1. Recruit and screen

Post or DM:

> I'm testing a free tool that checks whether a used car's asking price is unusual for dealer inventory in your province. I need people shopping for a used vehicle right now who have a specific listing or two in mind. It's a 20 minute video or in-person session, no technical skill needed, you won't be asked to buy anything, and your name and listing details stay out of my notes. Reply and we'll find a time.

Screen with these questions and stop at the first no:

1. Are you currently shopping for a used vehicle, or directly helping someone who is? (must be yes)
2. Do you have a specific listing in mind with a year, make, model, asking price and rough kilometres? (must be yes)
3. Which province is the vehicle in?
4. Do you work in the car business: sales, dealer, appraiser, insurance, inspection or a car marketplace? (yes means exclude)
5. Are you okay with about 20 minutes, and with a recording if recording is convenient? (recording is optional, a no is still fine)

Book 5 sessions plus 1 spare for no-shows. Mix phones and laptops if you can, since the app gets checked on both.

## 2. Consent, recording, anonymization

Read this before anything else:

> This is a test of a tool, not of you. There are no right or wrong answers and you can stop at any time. I'd like to record the session so I can write accurate notes, and I'll ask for your OK before starting. Notes use a participant code, P1 to P5, never your name, and I'll leave your listing details out. Is it okay if I record?

Start recording only after an audible yes. If they decline, take notes by hand and carry on. Delete recordings once notes are written, and keep names, links, VINs and exact listing details out of notes and issues.

## 3. Moderator script

Intro:

> Thanks for helping. I'm checking a used-car price tool before release. You can't break anything, and there are no wrong answers. Please think out loud while you use it: what you're looking at, what you expect, and anything that surprises or confuses you. I'll stay quiet most of the time and may ask a question now and then. It's about 20 minutes and you can stop whenever.

Think-aloud instruction:

> As you go, tell me what you're thinking. If something looks confusing, say so out loud. That's the most useful thing you can give me.

Rules for the moderator:

- Do not explain the interface or point at controls. If they ask a direct question, reply "What would you try?" and wait.
- Let silence run about 5 seconds before prompting, and only step in after roughly 30 seconds stuck.
- Never lead: no "this is easy", no "most people find", no "what you should see is".
- Open prompts only: "What are you seeing?", "What does that mean to you?", "What would you do next?", "Was anything confusing?"
- Let them finish, then write down their words rather than your summary.

App reference, for you only: one page, with the listing form on the left (Vehicle, Condition, VIN tabs) and the result panel on the right. "Check this price" moves to the result, which has Price position, Mileage, Across Canada and Compare views. Do not walk them through any of it.

## 4. Tasks

Run these in order, one at a time, and read each prompt as written. Use the build that includes the listing import: `npm run dev` from this checkout and open `http://localhost:3000`, or the live demo once it includes this release. Check it loads before the session.

### Task 1. Cold open and a real price check

Prompt: "Open this link. This tool checks a used car's asking price against dealer inventory. Use it to check the vehicle you're actually considering, the way you would in real life."

- Start the timer when the app is visible.
- Stop when the result panel shows an estimate for their vehicle with their asking price entered, or when they say they are done. Record the time in seconds.
- Do not point at tabs or fields. If they fall back to the prefilled vehicle, note it and let them continue, but a fallback is not a completed check for their own vehicle.
- Release target: median time across the five sessions under 90 seconds.

### Task 2. Read the price band out loud

Prompt: "In your own words, what is this picture telling you about the asking price?"

Follow-ups if needed: "What do the numbers above the bar mean?" / "Where does the ask sit compared with the market?" / "If a friend asked what the middle number is, what would you say?"

Correct means: the median is the middle of comparable listings, about half below and half above; the band is where most comparable prices sit, the middle half (P25 to P75), with P10 to P90 as the wider observed range. Jargon is not required. Capture their exact words.

Incorrect, and worth capturing verbatim: the median read as "the value of this car", or the band read as a guarantee or an offer range.

Release target: 4 of 5 correct.

### Task 3. Condition tiers

Prompt: "Switch to the Condition tab. Change the tier and tell me what happens."

Capture whether they can say what changed (the estimate moves, and the non-average tiers show a dollar difference against the average tier), and what each tier means in their own words. The tiers on screen: Below average (salvage, rebuilt or branded title), Rough (needs mechanical or cosmetic work), Average or better (typical used condition, the reference point).

Watch for a reading of the tier as an appraisal of their specific car rather than a market adjustment.

### Task 4. What would you do next

Prompt: "Looking at the result page, what would you do next with this information?"

Capture the next action they name (negotiate, ask for an inspection, check history, keep looking, walk away, nothing yet) and whether they treat the estimate as a guaranteed sale value. Then ask: "Is there anything about this number you're unsure about?"

Record whether they open "Inspect the evidence" and whether the prediction boundary line changes how they read the number. Release criterion: nobody should read the result as a guaranteed value. Any slip, even half a sentence, is a finding.

### Task 5. Paste a listing link

Live in this build (commit 03f2647). At the bottom of the Vehicle tab there is a "Paste a listing link" field for AutoTrader.ca, Kijiji.ca, Carpages.ca and Clutch.ca links. It fills make, model, year, odometer and asking price on a best-effort basis. Confirm the build you test shows the field; the deployed live demo may lag until this branch is released.

Prompt: "If you have your listing link handy, paste it in and import it. Tell me what you think happened."

- The import fetches the listing page on the server. Some listing sites refuse that fetch, and the app then shows an error. Manual entry is unaffected; note the refusal and let them type the details in or move on.
- Imported fields stay editable, and any of them can be missing or wrong. Ask the participant to check each imported value against their listing page, and record whether they did that without being prompted.
- Capture: imported or refused; which fields came through; any value they corrected; any confusion about what the import changed.
- No link handy: skip the task and note it as a session limitation, not a failure.

## 5. Capture per participant

One row per participant in the table, quotes underneath.

- Participant code (P1 to P5), date, device and setup (phone or laptop, in person or screen share)
- Time to first completed check for their own vehicle, in seconds
- Did their province, make, model and year exist in the app? If not, what did they fall back to?
- Median and band explanation: correct, partial or incorrect, with a quote
- Condition tiers: could they say what changed? With a quote
- Guaranteed-value slip: yes or no, with a quote
- Next action they named
- Confusion points, verbatim
- Anything they expected to do but could not

| # | Device | Time (s) | Median + band | Tier change | Guarantee slip | Next action | Main confusion |
|---|--------|----------|---------------|-------------|----------------|-------------|----------------|
| P1 | | | Y / P / N | Y / P / N | Y / N | | |
| P2 | | | | | | | |
| P3 | | | | | | | |
| P4 | | | | | | | |
| P5 | | | | | | | |
| Summary | | median __ s, target under 90 | __ of 5 correct, target 4 | | __ of 5 slipped, target 0 | | |

Y = correct, P = partial, N = incorrect. Keep a short list of quotes per participant, one or two lines each, anonymized.

## 6. Findings to issues

1. Write one finding per distinct problem. Merge repeats across participants into one finding and put the count under Frequency.
2. Severity:
   - S1 blocks the core check, or produces a wrong or unreadable result on their device.
   - S2 causes a wrong understanding: misreads the median, takes the estimate as guaranteed, does not notice the tier changed the estimate.
   - S3 is friction or wording that slows them down without changing the outcome.
3. Frequency: participants affected, for example 3/5.
4. Priority:
   - S1 at any frequency: fix before release.
   - S2 at 2 or more: fix before release.
   - S2 at 1, or S3 at 3 or more: fix if small, otherwise log it with the session quote.
   - S3 at 1: log or note it.
5. Issue text: what happened, what they expected, one quote, participant code, device, task number, and which release measure it affects. No names or listing details. File it in the GitHub tracker like any other issue and link it from the results row.

If the sessions contradict a release criterion, update [PRODUCT_SPEC.md](PRODUCT_SPEC.md) in the same pass as the findings. Do not move the bar quietly.
