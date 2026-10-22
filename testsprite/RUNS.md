# Runs worth keeping

Full-suite runs of the 24 scenarios, with what each one showed. The ids open in the TestSprite portal under project `09e3cdbd-0340-48af-95ac-2789db1a41fd`.

## 2026-10-21 00:35 CEST: first run against the live site — 23 of 24

Execution `3300a8af-6b1c-4c04-8f6f-b1253786b107`, target https://recount-kappa.vercel.app.

T03 (Portland's browser recount) came back **blocked**: TestSprite could not activate "Recount in your browser", and noted that the page already showed "159 of 159 figures match the official count" before any click, so it couldn't tell whether a recount had happened.

Both halves were right. A click on the button before the page's script had loaded was silently lost, which our own Playwright tests never hit because they wait for the page to settle; and the assertion matched the build-time comparison printed higher up the page. `9099685` keeps the button disabled until the script runs and points T03 at the line only the browser's recount writes. Rerun `0e255194-fb1b-49b4-9659-c4a1799639ca`: passed.

## 2026-10-22 14:07 CEST: a planted bug on a preview — 23 of 24

Execution `5b1f5fec-9600-4bb9-8cd0-e9bd99a5f70d`, target the preview of `demo/m02-dst-warning-dropped` (`mutants/m02-dst-warning-dropped`): the schedule step only explains daylight-saving problems with the closing time.

Exactly one test failed, **T13**, with: "the UI shows the adjusted opening time but omits the required daylight-saving warning." (Its guess at the cause, a server-side time-zone conversion, was wrong; the bug is a filter in the page. The verdict was right.)

## 2026-10-22 14:12 CEST: the same suite on the fixed code — 24 of 24

Execution `71e653f6-f024-470a-995d-9fa8e64f1ff5`, target a preview of `main` at `32322eb`.
