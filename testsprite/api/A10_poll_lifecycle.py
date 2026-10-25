import hashlib

import requests

BASE = "https://recount-kappa.vercel.app/api/v1"
AUTH = {**__AUTH_HEADERS__}


def test_an_organiser_creates_and_closes_a_poll_with_a_token():
    created = requests.post(
        f"{BASE}/polls",
        headers=AUTH,
        json={
            "title": "API suite: closing time",
            "options": ["Tea", "Coffee", "Water"],
            "seats": 1,
            "presetId": "recount-standard",
            "maxRanks": None,
            "accessMode": "link",
            "resultsVisibility": "after_close",
            "timeZone": "Europe/Warsaw",
            "opensAtLocal": None,
            "closesAtLocal": None,
        },
        timeout=30,
    )
    assert created.status_code == 201, created.text
    poll = created.json()
    slug = poll["slug"]
    try:
        assert created.headers["location"] == f"/api/v1/polls/{slug}"
        assert poll["status"] == "open"
        assert poll["ballotCount"] == 0
        assert [o["label"] for o in poll["options"]] == ["Tea", "Coffee", "Water"]
        assert "id" not in poll and "ownerId" not in poll

        assert requests.get(f"{BASE}/polls/{slug}", timeout=30).json()["status"] == "open"
        hidden = requests.get(f"{BASE}/polls/{slug}/results", timeout=30)
        assert (hidden.status_code, hidden.json()["error"]["code"]) == (403, "hidden_until_close")
        owner = requests.get(f"{BASE}/polls/{slug}/results", headers=AUTH, timeout=30)
        assert owner.status_code == 200
        assert owner.json()["totalBallots"] == 0
        locked = requests.get(f"{BASE}/polls/{slug}/cvr", timeout=30)
        assert (locked.status_code, locked.json()["error"]["code"]) == (423, "cvr_not_published")
        anonymous_close = requests.post(f"{BASE}/polls/{slug}/close", timeout=30)
        assert anonymous_close.status_code == 401

        closed = requests.post(f"{BASE}/polls/{slug}/close", headers=AUTH, timeout=30)
        assert closed.status_code == 200
        closed_at = closed.json()["closedEarlyAt"]
        assert closed.json()["status"] == "closed" and closed_at
        again = requests.post(f"{BASE}/polls/{slug}/close", headers=AUTH, timeout=30)
        assert again.status_code == 200
        assert again.json()["closedEarlyAt"] == closed_at

        results = requests.get(f"{BASE}/polls/{slug}/results", timeout=30)
        assert results.status_code == 200
        assert results.json()["status"] == "closed"
        csv = requests.get(f"{BASE}/polls/{slug}/cvr?format=csv", timeout=30)
        assert csv.status_code == 200
        assert csv.content.decode("utf-8").splitlines() == ["Rank 1,Rank 2,Rank 3"]
        digest = hashlib.sha256(csv.content).hexdigest()
        assert digest == csv.headers["x-cvr-sha256"] == results.json()["cvrSha256"]
    finally:
        requests.post(f"{BASE}/polls/{slug}/close", headers=AUTH, timeout=30)


test_an_organiser_creates_and_closes_a_poll_with_a_token()
