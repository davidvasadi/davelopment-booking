"""
Újra beküldi a sitemap-ot a Search Console-nak, hogy a Google minél
hamarabb újra lekérje és felfedezze a friss/módosított URL-eket.

Ez NEM egyenértékű az egyenkénti "Indexelés kérése" gombbal (az csak a
Search Console admin UI-ból, vagy a nagyon korlátozott, job-posting/
livestream tartalomra szűkített Indexing API-n át érhető el) — de a
sitemap újraküldése a leggyorsabb, API-n keresztül elérhető jelzés a
Google felé, hogy "nézz vissza ide most".

Használat:
    python3 submit_sitemap.py
"""
import os
import urllib.parse
import urllib.request

from dotenv import load_dotenv

load_dotenv()

TOKEN_URL = "https://oauth2.googleapis.com/token"
API_BASE = "https://www.googleapis.com/webmasters/v3"


def get_access_token() -> str:
    data = urllib.parse.urlencode({
        "client_id": os.environ["GOOGLE_CLIENT_ID"],
        "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
        "refresh_token": os.environ["GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN"],
        "grant_type": "refresh_token",
    }).encode()
    req = urllib.request.Request(TOKEN_URL, data=data, method="POST")
    with urllib.request.urlopen(req, timeout=15) as resp:
        import json
        return json.loads(resp.read().decode())["access_token"]


def main():
    token = get_access_token()
    site_url = os.environ["SEARCH_CONSOLE_SITE_URL"]
    # SEARCH_CONSOLE_SITEMAP_URL felülírja; különben a property-ből számoljuk
    # (sc-domain:pelda.hu → https://pelda.hu/sitemap.xml, URL-prefix → <prefix>/sitemap.xml)
    sitemap_url = os.getenv("SEARCH_CONSOLE_SITEMAP_URL", "").strip()
    if not sitemap_url:
        if site_url.startswith("sc-domain:"):
            sitemap_url = f"https://{site_url.split(':', 1)[1]}/sitemap.xml"
        else:
            sitemap_url = site_url.rstrip("/") + "/sitemap.xml"

    encoded_site = urllib.parse.quote(site_url, safe="")
    encoded_sitemap = urllib.parse.quote(sitemap_url, safe="")

    req = urllib.request.Request(
        f"{API_BASE}/sites/{encoded_site}/sitemaps/{encoded_sitemap}",
        headers={"Authorization": f"Bearer {token}"},
        method="PUT",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            print(f"OK ({resp.status}): sitemap beküldve — {sitemap_url}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        if e.code == 403 and "insufficient" in body.lower():
            print("HIBA 403: a refresh token csak olvasási jogú. Futtasd újra a get_refresh_token.py-t "
                  "(most már írási jogot kér), és az új tokent írd a .env GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN sorába.")
        else:
            print(f"HIBA {e.code}: {body}")


if __name__ == "__main__":
    main()
