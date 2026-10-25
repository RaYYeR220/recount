# Runs worth keeping

Full-suite runs, with what each one showed. The ids open in the TestSprite portal under project `09e3cdbd-0340-48af-95ac-2789db1a41fd`.

## 2026-10-21 00:35 CEST: first run against the live site — 23 of 24

Execution `3300a8af-6b1c-4c04-8f6f-b1253786b107`, target https://recount-kappa.vercel.app.

T03 (Portland's browser recount) came back **blocked**: TestSprite could not activate "Recount in your browser", and noted that the page already showed "159 of 159 figures match the official count" before any click, so it couldn't tell whether a recount had happened.

Both halves were right. A click on the button before the page's script had loaded was silently lost, which our own Playwright tests never hit because they wait for the page to settle; and the assertion matched the build-time comparison printed higher up the page. `9099685` keeps the button disabled until the script runs and points T03 at the line only the browser's recount writes. Rerun `0e255194-fb1b-49b4-9659-c4a1799639ca`: passed.

## 2026-10-22 14:07 CEST: a planted bug on a preview — 23 of 24

Execution `5b1f5fec-9600-4bb9-8cd0-e9bd99a5f70d`, target the preview of `demo/m02-dst-warning-dropped` (`mutants/m02-dst-warning-dropped`): the schedule step only explains daylight-saving problems with the closing time.

Exactly one test failed, **T13**, with: "the UI shows the adjusted opening time but omits the required daylight-saving warning." (Its guess at the cause, a server-side time-zone conversion, was wrong; the bug is a filter in the page. The verdict was right.)

## 2026-10-22 14:12 CEST: the same suite on the fixed code — 24 of 24

Execution `71e653f6-f024-470a-995d-9fa8e64f1ff5`, target a preview of `main` at `32322eb`.

## 2026-10-25: pull request #1 held by the merge gate, then released

[Pull request #1](https://github.com/RaYYeR220/recount/pull/1) moved each daylight-saving warning in the new-poll wizard under the field it explains. The TestSprite GitHub App runs all 30 tests against the pull request's Vercel preview once `preflight` passes, and `TestSprite V3` is a required check on `main`.

- **59ef0ac: red, merge blocked.** Execution `2ed35de3-7a7e-4e66-ab48-e753a1b09194`, 28 of 30.
  - **T13 failed.** The move left the Opens field without its warning: "The schedule page did not show the requested daylight-saving warning. It displayed the opening as 3:30 AM EDT instead."
  - **T03 was blocked.** TestSprite's browser clicked "Recount in your browser" before the page's script had loaded, and the click was lost. Our Playwright tests never hit this because they wait for the page to settle.
  - CI failed the same pull request on Playwright's two daylight-saving cases.
- **f65d148: green, merged.** Execution `a1f2fc2d-6276-44fe-9bf7-b7d88ef91782`, all 30.
  - The opening-time warning is back under Opens.
  - Mutant m02 follows it to the new layout.
  - The recount button is now a form, so a click before the script loads still starts the recount.

## API suite (Oct 25)

- **Production: 12 of 12 passed.** Execution `591a9739-c1ad-475f-8187-33cb5943a687`.
  - A12 failed once before running: TestSprite's validator rejected the path template `/polls/{slug}` as an unsubstituted URL. Rewritten with `<slug>`, it passes.
- **`m07-round-not-truncate` on a throwaway preview: 11 of 12, A05 failed.** Execution `77c6e40d-fd8a-4321-a6fd-9d5d7f530b04`.
  - Ana's surplus moved to Ben as 4.6669 instead of 4.6662.
- **`m08-nyc-no-batch` on a throwaway preview: 10 of 12, A02 and A03 failed.** Execution `dd95e8ba-d8a1-4bac-924b-c7479792cf12`.
  - New York City's replay still named Mamdani but took 11 rounds, and 3 of its 28 figures no longer matched.

The mutant runs used copies of the twelve files with the preview's address in place of production's, in their own TestSprite projects.
