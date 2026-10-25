from decimal import Decimal

import requests

BASE = "https://recount-kappa.vercel.app/api/v1"


def test_nyc_2025_replay_matches_all_28_certified_figures():
    r = requests.get(f"{BASE}/elections/nyc-2025-dem-mayor", timeout=60)
    assert r.status_code == 200
    replay = r.json()
    assert replay["comparison"] == {"cells": 28, "mismatches": [], "matches": True}
    assert replay["totalBallots"] == 1114433
    assert replay["winners"] == ["Zohran Kwame Mamdani"]
    assert replay["golden"]["sourceUrl"].startswith("https://www.vote.nyc/")

    rounds = replay["rounds"]
    assert len(rounds) == 3
    assert rounds[0]["tally"]["Zohran Kwame Mamdani"] == "469642"
    assert rounds[0]["tally"]["Andrew M. Cuomo"] == "387137"
    for rnd in rounds:
        assert sum(Decimal(v) for v in rnd["tally"].values()) == Decimal(rnd["activeTotal"]), rnd["round"]

    final = rounds[-1]["tally"]
    assert final == {"Zohran Kwame Mamdani": "573169", "Andrew M. Cuomo": "443229"}
    assert Decimal(final["Zohran Kwame Mamdani"]) * 2 > Decimal(rounds[-1]["activeTotal"])


test_nyc_2025_replay_matches_all_28_certified_figures()
