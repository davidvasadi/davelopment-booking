"""
Lekéri a davelopment.hu GA4 property valós adatait a Google Analytics
Data API-n (sessions forrás/csatorna szerint, event-számok, landing
page-ek) — ugyanaz a minta, mint a Search Console report.py: csak a
stdlibet + python-dotenv-et használja, a refresh tokenből egy sima
urllib POST-tal kér access tokent, utána simán hívja a REST API-t.

Ez NEM egy élő weboldal-funkció, nincs cronba téve — eseti/audit
futtatásra való, amikor meg kell nézni, mi történik valójában a GA4-ben
(pl. "70 Google Ads kattintás, 0 konverzió" kérdés mögött).

Használat:
    python3 report.py                        # alapértelmezett: utolsó 28 nap, forrás/csatorna bontás
    python3 report.py --days 90
    python3 report.py --events               # event-nevek és darabszámuk (generate_lead stb.)
    python3 report.py --landing-pages        # mely landing page-ekre jön a Google Ads forgalom
    python3 report.py --ads-only              # csak google/cpc forrású session-ök
"""

import argparse
import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, timedelta

from dotenv import load_dotenv

load_dotenv()

TOKEN_URL = "https://oauth2.googleapis.com/token"
API_BASE = "https://analyticsdata.googleapis.com/v1beta"


def get_access_token() -> str:
    client_id = os.environ["GOOGLE_CLIENT_ID"]
    client_secret = os.environ["GOOGLE_CLIENT_SECRET"]
    refresh_token = os.environ["GOOGLE_ANALYTICS_REFRESH_TOKEN"]

    data = urllib.parse.urlencode({
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }).encode()

    req = urllib.request.Request(TOKEN_URL, data=data, method="POST")
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())["access_token"]


def run_report(token: str, property_id: str, body: dict) -> dict:
    req = urllib.request.Request(
        f"{API_BASE}/properties/{property_id}:runReport",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()}")
        raise


def date_range(days: int) -> dict:
    end = datetime.today().date()
    start = end - timedelta(days=days)
    return {"startDate": start.isoformat(), "endDate": end.isoformat()}


def print_rows(report: dict, dim_names, metric_names):
    rows = report.get("rows", [])
    if not rows:
        print("  (nincs adat ebben az időszakban)")
        return
    for row in rows:
        dims = [d["value"] for d in row.get("dimensionValues", [])]
        metrics = [m["value"] for m in row.get("metricValues", [])]
        dim_str = " / ".join(f"{n}={v}" for n, v in zip(dim_names, dims))
        metric_str = ", ".join(f"{n}={v}" for n, v in zip(metric_names, metrics))
        print(f"  {dim_str}  ->  {metric_str}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=28)
    parser.add_argument("--events", action="store_true")
    parser.add_argument("--landing-pages", action="store_true")
    parser.add_argument("--ads-only", action="store_true")
    args = parser.parse_args()

    property_id = os.environ["GA4_PROPERTY_ID"]
    token = get_access_token()
    dr = date_range(args.days)

    dim_filter = None
    if args.ads_only:
        dim_filter = {
            "filter": {
                "fieldName": "sessionSourceMedium",
                "stringFilter": {"matchType": "CONTAINS", "value": "cpc"},
            }
        }

    if args.events:
        print(f"\n=== Event-számok (utolsó {args.days} nap) ===")
        body = {
            "dateRanges": [dr],
            "dimensions": [{"name": "eventName"}],
            "metrics": [{"name": "eventCount"}],
            "orderBys": [{"metric": {"metricName": "eventCount"}, "desc": True}],
            "limit": 30,
        }
        report = run_report(token, property_id, body)
        print_rows(report, ["event"], ["count"])
        return

    if args.landing_pages:
        print(f"\n=== Landing page-ek Google Ads forgalomból (utolsó {args.days} nap) ===")
        body = {
            "dateRanges": [dr],
            "dimensions": [{"name": "landingPagePlusQueryString"}, {"name": "sessionSourceMedium"}],
            "metrics": [{"name": "sessions"}, {"name": "engagedSessions"}, {"name": "conversions"}],
            "dimensionFilter": dim_filter or {
                "filter": {
                    "fieldName": "sessionSourceMedium",
                    "stringFilter": {"matchType": "CONTAINS", "value": "cpc"},
                }
            },
            "orderBys": [{"metric": {"metricName": "sessions"}, "desc": True}],
            "limit": 30,
        }
        report = run_report(token, property_id, body)
        print_rows(report, ["landing_page", "source/medium"], ["sessions", "engaged", "conversions"])
        return

    print(f"\n=== Session-ök forrás/csatorna szerint (utolsó {args.days} nap) ===")
    body = {
        "dateRanges": [dr],
        "dimensions": [{"name": "sessionSourceMedium"}],
        "metrics": [
            {"name": "sessions"},
            {"name": "engagedSessions"},
            {"name": "averageSessionDuration"},
            {"name": "conversions"},
        ],
        "orderBys": [{"metric": {"metricName": "sessions"}, "desc": True}],
        "limit": 20,
    }
    if dim_filter:
        body["dimensionFilter"] = dim_filter
    report = run_report(token, property_id, body)
    print_rows(report, ["source/medium"], ["sessions", "engaged", "avg_duration_s", "conversions"])


if __name__ == "__main__":
    main()
