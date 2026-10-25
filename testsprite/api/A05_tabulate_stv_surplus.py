from decimal import Decimal

import requests

BASE = "https://recount-kappa.vercel.app/api/v1"

# 23 ballots, 2 seats: the Droop quota is 23 // 3 + 1 = 8. Ana's 12 votes carry a
# surplus of 4, so each of her ballots moves on at 4 / 12 = 0.3333 (truncated to
# four decimals): 9 ballots give Ben 2.9997, 3 give Cleo 0.9999, and 0.0004 is lost.
BOARD = {
    "contest": "Board",
    "candidates": ["Ana", "Ben", "Cleo", "Dev"],
    "seats": 2,
    "presetId": "portland-stv",
    "ballots": [
        {"ranking": ["Ana", "Ben"], "count": 9},
        {"ranking": ["Ana", "Cleo"], "count": 3},
        {"ranking": ["Ben"], "count": 4},
        {"ranking": ["Cleo", "Dev"], "count": 5},
        {"ranking": ["Dev", "Cleo"], "count": 2},
    ],
}

# 15 ballots, 3 seats: the quota is 15 // 4 + 1 = 4 and Ana's surplus is 8 of 12, so
# her ballots move on at 0.6666. Rounding instead of truncating would give 0.6667.
COMMITTEE = {
    "contest": "Committee",
    "candidates": ["Ana", "Ben", "Cleo", "Dev"],
    "seats": 3,
    "presetId": "portland-stv",
    "ballots": [
        {"ranking": ["Ana", "Ben"], "count": 7},
        {"ranking": ["Ana", "Cleo"], "count": 5},
        {"ranking": ["Ben"], "count": 1},
        {"ranking": ["Cleo", "Dev"], "count": 1},
        {"ranking": ["Dev"], "count": 1},
    ],
}


def test_stv_moves_a_surplus_at_four_decimals_and_accounts_for_every_vote():
    r = requests.post(f"{BASE}/tabulate", json=BOARD, timeout=30)
    assert r.status_code == 200
    count = r.json()
    assert count["winners"] == ["Ana", "Cleo"]

    first = count["rounds"][0]
    assert first["threshold"] == "8"
    assert first["elected"] == ["Ana"]
    assert first["transfers"] == [
        {"from": "Ana", "to": {"Ben": "2.9997", "Cleo": "0.9999", "residualSurplus": "0.0004"}}
    ]
    assert count["rounds"][1]["tally"] == {"Ana": "8", "Ben": "6.9997", "Cleo": "5.9999", "Dev": "2"}

    for rnd in count["rounds"]:
        held = Decimal(rnd["activeTotal"]) + Decimal(rnd["residualSurplus"])
        held += sum(Decimal(v) for v in rnd["inactive"].values())
        assert held == 23, rnd["round"]
        for value in rnd["tally"].values():
            assert len(value.partition(".")[2]) <= 4, rnd["round"]


def test_stv_truncates_the_transfer_value_instead_of_rounding_it():
    r = requests.post(f"{BASE}/tabulate", json=COMMITTEE, timeout=30)
    assert r.status_code == 200
    count = r.json()
    first = count["rounds"][0]
    assert first["threshold"] == "4"
    assert first["transfers"] == [
        {"from": "Ana", "to": {"Ben": "4.6662", "Cleo": "3.3330", "residualSurplus": "0.0008"}}
    ]
    assert count["winners"] == ["Ana", "Ben", "Cleo"]


test_stv_moves_a_surplus_at_four_decimals_and_accounts_for_every_vote()
test_stv_truncates_the_transfer_value_instead_of_rounding_it()
