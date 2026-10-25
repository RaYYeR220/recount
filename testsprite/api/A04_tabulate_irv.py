from decimal import Decimal

import requests

BASE = "https://recount-kappa.vercel.app/api/v1"
LUNCH = {
    "candidates": ["Pizza", "Tacos", "Sushi"],
    "ballots": [
        {"ranking": ["Pizza", "Tacos"], "count": 6},
        {"ranking": ["Tacos"], "count": 4},
        {"ranking": ["Sushi", "Tacos"], "count": 3},
    ],
}


def test_tabulate_counts_an_instant_runoff_and_keeps_every_ballot():
    r = requests.post(f"{BASE}/tabulate", json=LUNCH, timeout=30)
    assert r.status_code == 200
    assert r.headers["cache-control"] == "no-store"
    count = r.json()
    assert count["winners"] == ["Tacos"]
    assert count["pluralityWinner"] == "Pizza"
    assert count["condorcetWinner"] == "Tacos"
    assert count["totalBallots"] == 13

    first, second = count["rounds"]
    assert first["tally"] == {"Pizza": "6", "Tacos": "4", "Sushi": "3"}
    assert first["threshold"] == "7"
    assert first["eliminated"] == ["Sushi"]
    assert first["transfers"] == [{"from": "Sushi", "to": {"Tacos": "3"}}]
    assert second["tally"] == {"Pizza": "6", "Tacos": "7"}
    assert second["elected"] == ["Tacos"]
    for rnd in count["rounds"]:
        inactive = sum(Decimal(v) for v in rnd["inactive"].values())
        assert Decimal(rnd["activeTotal"]) + inactive == 13


def test_tabulate_returns_the_same_count_in_rctab_format():
    r = requests.post(f"{BASE}/tabulate?format=rctab", json=LUNCH, timeout=30)
    assert r.status_code == 200
    summary = r.json()
    assert summary["summary"]["totalNumBallots"] == "13"
    assert summary["summary"]["numWinners"] == 1
    rounds = summary["results"]
    assert [rnd["round"] for rnd in rounds] == [1, 2]
    assert rounds[0]["tallyResults"] == [{"eliminated": "Sushi", "transfers": {"Tacos": "3"}}]
    assert rounds[1]["tallyResults"][0]["elected"] == "Tacos"
    assert rounds[1]["tally"]["Tacos"] == "7"


test_tabulate_counts_an_instant_runoff_and_keeps_every_ballot()
test_tabulate_returns_the_same_count_in_rctab_format()
