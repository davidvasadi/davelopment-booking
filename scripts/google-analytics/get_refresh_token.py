"""
One-time helper: run this locally to obtain a Google Analytics Data API
(GA4) refresh token. Reuses the same OAuth Client ID/Secret already set up
for the Google Ads API (scripts/google-ads/.env) and Search Console
(scripts/google-search-console/.env) — an OAuth client isn't tied to one
API, only the requested scope matters, so this asks for the Analytics
readonly scope specifically and gets back a DIFFERENT refresh token than
the Ads/Search Console ones.

Usage:
    cp .env.example .env   # fill in GOOGLE_CLIENT_ID / _CLIENT_SECRET
                            # (copy from scripts/google-ads/.env)
    python3 get_refresh_token.py

Opens a browser window — log in with the Google account that has access
to the davelopment.hu GA4 property and grant access. Prints the refresh
token to save into .env as GOOGLE_ANALYTICS_REFRESH_TOKEN.
"""

import os
import sys

from dotenv import load_dotenv
from google_auth_oauthlib.flow import InstalledAppFlow

load_dotenv()

SCOPES = ["https://www.googleapis.com/auth/analytics.readonly"]


def main():
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()

    if not client_id or not client_secret:
        print("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET hiányzik a .env-ből.")
        sys.exit(1)

    client_config = {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost"],
        }
    }

    flow = InstalledAppFlow.from_client_config(client_config, scopes=SCOPES)
    credentials = flow.run_local_server(port=0)

    print("\nSuccess. Save this as GOOGLE_ANALYTICS_REFRESH_TOKEN in your .env:\n")
    print(credentials.refresh_token)


if __name__ == "__main__":
    main()
