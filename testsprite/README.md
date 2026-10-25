# TestSprite suite

The browser scenarios TestSprite runs against every deployment: 24 we wrote and 6 it proposed itself. `plans/` holds each of our tests' plan (the steps and the one or two assertions that decide it), `tests.json` maps our ids to TestSprite's. The plans are the source: a change to the suite is a change to these files, uploaded with the TestSprite CLI (`testsprite test create-batch --plan-from-dir testsprite/plans`).

Every assertion is a sentence the app renders word for word, so a test fails on the product being wrong, not on the wording drifting. The tests start from one URL, then click; nothing is dragged, uploaded or opened in a second tab. Seeded data is read-only for them: anything a test writes (a ballot in `offsite-2026`, an invite code in rival's `rival-club`) leaves the next run's assertions true.

| Id | Area | What decides it |
|---|---|---|
| T01 | Certified replay | NYC 2025: "Winner: Zohran Kwame Mamdani", final round 573,169 and 443,229 |
| T02 | Certified replay | "28 of 28 figures match the official count" |
| T03 | Browser recount | Portland 2024 District 1, 17 rounds of STV: "159 of 159 figures match" |
| T04 | Pathology | Burlington 2009: "Ranked-choice winner: Bob Kiss", "Condorcet winner: Andy Montroll" |
| T05 | Power user | "Showing 1–20 of 120 polls", then "Showing 21–40 of 120 polls" |
| T06 | Power user | Search "Board election": "Showing 1–1 of 1 poll" |
| T07 | Voter | Rank, move up, remove, cast with buttons only: "Your receipt" and a code |
| T08 | Voter | The receipt finds the ballot in the order cast: "1. Tallinn", "2. Valencia", "3. Lisbon" |
| T09 | Voter | "You've already voted in this poll from this browser." |
| T10 | Voter | "That code isn't valid for this poll." |
| T11 | Organizer → voter | A generated invite code works once: "This code has already been used." |
| T12 | Time | "Opens January 15, 2027, 12:00 PM (America/New_York)" and no ballot |
| T13 | Time | The daylight-saving gap on March 14, 2027 in New York, explained before saving |
| T14 | Time | Schedule simulator: "At that time this poll is open." |
| T15 | Access | Owner-only results look like no poll at all, and never name the owner |
| T16 | Access | Someone else's manage page: the same page as no poll |
| T17 | Access | "Results are hidden until this poll closes." |
| T18 | Auth | "Wrong email or password." |
| T19 | Results | "Winner: Tacos", "2 rounds" |
| T20 | Audit | The browser hashes the cast-vote record and counts it again: "Recount matches: …" |
| T21 | Audit | The RCTab summary JSON names Tacos with a final tally of 7 |
| T22 | Count tool | The overvote example under New York City rules: "Winner: Bea" |
| T23 | Count tool | The same ballots under Minneapolis rules: "Winner: Ash" |
| T24 | Quality | "38 of 38" RCTab rules fixtures, 6 elections matching exactly |

Negative paths: T09, T10, T11, T13, T15, T16, T17, T18. Several actors in one test: T11 (organizer, then voter), T16 (one organizer, another's poll). Time: T12, T13, T14. Checked against an outside answer: T01–T04 (official election reports), T20–T23 (the published count, RCTab's format, two cities' overvote rules).

TestSprite's own exploration of the live site proposed eight more tests; the six that cover pages ours don't (opening a replay from the home page, the count tool's default and tie examples, the API reference and token guidance, starting a poll) were accepted and run with the suite. One of them asked to "load the default ballot example", which the count tool doesn't have, and failed when TestSprite read it literally. It now counts the overvote example under the default rules. They are listed under `generated` in `tests.json`.

The demo accounts these tests sign in with are public: `ada@recount.dev` / `recount-demo-ada`.
