"""
One-time helper: run this locally to obtain a Google Ads API refresh token.

Usage:
    pip3 install -r requirements.txt
    cp .env.example .env   # fill in GOOGLE_ADS_CLIENT_ID / _CLIENT_SECRET first
    python3 get_refresh_token.py

Reads the OAuth Client ID + Secret from .env (see docs/google-ads-api-setup.md
Checkpoint 1), opens a browser window for you to log in and grant access,
then prints the refresh token to save into .env as GOOGLE_ADS_REFRESH_TOKEN.
"""

import os
import sys

from dotenv import load_dotenv
from google_auth_oauthlib.flow import InstalledAppFlow

load_dotenv()

SCOPES = ["https://www.googleapis.com/auth/adwords"]


def main():
    client_id = os.getenv("GOOGLE_ADS_CLIENT_ID", "").strip()
    client_secret = os.getenv("GOOGLE_ADS_CLIENT_SECRET", "").strip()

    if not client_id or not client_secret:
        print("GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET hiányzik a .env-ből.")
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

    print("\nSuccess. Save this as GOOGLE_ADS_REFRESH_TOKEN in your .env:\n")
    print(credentials.refresh_token)


if __name__ == "__main__":
    main()
