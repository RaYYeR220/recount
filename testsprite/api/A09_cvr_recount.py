import hashlib
from collections import Counter

import requests

BASE = "https://recount-kappa.vercel.app/api/v1"


def test_the_published_cvr_counts_again_to_the_published_result():
    poll = requests.get(f"{BASE}/polls/lunch-closed", timeout=30).json()
    results = requests.get(f"{BASE}/polls/lunch-closed/results", timeout=30).json()
    record = requests.get(f"{BASE}/polls/lunch-closed/cvr", timeout=30).json()
    csv = requests.get(f"{BASE}/polls/lunch-closed/cvr?format=csv", timeout=30)
    assert csv.status_code == 200
    assert csv.headers["content-type"].startswith("text/csv")

    digest = hashlib.sha256(csv.content).hexdigest()
    assert digest == csv.headers["x-cvr-sha256"] == record["sha256"] == results["cvrSha256"]
    assert csv.content.decode("utf-8").splitlines()[0] == ",".join(record["header"])
    assert len(record["rows"]) == results["totalBallots"] == 13

    patterns = Counter(tuple(row) for row in record["rows"])
    rules = {k: v for k, v in results["rules"].items() if k != "numberOfWinners"}
    recount = requests.post(
        f"{BASE}/tabulate",
        json={
            "candidates": results["candidates"],
            "ballots": [{"ranking": list(ranking), "count": n} for ranking, n in patterns.items()],
            "presetId": poll["presetId"],
            "seats": poll["seats"],
            "rules": rules,
        },
        timeout=30,
    )
    assert recount.status_code == 200, recount.text
    again = recount.json()
    assert again["winners"] == results["winners"] == ["Tacos"]
    assert len(again["rounds"]) == len(results["rounds"])
    for mine, published in zip(again["rounds"], results["rounds"]):
        assert mine["tally"] == published["tally"], mine["round"]
        assert mine["elected"] == published["elected"], mine["round"]
        assert mine["eliminated"] == published["eliminated"], mine["round"]


test_the_published_cvr_counts_again_to_the_published_result()
