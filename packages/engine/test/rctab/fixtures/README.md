# RCTab rules fixtures

These files come from [RCTab](https://github.com/BrightSpots/rcv), the open-source
ranked-choice tabulator, at commit `9f75b3420afb411a6c22b676e61a887098d62370`
(branch `develop`, 2026-07-09), directory
`src/test/resources/network/brightspots/rcv/test_data/`.

They are licensed under the Mozilla Public License 2.0, see
[`LICENSE-MPL-2.0.html`](./LICENSE-MPL-2.0.html). They stay under MPL-2.0; the rest of
this repository is MIT.

Each fixture keeps three kinds of file, unmodified: `<stem>_config.json`, the CVR
(`*_cvr.json` in NIST CDF or `*_cvr.xlsx` in ES&S layout) and
`<stem>_expected_detailed_report.json`. RCTab's CSV reports and CDF conversion outputs
are not copied.

One file is not a verbatim copy: `_shared/2013_minneapolis_park_cvr.patterns.json.gz`
replaces RCTab's 2 MB `_shared/2013_minneapolis_park_cvr.xlsx`. It holds the ballots
that spreadsheet parses to (1,238 distinct rankings), written by
`../packCvr.ts` from the `2013_minneapolis_park` config, plus the SHA-256 of the original
spreadsheet.

These are RCTab's own regression outputs, not certified election results: the
`2018_maine_governor_primary` golden in the same RCTab suite differs from the Maine
Secretary of State's report by 3 votes.

## Fixtures

Rules (CDF): `test_set_0_skipped_first_choice` to `test_set_8_multi_cdf`,
`test_set_multi_winner_fractional_threshold`, `test_set_multi_winner_whole_threshold`,
`aliases_cdf_json`.

Rules (ES&S): `test_set_allow_only_one_winner_per_round`, `test_set_overvote_delimiter`,
`test_set_treat_images_as_undeclared_write_in`, `exhaust_if_multiple_continuing`,
`skip_to_next_test`, `duplicate_test`, `excluded_test`, `aliases_ess_xlsx`,
`ess_multi_contest`, `more_winners_than_candidates`, `minneapolis_multi_seat_threshold`,
`multi_seat_uwi_test`, `uwi_cannot_win_test`.

Tiebreaks: `tiebreak_seed_test`, `tiebreak_use_permutation_in_config_test`,
`tiebreak_generate_permutation_test`, `tiebreak_previous_round_counts_then_random_test`,
`first_round_determines_threshold_tiebreaker_test`.

Counting through to two candidates and threshold rules:
`continue_until_two_with_batch_elimination_test`, `continue_until_two_threshold_freeze`,
`continue_tabulation_test`, `first_round_determines_threshold_test`.

Elections: `2013_minneapolis_park`, `2013_minneapolis_park_hare`, `2015_portland_mayor`,
`2015_portland_mayor_codes`.

All 38 reproduce RCTab's detailed report exactly (every string, ignoring
`generatedBy`). None are currently listed as known divergent.
