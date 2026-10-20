# Mutants

Each directory is one realistic bug: `patch.diff` plants it, `meta.json` says what it breaks and which gate is expected to catch it. The saboteur workflow (`.github/workflows/saboteur.yml`) applies one to a fresh branch and opens a pull request without saying what the bug is; `saboteur-verdict.yml` waits for the gates, comments which one caught it and closes the pull request. `/quality` publishes the table.

A mutant only counts as caught when a gate fails on it. One that gets through every gate is published as a survivor, together with the test that was added afterwards (`history` in its `meta.json`).

`m00-noop` changes a comment and nothing else. Every gate must stay green on it; if one goes red, that gate is flaky or too strict, and the verdict says so.

| Mutant | Layer | Gates it meets |
|---|---|---|
| m00-noop | control | ci, preflight, TestSprite |
| m05-pagination-offset | service | ci |
| m06-cvr-row-order | service | ci |
| m07-round-not-truncate | engine | ci |
| m08-nyc-no-batch | engine | ci |
| m09-tie-by-list-order | engine | ci |
| m10-code-reuse | service | ci |
| m12-overvote-nyc-skip | engine | ci |

Mutants of the engine and the services are caught before anything deploys, so their branches skip the preview build (`apps/web/scripts/ignore-build.mjs`) and spend no TestSprite credits. Mutants in pages and components need the deployed app, so they go through all three gates.

To try one locally:

```sh
git apply mutants/m05-pagination-offset/patch.diff
pnpm test            # should fail
git apply -R mutants/m05-pagination-offset/patch.diff
```
