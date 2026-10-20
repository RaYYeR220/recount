# Election datasets

Rebuilds `apps/web/public/elections/` from the official cast vote records:

```sh
pnpm datasets:build --download               # fetch the raw files into ./data-raw, then build
pnpm datasets:build --raw /path/to/raw       # build from files you already have
pnpm datasets:build --only portland-2024-d1
```

Each dataset is the contest's ballots collapsed into weighted ranking patterns
(`ElectionDataset` in `@recount/engine`), written as `<slug>.json`, or `<slug>.json.gz`
when larger than 100 KB. `manifest.json` records the source URL and SHA-256 of every raw
file and of every output. Raw files are never committed.

`goldens/` holds the round-by-round numbers transcribed from each official report, with
the report's URL and SHA-256. The build copies them next to the datasets and prints how
many cells the engine reproduces; `packages/engine/test/certified/replay.test.ts` holds
the same check in CI.

| Dataset | Raw file | Official report |
| --- | --- | --- |
| `nyc-2025-dem-mayor` | NYC BOE CVR export (ES&S xlsx, 90 MB zip) | BOE certified RCV rounds (HTML) |
| `nyc-2026-council-d3` | NYC BOE CVR export | BOE certified RCV rounds (PDF) |
| `minneapolis-2025-mayor` | City of Minneapolis aggregated CVR (CSV) | Tabulation summary statement (PDF) |
| `minneapolis-2025-park-at-large` | City of Minneapolis aggregated CVR | Tabulation summary statement (PDF) |
| `minneapolis-2025-bet` | City of Minneapolis aggregated CVR | Tabulation summary statement (PDF) |
| `portland-2024-d1` | Multnomah County Clear Ballot CVR (CSV, 104 MB) | Official RCTab summary JSON |
| `burlington-2009-mayor` | FairVote normalised CVR (CC0) | City's ChoicePlus Pro round report (Internet Archive) |
| `alaska-2022-special` | FairVote normalised CVR (CC0) | Division of Elections RCV report, via a published transcription |

The last two are not exact: FairVote's copies are derived files, not the jurisdictions'
own ballot exports. The replay test pins how many cells differ.
