import json
import urllib.request
import urllib.error
from datetime import date

BASE = "http://127.0.0.1:8000"
TEST_SOURCE = "NAN_TEST_SOURCE"
TEST_DAY = date.today().isoformat()


def http_json(method: str, path: str, payload: dict | None = None):
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(BASE + path, method=method, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(body) if body else {}
        except Exception:
            parsed = {"raw": body}
        return e.code, parsed


def main():
    # Insert one actual spend row for a source that has no leads
    spend_payload = {
        "date": TEST_DAY,
        "source": TEST_SOURCE,
        "campaign": "NanSmoke",
        "spend": 123.45,
        "note": "smoke-nan",
    }
    s_code, s_data = http_json("POST", "/api/spend/manual", spend_payload)
    if s_code not in (200, 201):
        raise SystemExit(f"FAIL: cannot create spend row: status={s_code} body={s_data}")

    # Restrict to today so likely no leads for this unique source
    q = f"/api/kpi/spend/summary?from={TEST_DAY}&to={TEST_DAY}&mode=actual"
    code, data = http_json("GET", q)

    if code != 200:
        raise SystemExit(f"FAIL: summary returned status={code}, body={data}")

    rows = data.get("cpl_by_source", [])
    target = next((r for r in rows if r.get("source") == TEST_SOURCE), None)
    if target is None:
        raise SystemExit(f"FAIL: source {TEST_SOURCE} not found in cpl_by_source: {rows}")

    cpl = target.get("cpl")
    if cpl is not None:
        raise SystemExit(f"FAIL: expected cpl=null for zero leads, got {cpl}")

    print("PASS: /api/kpi/spend/summary returned 200 and cpl=null for zero-lead source")


if __name__ == "__main__":
    main()
