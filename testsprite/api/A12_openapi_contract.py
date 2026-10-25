import re

import requests

BASE = "https://recount-kappa.vercel.app/api/v1"
# Each operation the API serves, and whether it needs a token. Path parameters are
# written <slug> here; the document writes them in braces.
OPERATIONS = {
    ("post", "/polls"): True,
    ("get", "/polls/<slug>"): False,
    ("post", "/polls/<slug>/close"): True,
    ("get", "/polls/<slug>/results"): False,
    ("get", "/polls/<slug>/cvr"): False,
    ("post", "/tabulate"): False,
    ("get", "/elections"): False,
    ("get", "/elections/<slug>"): False,
}


def test_the_openapi_document_describes_what_the_api_serves():
    r = requests.get(f"{BASE}/openapi.json", timeout=30)
    assert r.status_code == 200
    spec = r.json()
    assert spec["openapi"].startswith("3.1")
    assert spec["components"]["securitySchemes"]["apiToken"]["scheme"] == "bearer"

    methods = {"get", "post", "put", "patch", "delete"}
    paths = {re.sub(r"\{(\w+)\}", r"<\1>", path): ops for path, ops in spec["paths"].items()}
    documented = {(m, path) for path, ops in paths.items() for m in ops if m in methods}
    assert documented == set(OPERATIONS)
    for (method, path), needs_token in OPERATIONS.items():
        operation = paths[path][method]
        if needs_token:
            assert operation.get("security"), (method, path)
            assert "401" in operation["responses"], (method, path)
        if "<slug>" in path:
            assert "404" in operation["responses"], (method, path)

    # Every documented operation answers as documented: a missing slug is a 404, not a 500.
    for method, path in OPERATIONS:
        url = BASE + path.replace("<slug>", "no-such-slug")
        r = requests.request(method, url, json={}, timeout=30)
        assert str(r.status_code) in paths[path][method]["responses"], (method, path, r.status_code)


test_the_openapi_document_describes_what_the_api_serves()
