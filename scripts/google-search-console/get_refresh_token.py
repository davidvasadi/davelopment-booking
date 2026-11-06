"""
One-time helper: run this locally to obtain a Google Search Console API
refresh token. Reuses the same OAuth Client ID/Secret already set up for
the Google Ads API (scripts/google-ads/.env) — an OAuth client isn't tied
to one API, only the requested scope matters, so this asks for the
Search Console scope specifically and gets back a DIFFERENT refresh token
than the Ads one.

The scope is the full `webmasters` scope (read + write): report.py only reads,
but submit_sitemap.py needs write access to (re)submit the sitemap. A token
issued with the old `webmasters.readonly` scope gets 403 on sitemap submit.

Usage:
    cp .env.example .env   # fill in GOOGLE_CLIENT_ID / _CLIENT_SECRET
                            # (copy from scripts/google-ads/.env)
    python3 get_refresh_token.py

Opens a browser window — log in with the Google account that owns/manages
the Search Console property (e.g. davelopment.hu or booking.davelopment.hu) and grant access. Prints the
refresh token to save into .env as GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN.
"""

import os
import sys

from dotenv import load_dotenv
from google_auth_oauthlib.flow import InstalledAppFlow

load_dotenv()

SCOPES = ["https://www.googleapis.com/auth/webmasters"]


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

    print("\nSuccess. Save this as GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN in your .env:\n")
    print(credentials.refresh_token)


if __name__ == "__main__":
    main()
