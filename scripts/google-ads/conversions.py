import os
import sys
from dotenv import load_dotenv
from google.ads.googleads.client import GoogleAdsClient

load_dotenv()


def build_client():
    config = {
        "client_id": os.environ["GOOGLE_ADS_CLIENT_ID"],
        "client_secret": os.environ["GOOGLE_ADS_CLIENT_SECRET"],
        "refresh_token": os.environ["GOOGLE_ADS_REFRESH_TOKEN"],
        "login_customer_id": os.environ["GOOGLE_ADS_LOGIN_CUSTOMER_ID"],
        "use_proto_plus": True,
    }
    return GoogleAdsClient.load_from_dict(config)


def main():
    customer_id = sys.argv[1] if len(sys.argv) > 1 else os.environ["GOOGLE_ADS_CUSTOMER_ID"]
    client = build_client()
    ga_service = client.get_service("GoogleAdsService")

    print("=== KONVERZIÓS MŰVELETEK ===\n")
    query = """
        SELECT
          conversion_action.id,
          conversion_action.name,
          conversion_action.status,
          conversion_action.type,
          conversion_action.category,
          conversion_action.primary_for_goal
        FROM conversion_action
        ORDER BY conversion_action.name
    """
    for row in ga_service.search(customer_id=customer_id, query=query):
        ca = row.conversion_action
        print(f"- {ca.name} | status:{ca.status.name} | type:{ca.type_.name} | category:{ca.category.name} | primary:{ca.primary_for_goal}")

    print("\n=== KAMPÁNY-SZINTŰ KONVERZIÓS CÉLOK (selective_optimization) ===\n")
    query2 = """
        SELECT campaign.id, campaign.name, campaign.selective_optimization.conversion_actions
        FROM campaign
        WHERE campaign.status != 'REMOVED'
    """
    for row in ga_service.search(customer_id=customer_id, query=query2):
        print(f"- {row.campaign.name}: {list(row.campaign.selective_optimization.conversion_actions)}")

    print("\n=== KONVERZIÓK NAPONKÉNT (utolsó 14 nap, csak a weboldal készítés kampány) ===\n")
    query3 = """
        SELECT
          segments.date,
          campaign.name,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversions_value
        FROM campaign
        WHERE segments.date DURING LAST_14_DAYS
        AND campaign.name = 'weboldal készítés'
        ORDER BY segments.date
    """
    for row in ga_service.search(customer_id=customer_id, query=query3):
        d = row.segments.date
        m = row.metrics
        print(f"{d}: megj:{m.impressions} katt:{m.clicks} költés:{m.cost_micros/1_000_000:.0f}HUF konv:{m.conversions} konv_ertek:{m.conversions_value}")


if __name__ == "__main__":
    main()
