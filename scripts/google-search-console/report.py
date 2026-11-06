"""
Lekéri a davelopment.hu Search Console Performance-adatait (kattintás,
impresszió, CTR, átlag pozíció — kulcsszavanként és oldalanként).

Szándékosan csak a stdlibet + python-dotenv-et használja (nincs
google-api-python-client függőség) — a refresh tokenből egy sima
urllib POST-tal kér access tokent, utána simán hívja a REST API-t.

Ez NEM egy élő weboldal-funkció, nincs cronba téve — eseti/audit
futtatásra való, amikor SEO-állapotot nézünk.

Használat:
    python3 report.py                      # alapértelmezett: utolsó 28 nap, query+page dimenzió
    python3 report.py --days 90
    python3 report.py --sites              # csak a hozzáférhető property-k listázása (site URL ellenőrzéshez)
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
API_BASE = "https://www.googleapis.com/webmasters/v3"


def get_access_token() -> str:
    client_id = os.environ["GOOGLE_CLIENT_ID"]
    client_secret = os.environ["GOOGLE_CLIENT_SECRET"]
    refresh_token = os.environ["GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN"]

    data = urllib.parse.urlencode({
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }).encode()

    req = urllib.request.Request(TOKEN_URL, data=data, method="POST")
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())["access_token"]


def api_get(path: str, token: str) -> dict:
    req = urllib.request.Request(f"{API_BASE}{path}", headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def api_post(path: str, token: str, body: dict) -> dict:
    req = urllib.request.Request(
        f"{API_BASE}{path}",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode())


def list_sites(token: str) -> None:
    result = api_get("/sites", token)
    print("Hozzáférhető Search Console property-k:")
    for site in result.get("siteEntry", []):
        print(f"  {site['siteUrl']}  (jogosultság: {site['permissionLevel']})")


def query_search_analytics(token: str, site_url: str, days: int, dimensions: list[str], row_limit: int) -> dict:
    end = datetime.utcnow().date() - timedelta(days=2)  # a GSC adat ~2 napot csúszik
    start = end - timedelta(days=days)
    body = {
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "dimensions": dimensions,
        "rowLimit": row_limit,
    }
    encoded_site = urllib.parse.quote(site_url, safe="")
    return api_post(f"/sites/{encoded_site}/searchAnalytics/query", token, body)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=28)
    parser.add_argument("--row-limit", type=int, default=25)
    parser.add_argument("--dimensions", default="query", help="vesszővel elválasztva: query,page,country,device,date")
    parser.add_argument("--sites", action="store_true", help="csak a property-k listázása")
    args = parser.parse_args()

    token = get_access_token()

    if args.sites:
        list_sites(token)
        return

    site_url = os.environ["SEARCH_CONSOLE_SITE_URL"]
    dimensions = [d.strip() for d in args.dimensions.split(",") if d.strip()]

    result = query_search_analytics(token, site_url, args.days, dimensions, args.row_limit)
    rows = result.get("rows", [])

    if not rows:
        print("Nincs adat (lehet, hogy rossz a SEARCH_CONSOLE_SITE_URL, vagy nincs forgalom az időszakban).")
        return

    header = dimensions + ["clicks", "impressions", "ctr", "position"]
    print("\t".join(header))
    for row in rows:
        keys = row.get("keys", [])
        ctr_pct = f"{row['ctr'] * 100:.2f}%"
        position = f"{row['position']:.1f}"
        print("\t".join([*keys, str(row["clicks"]), str(row["impressions"]), ctr_pct, position]))


if __name__ == "__main__":
    main()
