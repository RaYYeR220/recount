import requests

BASE = "https://recount-kappa.vercel.app/api/v1"


def issues_of(r):
    assert r.status_code == 422, r.text
    error = r.json()["error"]
    assert error["code"] == "validation"
    return {(i["path"], i["message"]) for i in error["details"]["issues"]}


def test_tabulate_names_the_field_that_is_wrong():
    duplicate = requests.post(f"{BASE}/tabulate", json={"candidates": ["Ana", "Ana"], "ballots": [{"ranking": ["Ana"]}]}, timeout=30)
    assert ("candidates", "Candidate names must be unique") in issues_of(duplicate)

    unknown = requests.post(f"{BASE}/tabulate", json={"candidates": ["Ana", "Ben"], "ballots": [{"ranking": ["Zed"]}]}, timeout=30)
    assert ("ballots", 'ballot ranks unknown candidate "Zed"') in issues_of(unknown)

    empty = requests.post(f"{BASE}/tabulate", json={"candidates": ["Ana", "Ben"], "ballots": []}, timeout=30)
    assert any(path == "ballots" for path, _ in issues_of(empty))

    no_seats = requests.post(f"{BASE}/tabulate", json={"candidates": ["Ana", "Ben"], "ballots": [{"ranking": ["Ana"]}], "seats": 0}, timeout=30)
    assert any(path == "seats" for path, _ in issues_of(no_seats))

    not_json = requests.post(f"{BASE}/tabulate", data="not json", headers={"content-type": "application/json"}, timeout=30)
    assert ("", "The request body must be JSON") in issues_of(not_json)


def test_tabulate_refuses_a_body_over_one_megabyte():
    names = ["Candidate %d" % i for i in range(150)]
    ballot = {"ranking": names, "count": 1}
    body = {"candidates": names, "ballots": [ballot] * 600}
    r = requests.post(f"{BASE}/tabulate", json=body, timeout=60)
    assert r.status_code == 413
    assert r.json()["error"]["code"] == "payload_too_large"


test_tabulate_names_the_field_that_is_wrong()
test_tabulate_refuses_a_body_over_one_megabyte()
