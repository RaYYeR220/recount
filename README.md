# Recount

Ranked-choice polls and elections with a count you can check against the official one.

**Live:** https://recount-kappa.vercel.app · demo organiser `ada@recount.dev` / `recount-demo-ada` (120 polls) · a second organiser `rival@recount.dev` / `recount-demo-rival`

Recount runs instant-runoff and single-transferable-vote polls: organisers set one up in a few steps, voters rank options with buttons (no dragging), and everyone gets a result they can recount. The counting engine is the same one that replays real government elections from their published ballots and reproduces the certified results round by round, so a lunch poll and a mayoral primary go through identical code.

## The engine against real elections

Each replay downloads nothing from a third party at view time: the ballots were reduced to weighted ranking patterns by `scripts/datasets/`, pinned by SHA-256, and the official round-by-round report was transcribed next to them. The engine counts the ballots and compares every figure.

| Election | Ballots | Rounds | Figures that match |
|---|---:|---:|---|
| New York City 2025 Democratic primary for Mayor | 1,114,433 | 3 | 28 of 28, certified count |
| New York City 2026 Democratic primary, Council District 3 | 19,434 | 3 | 14 of 14, certified count |
| Minneapolis 2025 Mayor | 147,702 | 2 | 36 of 36, the city's published round results |
| Minneapolis 2025 Park Board at large (3 seats) | 147,702 | 5 | 50 of 50, the city's published round results |
| Minneapolis 2025 Board of Estimate and Taxation (2 seats) | 147,702 | 1 | 5 of 5, the city's published round results |
| Portland, OR 2024 City Council District 1 (3 seats) | 43,669 | 17 | 159 of 159, certified count |
| Burlington, VT 2009 Mayor | 8,984 | 3 | 17 of 19, within 1 vote |
| Alaska 2022 special general, U.S. Representative | 192,289 | 2 | 3 of 6, within 18 votes |

Burlington and Alaska are counted from FairVote's copy of the ballots, because the original files are no longer published; the pages show exactly which cells differ and by how much. Both are also the textbook cases where the ranked-choice winner is not the Condorcet winner, and the replay pages explain it.

Rules follow RCTab, the open-source tabulator U.S. jurisdictions certify, down to its option names: overvote handling, skipped and repeated rankings, batch elimination, fractional surplus transfers at four decimal places with truncation, RCTab's seeded tiebreaks (a port of `java.util.Random`), and the extra round RCTab reports after the seats fill. The engine passes 38 of RCTab's own rules fixtures field for field.

## Every result is recountable

When a poll closes it publishes three things anyone can fetch:

- the cast-vote record as CSV, one row per ballot, ordered by receipt so a row can't be matched to the time someone voted, with its SHA-256;
- the round-by-round summary in RCTab's JSON format;
- a "Recount in your browser" button that downloads the CSV, hashes it, counts it with the poll's rules in a Web Worker and says whether the winner, the rounds and every tally match what the page published.

Voters get a receipt (`xxxx-xxxx-xxxx`) and can look their ballot up afterwards, exactly as it was counted.

## Tests that run themselves

| Layer | What it checks | Where |
|---|---|---|
| Engine | 131 tests: unit, fast-check properties (ballot conservation, order and id independence, scale invariance), RCTab conformance, certified replays | `packages/engine/test` |
| Services | 402 tests on an in-memory Postgres (PGlite): authorisation, visibility, schedules across time zones and daylight saving, invite codes, receipts, rate limits, CVR hashing | `apps/web/test` |
| Browser | 138 Playwright tests against a production build with a seeded Postgres | `apps/web/e2e` |
| Preflight | Every route of a preview deployment answers with the right status and copy, before anything slower runs | `e2e/preflight.spec.ts`, `.github/workflows/preflight.yml` |
| TestSprite | 24 scenarios on the live app (voters, organisers, an intruder, time zones, the replays, the audit trail), plus 6 TestSprite proposed from its own exploration | `testsprite/` |

The TestSprite scenarios are kept in the repository as plan files (`testsprite/plans/`), each decided by one or two sentences the app renders word for word. Their first run against the live site passed 23 of 24. The one it blocked was right to: a click on "Recount in your browser" before the page's script had loaded did nothing, and the test's assertion couldn't tell the browser's recount from the build-time comparison printed above it. Both were fixed (`9099685`), and all 24 pass. With a bug planted on a preview (a wizard that stops explaining a skipped opening time), the suite failed on exactly that scenario and passed again on the fixed code.

`TestSprite V3` is a required check on `main`, together with `ci` and `preflight`. [Pull request #1](https://github.com/RaYYeR220/recount/pull/1) shows the gate holding a real regression:
- **Red, merge blocked.** A refactor dropped the opening-time warning, so T13 failed. TestSprite also blocked on a second, unplanned problem: a recount click before hydration was lost.
- **Green, merged.** Both were fixed, and all 30 tests passed on the pull request's preview.

[`testsprite/RUNS.md`](testsprite/RUNS.md) lists every run worth keeping.

### The saboteur

A test suite that never fails proves little, so `mutants/` holds realistic bugs, one patch each, and `.github/workflows/saboteur.yml` plants one on a fresh branch and opens a pull request without saying what it is. `saboteur-verdict.yml` waits for the gates, comments which one caught it and closes the pull request; [`/quality`](https://recount-kappa.vercel.app/quality) publishes the table. A comment-only control (`m00-noop`) has to pass every gate.

Two mutants got through when first planted, and stay listed as survivors with the test that now catches them:

- `m06-cvr-row-order`: ordering the cast-vote record by cast time kept every test green, and would let anyone who saw a voter vote find their row (`a24402d`).
- `m09-tie-by-list-order`: settling a tie at the last seat by candidate order. The property test that should catch it reaches such a tie about once in 2,500 cases and CI ran 200; the case is now always checked (`1185526`).

Run through the live gates on Oct 25:
- **All seven engine and service mutants were caught by `ci`:** #3, #10 to #15.
- **The page mutant `m02` was caught twice in #17.** Playwright failed in `ci`, and TestSprite failed T13.
- **The comment-only control went green on all three gates** in #8.

The control runs before #8 turned up real problems, and each was fixed:
- **#4 and #6 broke our own CI.** The control's comment sat next to the line `m05` rewrites, and CI's patch check tried to apply the planted mutant a second time. Both fixed in #5 and #7.
- **A pasted link broke.** TestSprite's browser opened `/p/board-2026;` with a stray semicolon and got the not-found page. Links pasted with trailing punctuation now redirect to the clean address (#5).
- **TestSprite never ran on #9.** Its branch name made the Vercel preview alias longer than 63 characters, so TestSprite couldn't find the preview. Saboteur branches are shorter now (#16).

## API

A JSON API serves the same counts (`/api/v1/openapi.json`, documented at [`/developers`](https://recount-kappa.vercel.app/developers)): `POST /api/v1/tabulate` counts ballots you send without storing them, the replay library and poll results are public reads, and organisers create and close polls with `rk_` tokens from Settings.

```sh
curl -s https://recount-kappa.vercel.app/api/v1/tabulate -H 'content-type: application/json' -d '{
  "candidates": ["Pizza", "Tacos", "Sushi"],
  "ballots": [{ "ranking": ["Pizza", "Tacos"], "count": 6 }, { "ranking": ["Tacos"], "count": 4 }, { "ranking": ["Sushi", "Tacos"], "count": 3 }]
}'
```

## Run it locally

```sh
pnpm install
docker compose up -d                  # Postgres behind the Neon WebSocket proxy
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @recount/web db:migrate
pnpm --filter @recount/web db:seed    # the demo organisers and showcase polls
pnpm --filter @recount/web dev
```

`pnpm test` runs the engine and service suites. `pnpm --filter @recount/web test:e2e` runs the Playwright suite against `next start` when there is a production build (`pnpm --filter @recount/web build`) and against `next dev` otherwise.

## Layout

```
packages/engine   the counting engine: IRV and STV, RCTab rules, presets, pairwise analysis
apps/web          Next.js app: pages, API, services (src/server), Playwright suite (e2e)
scripts/datasets  rebuild the replay datasets from the official files
mutants           planted bugs for the saboteur
testsprite        the TestSprite suite as plan files
```

## Limits worth knowing

- One ballot per browser in link-mode polls is honour-system: a voter cookie, not identity. Polls that need one vote per person use invite codes.
- Signing up with an email that already has an account says so. It's a small account-enumeration leak, accepted to keep sign-up understandable.
- Minneapolis publishes its round results as unofficial reports; those replays say "the city's published round results", never "certified".

## Data and licences

Ballots come from each jurisdiction's public cast-vote records (NYC Board of Elections, City of Minneapolis, Multnomah County) and from FairVote's normalised copies via Harvard Dataverse (CC0) for Burlington and Alaska. RCTab's test fixtures are vendored under the MPL-2.0 (`packages/engine/test/rctab/fixtures`). Clash Display (Indian Type Foundry, Fontshare) is downloaded at build time rather than kept in the repository, as its licence asks. Everything else is MIT.

Recount is not affiliated with any election office.
