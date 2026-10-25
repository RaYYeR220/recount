import requests

BASE = "https://recount-kappa.vercel.app/api/v1"


def test_every_replay_is_compared_with_its_official_report():
    slugs = [e["slug"] for e in requests.get(f"{BASE}/elections", timeout=30).json()]
    cells = mismatched = exact = 0
    inexact = set()
    for slug in slugs:
        r = requests.get(f"{BASE}/elections/{slug}", timeout=60)
        assert r.status_code == 200, slug
        comparison = r.json()["comparison"]
        cells += comparison["cells"]
        mismatched += len(comparison["mismatches"])
        assert comparison["matches"] == (comparison["mismatches"] == []), slug
        if comparison["matches"]:
            exact += 1
        else:
            inexact.add(slug)
        for m in comparison["mismatches"]:
            assert {"round", "candidate", "expected", "actual"} <= set(m), slug
            assert m["expected"] != m["actual"], slug
            assert abs(int(m["expected"]) - int(m["actual"])) <= 18, (slug, m)

    assert (cells - mismatched, cells) == (312, 317)
    assert exact == 6
    assert inexact == {"burlington-2009-mayor", "alaska-2022-special"}


test_every_replay_is_compared_with_its_official_report()
