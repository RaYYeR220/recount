# TestSprite suites

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

## API suite

Twelve backend tests in a separate TestSprite project (`Recount API`), one Python file each in `api/`. TestSprite runs the file as written, with the project's credential prepended as `__AUTH_HEADERS__`: the bearer token of `api-suite@recount.dev`, an organiser account that owns no seeded poll. The tests call production (`https://recount-kappa.vercel.app/api/v1`), because TestSprite's backend runs take their target from the code; `.github/workflows/api-suite.yml` runs them after every production deploy.

| Id | What decides it |
|---|---|
| A01 | `GET /elections`: eight replays, each with a dataset SHA-256 and the official source it came from |
| A02 | NYC 2025: no mismatch in 28 certified figures, 3 rounds, every round adds up, Mamdani over half |
| A03 | 312 of 317 official figures match across the eight replays; Burlington 2009 and Alaska 2022 name each difference |
| A04 | `POST /tabulate`: Tacos wins after Sushi's 3 move, every ballot accounted for, the same count in RCTab format |
| A05 | STV surplus: 4/12 moves at 0.3333 (Ben +2.9997, 0.0004 residual, 23 votes held every round), 8/12 at 0.6666, not 0.6667 |
| A06 | Bad counting input is a 422 naming the field; a body over 1 MB is a 413 |
| A07 | A poll's public view carries no internal ids; unknown, mixed-case, punctuated, overlong and traversal slugs are the same 404 |
| A08 | Hidden results 403, unpublished CVR 423, someone else's owner-only poll or close a 404 even with a valid token, a bad token 401 |
| A09 | The CVR's CSV hashes to the published SHA-256, and counting its rows again through `/tabulate` gives the published rounds |
| A10 | With the token: create, results hidden from others but not the owner, CVR locked, close once, CVR published with a matching hash |
| A11 | Creating a poll without a token is 401; a formula-like option, an unknown time zone, too many STV seats, a short title and a bad opening time are each named in a 422 |
| A12 | The OpenAPI 3.1 document lists exactly the eight operations served, and each answers a missing slug with a status it documents |

A10 creates one poll per run under the suite's account and closes it before it finishes. Nothing else is written.

A12 first failed in TestSprite before it ran: its validator read the path template `/polls/{slug}` in the test as an unsubstituted URL. The test now writes path parameters as `<slug>`.

