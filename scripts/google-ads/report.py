"""
Read-only Google Ads account snapshot: campaigns, daily budgets, status, and
last-30-day performance (impressions/clicks/cost/conversions), plus keyword
performance. Never writes/changes anything in the account.

Usage:
    pip3 install -r requirements.txt
    cp .env.example .env   # fill in, see docs/google-ads-api-setup.md
    python3 report.py                  # reads GOOGLE_ADS_CUSTOMER_ID from .env
    python3 report.py 3531653843       # or override with any client account
                                        # under the same manager account
                                        # (digits only, no dashes)
"""

import os
import sys

from dotenv import load_dotenv
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

load_dotenv()

# Developer tokens were sunset by Google on 2026-09-09 — API access is now
# governed purely by the Google Cloud project's access level (Test/Explorer/
# Basic/Standard), tied to the OAuth client used below. No token needed.
REQUIRED = [
    "GOOGLE_ADS_CLIENT_ID",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_REFRESH_TOKEN",
    "GOOGLE_ADS_CUSTOMER_ID",
]


def build_client() -> GoogleAdsClient:
    missing = [k for k in REQUIRED if not os.getenv(k)]
    if missing:
        print(f"Missing required .env values: {', '.join(missing)}")
        print("See docs/google-ads-api-setup.md")
        sys.exit(1)

    config = {
        "client_id": os.getenv("GOOGLE_ADS_CLIENT_ID"),
        "client_secret": os.getenv("GOOGLE_ADS_CLIENT_SECRET"),
        "refresh_token": os.getenv("GOOGLE_ADS_REFRESH_TOKEN"),
        "use_proto_plus": True,
    }
    login_customer_id = os.getenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID")
    if login_customer_id:
        config["login_customer_id"] = login_customer_id

    return GoogleAdsClient.load_from_dict(config)


def money(micros: int) -> str:
    return f"{micros / 1_000_000:,.0f} HUF"


def print_campaigns(client: GoogleAdsClient, customer_id: str):
    ga_service = client.get_service("GoogleAdsService")
    query = """
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          campaign_budget.amount_micros,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversions_value
        FROM campaign
        WHERE segments.date DURING LAST_30_DAYS
        ORDER BY metrics.cost_micros DESC
    """
    print("\n=== KAMPÁNYOK (utolsó 30 nap) ===\n")
    rows = ga_service.search(customer_id=customer_id, query=query)
    any_rows = False
    for row in rows:
        any_rows = True
        c = row.campaign
        b = row.campaign_budget
        m = row.metrics
        print(f"- {c.name}  [{c.status.name}]")
        print(f"    napi keret: {money(b.amount_micros)}")
        print(
            f"    megjelenés: {m.impressions}  |  kattintás: {m.clicks}  |  "
            f"költés: {money(m.cost_micros)}  |  konverzió: {m.conversions:.1f}"
        )
    if not any_rows:
        print("(Nincs kampány adat az elmúlt 30 napra — vagy még nincs induló kampány.)")


def print_keywords(client: GoogleAdsClient, customer_id: str):
    ga_service = client.get_service("GoogleAdsService")
    query = """
        SELECT
          campaign.name,
          ad_group.name,
          ad_group_criterion.keyword.text,
          ad_group_criterion.keyword.match_type,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions
        FROM keyword_view
        WHERE segments.date DURING LAST_30_DAYS
        ORDER BY metrics.cost_micros DESC
        LIMIT 50
    """
    print("\n=== KULCSSZAVAK (utolsó 30 nap, top 50 költés szerint) ===\n")
    rows = ga_service.search(customer_id=customer_id, query=query)
    any_rows = False
    for row in rows:
        any_rows = True
        kw = row.ad_group_criterion.keyword
        m = row.metrics
        print(
            f"- [{row.campaign.name} / {row.ad_group.name}] "
            f'"{kw.text}" ({kw.match_type.name})  '
            f"megj:{m.impressions} katt:{m.clicks} költés:{money(m.cost_micros)} konv:{m.conversions:.1f}"
        )
    if not any_rows:
        print("(Nincs kulcsszó-adat az elmúlt 30 napra.)")


def main():
    client = build_client()
    customer_id = sys.argv[1] if len(sys.argv) > 1 else os.getenv("GOOGLE_ADS_CUSTOMER_ID")

    try:
        print_campaigns(client, customer_id)
        print_keywords(client, customer_id)
    except GoogleAdsException as ex:
        print(f"Google Ads API hiba (request id: {ex.request_id}):")
        for error in ex.failure.errors:
            print(f"  - {error.message}")
        sys.exit(1)


if __name__ == "__main__":
    main()
