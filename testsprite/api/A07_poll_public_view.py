import requests

BASE = "https://recount-kappa.vercel.app/api/v1"


def test_a_poll_reads_publicly_without_internal_ids():
    r = requests.get(f"{BASE}/polls/lunch-closed", timeout=30)
    assert r.status_code == 200
    poll = r.json()
    assert poll["slug"] == "lunch-closed"
    assert poll["status"] == "closed"
    assert [o["label"] for o in poll["options"]] == ["Pizza", "Tacos", "Sushi"]
    assert "id" not in poll and "ownerId" not in poll
    assert "ballotCount" not in poll


def test_unknown_and_malformed_slugs_are_a_plain_404():
    for slug in ["no-such-poll", "Lunch-Closed", "lunch-closed%3B", "x" * 70, "..%2F..%2Fetc"]:
        r = requests.get(f"{BASE}/polls/{slug}", timeout=30)
        assert r.status_code == 404, slug
        assert r.json() == {"error": {"code": "not_found", "message": "Not found"}}, slug


test_a_poll_reads_publicly_without_internal_ids()
test_unknown_and_malformed_slugs_are_a_plain_404()
