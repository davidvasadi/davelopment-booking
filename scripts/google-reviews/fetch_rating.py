"""
Naponta egyszer lefuttatandó script (cron), ami lekéri a davelopment Google
Cégem-profiljának pontszámát, értékelésszámát, ÉS a tartalmas (1 mondatnál
hosszabb) véleményeket a Places API (New) Place Details végpontjáról.

Szándékosan NULLA külső Python-csomag-függőség (csak a stdlib-et használja:
urllib, hashlib, re, json) — a production szerveren nincs pip telepítve,
így ennek a scriptnek önmagában, telepítés nélkül kell futnia.

FONTOS a költség miatt: a mezők (X-Goog-FieldMask header) a "rating" / Places
API SKU-terminológiában az "Enterprise" (rating, userRatingCount) és
"Enterprise + Atmosphere" (reviews) kategóriába esnek — ÉS a Google 2025
márciusában megszüntette az általános 200$/hó keretet, SKU-nkénti ingyenes
kvótákra váltott. Mindkét érintett SKU-nak saját, havi 1000 hívásos ingyenes
kerete van — nálunk ez napi 1 hívás (~30/hó), bőven belefér.

A Google max. 5 véleményt ad vissza helyszínenként (a saját relevancia-
sorrendje szerint, nem mi választjuk ki, nem lehet lapozni többre).

Csak azokat a véleményeket tartjuk meg, amik TÖBB MINT 1 mondatból állnak —
az 1 mondatos ("Nagyon megbízható!") vagy szöveg nélküli értékeléseket
kihagyjuk, nehogy sovány/nem meggyőző tartalom kerüljön ki élesben.

Szándékosan NEM ír adatbázisba (Payload/Postgres séma-változtatás production
deployon megbízhatatlan — lásd docs/davelopment-gotchas), csak JSON-fájlokba
+ egy mellékelt képmappába, amiket a Next.js frontend fájlrendszeri
olvasással szolgál ki.

Használat:
    python3 fetch_rating.py

Env változók (.env fájlból, lásd .env.example — saját, egyszerű betöltő,
nem kell hozzá python-dotenv):
    GOOGLE_PLACES_API_KEY
    GOOGLE_PLACE_ID
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent


def load_env_file(path: Path) -> None:
    """Minimál .env betöltő — csak KEY=VALUE sorokat ért, nem írja felül a már meglévő env-et."""
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip()
        if key and key not in os.environ:
            os.environ[key] = value


load_env_file(SCRIPT_DIR / ".env")

PLACE_DETAILS_URL_TEMPLATE = "https://places.googleapis.com/v1/places/{place_id}"
FIELD_MASK = "id,displayName,rating,userRatingCount,reviews"

FRONTEND_PUBLIC_DIR = Path(
    os.environ.get("GOOGLE_RATING_PUBLIC_DIR", SCRIPT_DIR.parent.parent / "frontend" / "public")
)
RATING_OUTPUT_PATH = FRONTEND_PUBLIC_DIR / "data" / "google-rating.json"
REVIEWS_OUTPUT_PATH = FRONTEND_PUBLIC_DIR / "data" / "google-reviews.json"
REVIEW_PHOTOS_DIR = FRONTEND_PUBLIC_DIR / "data" / "google-review-photos"

# Relatív útvonalat írunk ki (nem a domaint hardkódolva) — így ugyanaz a
# JSON helyesen működik lokális fejlesztésben (localhost:3000) ÉS élesben
# is, nem kell környezetenként külön generálni. A letöltött fotókat saját
# magunk hosztoljuk (nem a Google CDN-jéről hotlinkeljük — az instabil,
# bármikor lejárhat/megváltozhat).
#
# A photoUrl a /google-review-photo/<fájlnév> route handlert célozza (NEM
# /api/ alatt — az nginx minden /api/-t a Payload backendre proxyz, a
# Next.js szerverhez el sem jutna)
# (NEM a sima /data/... statikus útvonalat) — a Next.js production
# szervere (`next start`) a public/ mappa fájllistáját csak induláskor
# olvassa be, így egy futás közben (ez a script által) odamásolt új fotó
# a statikus útvonalon 404-et adna a legközelebbi PM2-restartig. A route
# handler minden kérésnél ténylegesen a lemezről olvassa a fájlt, ezért
# cron-restart nélkül is azonnal elérhető.

SENTENCE_END_RE = re.compile(r"[.!?]")


def http_get(url: str, headers: dict) -> dict:
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def is_substantial(text: str) -> bool:
    """Több mint 1 mondatból áll-e a szöveg."""
    return len(SENTENCE_END_RE.findall(text.strip())) > 1


def fetch_place_details() -> dict:
    api_key = os.environ["GOOGLE_PLACES_API_KEY"]
    place_id = os.environ["GOOGLE_PLACE_ID"]
    url = PLACE_DETAILS_URL_TEMPLATE.format(place_id=place_id)
    headers = {"X-Goog-Api-Key": api_key, "X-Goog-FieldMask": FIELD_MASK}
    return http_get(url, headers)


def download_photo(photo_uri: str, review_id: str) -> str | None:
    """Letölti a reviewer profilképét, visszaadja a fájlnevet (vagy None hiba esetén)."""
    try:
        req = urllib.request.Request(photo_uri, method="GET")
        with urllib.request.urlopen(req, timeout=15) as resp:
            content = resp.read()
        filename = f"{hashlib.sha1(review_id.encode()).hexdigest()[:16]}.jpg"
        REVIEW_PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
        (REVIEW_PHOTOS_DIR / filename).write_bytes(content)
        return filename
    except Exception as e:
        print(f"Figyelmeztetés: nem sikerült letölteni a fotót ({review_id}): {e}", file=sys.stderr)
        return None


def build_reviewer_photos(raw_reviews: list) -> list:
    """Minden visszaadott értékelő profilképe (NEM szűrve a szöveg hosszára) — az
    avatar-sorhoz kell, ahol a cél a valódi, fotóval rendelkező arcok megjelenítése,
    nem a tartalmas szöveg. A Google max. 5 review-t ad vissza helyszínenként, ebből
    szűrjük ki azokat, akiknek egyáltalán van profilképük."""
    out = []
    for r in raw_reviews:
        author = r.get("authorAttribution", {})
        photo_uri = author.get("photoUri")
        if not photo_uri:
            continue
        original = (r.get("originalText") or {}).get("text") or (r.get("text") or {}).get("text") or ""
        review_id = r.get("name", original[:40] or photo_uri)
        photo_filename = download_photo(photo_uri, review_id)
        if photo_filename:
            out.append(f"/google-review-photo/{photo_filename}")
    return out


def build_reviews_payload(raw_reviews: list) -> list:
    out = []
    for r in raw_reviews:
        original = (r.get("originalText") or {}).get("text") or (r.get("text") or {}).get("text")
        if not original or not is_substantial(original):
            continue

        author = r.get("authorAttribution", {})
        review_id = r.get("name", original[:40])
        photo_filename = download_photo(author["photoUri"], review_id) if author.get("photoUri") else None

        out.append({
            "authorName": author.get("displayName", "Google-felhasználó"),
            "text": original,
            "rating": r.get("rating"),
            "photoUrl": f"/google-review-photo/{photo_filename}" if photo_filename else None,
            "publishTime": r.get("publishTime"),
        })
    return out


def main() -> None:
    try:
        data = fetch_place_details()
    except Exception as e:
        print(f"HIBA a Google-értékelés lekérésekor: {e}", file=sys.stderr)
        # Szándékosan NEM írjuk felül a meglévő JSON-okat hiba esetén —
        # inkább marad a tegnapi (kicsit elavult) adat, mint hogy eltűnjön.
        sys.exit(1)

    place_id = os.environ["GOOGLE_PLACE_ID"]
    reviewer_photos = build_reviewer_photos(data.get("reviews", []))
    rating_result = {
        "rating": data.get("rating"),
        "userRatingCount": data.get("userRatingCount"),
        "name": (data.get("displayName") or {}).get("text"),
        # Minden visszaadott értékelő profilképe (szöveg-hossztól függetlenül) — az
        # avatar-soroknak kell, lásd build_reviewer_photos().
        "reviewerPhotos": reviewer_photos,
        # Nem igényel API-hívást — a Place ID-ból kódból felépíthető,
        # dokumentált Google Maps keresési URL-formátum.
        "googleMapsUrl": f"https://www.google.com/maps/search/?api=1&query=Google&query_place_id={place_id}",
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
    }
    RATING_OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    RATING_OUTPUT_PATH.write_text(json.dumps(rating_result, ensure_ascii=False, indent=2))

    reviews_result = build_reviews_payload(data.get("reviews", []))
    REVIEWS_OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REVIEWS_OUTPUT_PATH.write_text(json.dumps(reviews_result, ensure_ascii=False, indent=2))

    print(
        f"OK — {rating_result['rating']} csillag, {rating_result['userRatingCount']} értékelés "
        f"({len(reviews_result)} tartalmas vélemény, {len(reviewer_photos)} profilkép kiírva) "
        f"-> {RATING_OUTPUT_PATH}, {REVIEWS_OUTPUT_PATH}"
    )


if __name__ == "__main__":
    main()
