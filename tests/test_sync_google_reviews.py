"""Offline tests: no credentials, no Google API calls."""

import os
import unittest
from unittest.mock import patch

from scripts import sync_google_reviews as reviews


class ReviewsTest(unittest.TestCase):
    def test_normalizes_google_review_without_html(self):
        item = reviews.normalize_review({
            "reviewId": "r1", "reviewer": {"displayName": "Ali <test>"},
            "starRating": "FIVE", "comment": "Parça kaliteli",
            "createTime": "2026-11-16T12:00:00Z",
        })
        self.assertEqual(item["reviewer"], "Ali <test>")
        self.assertEqual(item["rating"], 5)
        self.assertEqual(item["comment"], "Parça kaliteli")

    def test_uses_explicit_location_name(self):
        with patch.dict(os.environ, {"GOOGLE_LOCATION_NAME": "accounts/1/locations/2"}):
            self.assertEqual(reviews.find_location("unused"), "accounts/1/locations/2")

    def test_does_not_guess_another_business(self):
        with patch.dict(os.environ, {"GOOGLE_LOCATION_NAME": ""}):
            with patch.object(reviews, "all_pages", side_effect=[
                [{"name": "accounts/1"}],
                [{"name": "locations/10", "title": "Arat Halı Yıkama"},
                 {"name": "locations/11", "title": "Turkuaz 3D"}],
            ]):
                self.assertEqual(reviews.find_location("unused"), "accounts/1/locations/11")

    def test_rejects_unknown_business_among_multiple(self):
        with patch.dict(os.environ, {"GOOGLE_LOCATION_NAME": ""}):
            with patch.object(reviews, "all_pages", side_effect=[
                [{"name": "accounts/1"}],
                [{"name": "locations/10", "title": "Arat Halı Yıkama"},
                 {"name": "locations/12", "title": "Başka İşletme"}],
            ]):
                with self.assertRaises(ValueError):
                    reviews.find_location("unused")


if __name__ == "__main__":
    unittest.main()
