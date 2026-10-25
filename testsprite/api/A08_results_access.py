import requests

BASE = "https://recount-kappa.vercel.app/api/v1"


def error_code(r):
    return r.json()["error"]["code"]


def test_hidden_results_and_unpublished_records_are_refused():
    hidden = requests.get(f"{BASE}/polls/board-2026/results", timeout=30)
    assert (hidden.status_code, error_code(hidden)) == (403, "hidden_until_close")
    cvr = requests.get(f"{BASE}/polls/board-2026/cvr", timeout=30)
    assert (cvr.status_code, error_code(cvr)) == (423, "cvr_not_published")


def test_owner_only_results_look_like_no_poll_to_anyone_else():
    anonymous = requests.get(f"{BASE}/polls/rival-private/results", timeout=30)
    assert (anonymous.status_code, error_code(anonymous)) == (404, "not_found")
    # The suite's token belongs to an organiser who does not own this poll.
    other = requests.get(f"{BASE}/polls/rival-private/results", headers={**__AUTH_HEADERS__}, timeout=30)
    assert (other.status_code, error_code(other)) == (404, "not_found")
    close = requests.post(f"{BASE}/polls/rival-club/close", headers={**__AUTH_HEADERS__}, timeout=30)
    assert (close.status_code, error_code(close)) == (404, "not_found")


def test_a_token_that_does_not_authenticate_is_a_401():
    for header in ["Bearer rk_" + "0" * 32, "Bearer not-a-token", "Token " + "0" * 32]:
        r = requests.get(f"{BASE}/polls/lunch-closed/results", headers={"authorization": header}, timeout=30)
        assert (r.status_code, error_code(r)) == (401, "unauthorized"), header
        assert r.headers["www-authenticate"] == 'Bearer realm="recount"'
    r = requests.get(f"{BASE}/polls/lunch-closed/results", headers={**__AUTH_HEADERS__}, timeout=30)
    assert r.status_code == 200


test_hidden_results_and_unpublished_records_are_refused()
test_owner_only_results_look_like_no_poll_to_anyone_else()
test_a_token_that_does_not_authenticate_is_a_401()
