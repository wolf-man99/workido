# Matching engine

Deterministic and rules-based (`src/lib/domain/matching/engine.ts`). **It does not use AI** and the UI never claims it does. Unit tests: `tests/unit/matching-engine.test.ts`.

## Pipeline

1. **Candidates** — `get_match_candidates(requirement)` (owner/admin only) returns published, active specialists relevant to the requirement's category (incl. subcategory/children) or sharing a requested skill, with public profile data and aggregate reliability metrics (max 300).
2. **Eligibility** — hard exclusions:
   - profile unpublished or account suspended;
   - availability `unavailable`;
   - availability `busy` when the task is **urgent** (treated as an instant hire);
   - missing a skill the buyer marked **must-have**;
   - fastest known delivery time (in-category service, else any service) longer than the time left before the deadline. If delivery time is unknown, nobody is excluded on this basis.
   New specialists are **never** excluded for having no reviews or orders.
3. **Scoring** — weighted components (configurable, `DEFAULT_MATCH_WEIGHTS`):

   | Component | Weight | How it's earned |
   | --- | --- | --- |
   | Skills | 30 | Share of requested skills the specialist has (only when skills were requested) |
   | Category | 20 | Published service in the category = 100%; declared category/skill category = 75% |
   | Availability & delivery | 15 | Available = 1, busy = 0.5; × 0.7 when the deadline leaves less than 2× their fastest delivery time |
   | Budget | 15 | Lowest relevant price ≤ budget = 100%; ≤ 125% of budget = 40%; only when both budget and a price exist |
   | Portfolio evidence | 10 | Portfolio in the category = 100%; any portfolio = 40% |
   | Reliability | 10 | Mean of on-time rate and (1 − cancellation rate); only with ≥3 relevant orders |
   | Verification | 5 | Admin-verified = 100% |
   | Experience | 5 | Meets/exceeds preferred level = 100%; one level below = 50%; only when a preference was given |

   **Missing data is omitted, not rewarded:** a component that can't be evaluated is left out of both the earned and the possible points. Score = earned ÷ possible × 100 (one decimal). This is how reliability points are "redistributed" for specialists without history.
4. **Ranking** — score desc, then completed orders desc, then id (fully deterministic). Scores below 25 are dropped; the shortlist keeps the top 8 (`SHORTLIST_SIZE`).
5. **Storage & display** — the shortlist is stored in `requirement_matches` (owner-only). Buyers see a qualitative label (Strong ≥75 / Good ≥55 / Possible) and positive reasons such as "Matches all 2 skills you asked for", "Offers services in Graphic Design", "Available now", "Can deliver within your timeframe", "Starting price fits your budget", "Relevant portfolio available", "Verified specialist". Raw component scores are never shown to buyers or specialists.

Matching runs when a requirement is posted or edited, and on demand via "Refresh"/"Find matches".

## Tuning

Weights, thresholds (`MIN_RELIABILITY_SAMPLE`, `BUDGET_STRETCH_FACTOR`, minimum score, shortlist size) are product parameters. Change them in one place and update the unit tests that pin the behaviour you care about.
