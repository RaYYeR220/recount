import requests

BASE = "https://recount-kappa.vercel.app/api/v1"
VALID = {
    "title": "API suite: never created",
    "options": ["Tea", "Coffee", "Water"],
    "seats": 1,
    "presetId": "recount-standard",
    "maxRanks": None,
    "accessMode": "link",
    "resultsVisibility": "live",
    "timeZone": "Europe/Warsaw",
    "opensAtLocal": None,
    "closesAtLocal": None,
}


def issues_of(r):
    assert r.status_code == 422, r.text
    assert r.json()["error"]["code"] == "validation"
    return {(i["path"], i["message"]) for i in r.json()["error"]["details"]["issues"]}


def create(**changes):
    return requests.post(f"{BASE}/polls", headers={**__AUTH_HEADERS__}, json={**VALID, **changes}, timeout=30)


def test_creating_a_poll_needs_a_token():
    r = requests.post(f"{BASE}/polls", json=VALID, timeout=30)
    assert (r.status_code, r.json()["error"]["code"]) == (401, "unauthorized")


def test_a_bad_poll_is_refused_field_by_field():
    # A CVR is opened in spreadsheets, which run a cell starting with = as a formula.
    formula = issues_of(create(options=["=HYPERLINK(1)", "Tea"]))
    assert ("options.0", "Start the name with something other than =, +, - or @") in formula
    both = issues_of(create(presetId="portland-stv", seats=3, timeZone="Mars/Olympus"))
    assert ("timeZone", "Unknown time zone") in both
    assert ("seats", "There must be more options than seats") in both
    assert any(path == "title" for path, _ in issues_of(create(title="ab")))
    assert any(path == "opensAtLocal" for path, _ in issues_of(create(opensAtLocal="tomorrow")))


test_creating_a_poll_needs_a_token()
test_a_bad_poll_is_refused_field_by_field()
