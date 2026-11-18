#!/usr/bin/env python3
"""Fetch Turkuaz 3D Google Business Profile reviews without exposing credentials.

Environment: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN.
Optional: GOOGLE_LOCATION_NAME (accounts/123/locations/456).
The output is a public, credential-free JSON file used by the static website.
"""

from __future__ import annotations

import datetime as dt
import json
import os
from pathlib import Path
import re
import sys
import urllib.error
import urllib.parse
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "google-reviews.json"
GOOGLE_MY_BUSINESS = "https://mybusiness.googleapis.com/v4"
ACCOUNT_MANAGEMENT = "https://mybusinessaccountmanagement.googleapis.com/v1"
BUSINESS_INFORMATION = "https://mybusinessbusinessinformation.googleapis.com/v1"
LOCATION_PATTERN = re.compile(r"^accounts/[^/]+/locations/[^/]+$")
STARS = {"ONE": 1, "TWO": 2, "THREE": 3, "FOUR": 4, "FIVE": 5}


def request_json(url: str, *, token: str | None = None, form: dict | None = None) -> dict:
    data = urllib.parse.urlencode(form).encode("utf-8") if form is not None else None
    headers = {"Accept": "application/json", "User-Agent": "Turkuaz3D-ReviewsSync/1.0"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if data is not None:
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    request = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(request, timeout=25) as response:
        result = json.load(response)
    if not isinstance(result, dict):
        raise ValueError("Google API returned an unexpected response")
    return result


def with_query(url: str, **params: str | int) -> str:
    return url + "?" + urllib.parse.urlencode(params)


def all_pages(url: str, field: str, token: str, **params: str | int) -> list[dict]:
    items = []
    page_token = ""
    for _ in range(30):
        page_params = dict(params)
        if page_token:
            page_params["pageToken"] = page_token
        page = request_json(with_query(url, **page_params), token=token)
        items.extend(page.get(field, []))
        page_token = page.get("nextPageToken", "")
        if not page_token:
            return items
    raise ValueError("Too many Google Business Profile result pages")


def find_location(token: str) -> str:
    override = os.getenv("GOOGLE_LOCATION_NAME", "").strip()
    if override:
        if not LOCATION_PATTERN.fullmatch(override):
            raise ValueError("GOOGLE_LOCATION_NAME must look like accounts/123/locations/456")
        return override

    try:
        accounts = all_pages(f"{ACCOUNT_MANAGEMENT}/accounts", "accounts", token, pageSize=100)
    except urllib.error.HTTPError as error:
        # Extract only a fixed-format Google error reason, not response details or credentials.
        reason = "UNKNOWN"
        try:
            payload = json.load(error)
            for detail in payload.get("error", {}).get("details", []):
                candidate = detail.get("reason", "")
                if re.fullmatch(r"[A-Z_]{3,50}", candidate):
                    reason = candidate
                    break
        except (ValueError, TypeError, AttributeError, OSError):
            pass
        print(f"Account Management API returned HTTP {error.code}, reason {reason}; trying legacy endpoint.", file=sys.stderr)
        accounts = all_pages(f"{GOOGLE_MY_BUSINESS}/accounts", "accounts", token, pageSize=100)

    candidates = []
    for account in accounts:
        account_name = account.get("name", "")
        if not re.fullmatch(r"accounts/[^/]+", account_name):
            continue
        try:
            locations = all_pages(
                f"{BUSINESS_INFORMATION}/{account_name}/locations",
                "locations", token, readMask="name,title", pageSize=100,
            )
        except urllib.error.HTTPError:
            locations = all_pages(
                f"{GOOGLE_MY_BUSINESS}/{account_name}/locations",
                "locations", token, pageSize=100,
            )
        for location in locations:
            location_name = location.get("name", "")
            if re.fullmatch(r"locations/[^/]+", location_name):
                location_name = f"{account_name}/{location_name}"
            if not LOCATION_PATTERN.fullmatch(location_name):
                continue
            title = location.get("title") or location.get("locationName") or ""
            candidates.append((location_name, title))

    matches = [name for name, title in candidates if "turkuaz 3d" in title.casefold()]
    if len(matches) == 1:
        return matches[0]
    if len(candidates) == 1:
        return candidates[0][0]
    # Do not accidentally publish reviews from a different business.
    raise ValueError(
        "Turkuaz 3D location could not be uniquely identified. "
        "Set GOOGLE_LOCATION_NAME to the correct accounts/.../locations/... identifier."
    )


def normalize_review(review: dict) -> dict:
    rating = review.get("starRating", "")
    if isinstance(rating, str):
        rating = STARS.get(rating, 0)
    return {
        "id": review.get("reviewId", ""),
        "reviewer": (review.get("reviewer") or {}).get("displayName") or "Google kullanıcısı",
        "rating": rating if isinstance(rating, int) and 1 <= rating <= 5 else 0,
        "comment": review.get("comment", ""),
        "created_at": review.get("createTime", ""),
        "updated_at": review.get("updateTime", ""),
    }


def fetch_reviews(token: str, location_name: str) -> dict:
    url = f"{GOOGLE_MY_BUSINESS}/{location_name}/reviews"
    page = request_json(with_query(url, pageSize=50, orderBy="updateTime desc"), token=token)
    return {
        "source": "Google Business Profile",
        "business": "Turkuaz 3D",
        "average_rating": page.get("averageRating"),
        "total_review_count": page.get("totalReviewCount", 0),
        "reviews": [normalize_review(review) for review in page.get("reviews", [])],
    }


def main() -> int:
    creds = {key: os.getenv(key, "") for key in
             ("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN")}
    if not all(creds.values()):
        print("Google reviews sync is not configured yet; existing website remains unchanged.")
        return 0
    stage = "OAuth token"
    try:
        token_data = request_json(
            "https://oauth2.googleapis.com/token",
            form={"grant_type": "refresh_token", "client_id": creds["GOOGLE_CLIENT_ID"],
                  "client_secret": creds["GOOGLE_CLIENT_SECRET"],
                  "refresh_token": creds["GOOGLE_REFRESH_TOKEN"]},
        )
        token = token_data.get("access_token", "")
        if not token:
            raise ValueError("Google did not return an access token")
        stage = "Business Profile location discovery"
        location = find_location(token)
        stage = "Google Business reviews"
        fresh = fetch_reviews(token, location)
        if OUTPUT.exists():
            previous = json.loads(OUTPUT.read_text(encoding="utf-8"))
            previous.pop("synced_at", None)
            if previous == fresh:
                print("Google reviews unchanged; no file update needed.")
                return 0
        fresh["synced_at"] = dt.datetime.now(dt.timezone.utc).isoformat()
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps(fresh, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Saved {len(fresh['reviews'])} reviews (total: {fresh['total_review_count']}).")
        return 0
    except urllib.error.HTTPError as error:
        # Only the request phase and HTTP status are logged; never print request data.
        print(f"Google reviews API failed at {stage} (HTTP {error.code}).", file=sys.stderr)
        return 1
    except (urllib.error.URLError, ValueError, KeyError, OSError, json.JSONDecodeError) as error:
        # No secret values or OAuth token responses are logged.
        print(f"Google reviews could not be synchronized ({type(error).__name__}).", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
