import re

import requests

BASE = "https://recount-kappa.vercel.app/api/v1"


def test_replay_library_lists_eight_sourced_elections():
    r = requests.get(f"{BASE}/elections", timeout=30)
    assert r.status_code == 200
    assert r.headers["cache-control"].startswith("public")
    elections = r.json()
    assert len(elections) == 8
    slugs = [e["slug"] for e in elections]
    assert len(set(slugs)) == 8
    assert {"nyc-2025-dem-mayor", "portland-2024-d1", "burlington-2009-mayor", "alaska-2022-special"} <= set(slugs)
    for e in elections:
        assert re.fullmatch(r"[0-9a-f]{64}", e["sha256"]), e["slug"]
        assert e["ballots"] > 0, e["slug"]
        assert e["source"]["publisher"], e["slug"]
        assert e["source"]["url"].startswith("https://"), e["slug"]


test_replay_library_lists_eight_sourced_elections()
