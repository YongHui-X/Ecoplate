"""Tests for SimilarProductsMatcher - multi-factor similarity scoring.

This is testing the similarity product"""

from app import SimilarProductsMatcher


# ── calculate_category_score ──────────────────────────────────────────────────


class TestCategoryScore:

    def test_exact_match(self):
        """Same category returns 1.0"""
        assert SimilarProductsMatcher.calculate_category_score("produce", "produce") == 1.0

    def test_related_category(self):
        """Related categories (produce↔frozen) return 0.5"""
        assert SimilarProductsMatcher.calculate_category_score("produce", "frozen") == 0.5

    def test_unrelated_category(self):
        """Unrelated categories return 0.0"""
        assert SimilarProductsMatcher.calculate_category_score("dairy", "meat") == 0.0

    def test_missing_target_category(self):
        """None target returns neutral 0.5"""
        assert SimilarProductsMatcher.calculate_category_score(None, "dairy") == 0.5

    def test_missing_candidate_category(self):
        """None candidate returns neutral 0.5"""
        assert SimilarProductsMatcher.calculate_category_score("dairy", None) == 0.5

    def test_case_insensitive(self):
        """Category matching is case-insensitive"""
        assert SimilarProductsMatcher.calculate_category_score("Produce", "PRODUCE") == 1.0


# ── calculate_price_score ─────────────────────────────────────────────────────


class TestPriceScore:

    def test_identical_prices(self):
        """Same price returns 1.0"""
        assert SimilarProductsMatcher.calculate_price_score(5.0, 5.0) == 1.0

    def test_50_percent_diff_returns_zero(self):
        """50% price difference returns 0.0"""
        assert SimilarProductsMatcher.calculate_price_score(10.0, 15.0) == 0.0

    def test_25_percent_diff(self):
        """25% diff returns approximately 0.5"""
        score = SimilarProductsMatcher.calculate_price_score(10.0, 12.5)
        assert 0.4 <= score <= 0.6

    def test_missing_price_returns_neutral(self):
        """None price returns neutral 0.5"""
        assert SimilarProductsMatcher.calculate_price_score(None, 5.0) == 0.5


# ── calculate_distance_score ──────────────────────────────────────────────────


class TestDistanceScore:

    def test_zero_distance(self):
        """0 km distance returns 1.0"""
        assert SimilarProductsMatcher.calculate_distance_score(0) == 1.0

    def test_max_distance_returns_zero(self):
        """10 km (default max) returns 0.0"""
        assert SimilarProductsMatcher.calculate_distance_score(10.0) == 0.0

    def test_half_distance(self):
        """5 km returns 0.5"""
        assert SimilarProductsMatcher.calculate_distance_score(5.0) == 0.5

    def test_missing_distance_returns_neutral(self):
        """None returns neutral 0.5"""
        assert SimilarProductsMatcher.calculate_distance_score(None) == 0.5


# ── calculate_freshness_score ─────────────────────────────────────────────────


class TestFreshnessScore:

    def test_same_freshness(self):
        """Same days returns 1.0"""
        assert SimilarProductsMatcher.calculate_freshness_score(5, 5) == 1.0

    def test_7_day_diff_returns_zero(self):
        """7-day difference returns 0.0"""
        assert SimilarProductsMatcher.calculate_freshness_score(1, 8) == 0.0

    def test_missing_freshness_returns_neutral(self):
        """None returns neutral 0.5"""
        assert SimilarProductsMatcher.calculate_freshness_score(None, 5) == 0.5


# ── calculate_text_similarity ─────────────────────────────────────────────────


class TestTextSimilarity:

    def test_identical_texts(self):
        """Identical texts should have very high similarity"""
        matrix = SimilarProductsMatcher.calculate_text_similarity(
            ["Fresh organic apples", "Fresh organic apples"]
        )
        assert matrix[0, 1] >= 0.99

    def test_different_texts(self):
        """Completely different texts should have low similarity"""
        matrix = SimilarProductsMatcher.calculate_text_similarity(
            ["Fresh organic apples", "Frozen pepperoni pizza"]
        )
        assert matrix[0, 1] < 0.5

    def test_single_text_returns_identity(self):
        """Single text returns [[1.0]]"""
        matrix = SimilarProductsMatcher.calculate_text_similarity(["Hello"])
        assert matrix[0, 0] == 1.0


# ── find_similar (integration) ────────────────────────────────────────────────


class TestFindSimilar:

    def test_excludes_same_seller(self, sample_listing):
        """Candidates with same sellerId as target are excluded"""
        same_seller = {
            "id": 99, "sellerId": sample_listing["sellerId"],
            "title": "Same Seller Apples", "description": "Apples",
            "category": "produce", "price": 5.0,
        }
        results = SimilarProductsMatcher.find_similar(sample_listing, [same_seller])
        assert len(results) == 0

    def test_excludes_same_listing_id(self, sample_listing):
        """Candidate with same id as target is excluded"""
        same_id = {**sample_listing, "sellerId": 999}
        results = SimilarProductsMatcher.find_similar(sample_listing, [same_id])
        assert len(results) == 0

    def test_returns_sorted_by_score_descending(self, sample_listing, sample_candidates):
        """Results are sorted by similarity_score descending"""
        results = SimilarProductsMatcher.find_similar(sample_listing, sample_candidates)
        scores = [r['similarity_score'] for r in results]
        assert scores == sorted(scores, reverse=True)

    def test_respects_limit(self, sample_listing, sample_candidates):
        """Limit parameter caps the number of results"""
        results = SimilarProductsMatcher.find_similar(
            sample_listing, sample_candidates, limit=1
        )
        assert len(results) <= 1

    def test_empty_candidates_returns_empty(self, sample_listing):
        """Empty candidates list returns empty results"""
        results = SimilarProductsMatcher.find_similar(sample_listing, [])
        assert results == []

    def test_result_contains_match_factors(self, sample_listing, sample_candidates):
        """Each result includes similarity_score and match_factors breakdown"""
        results = SimilarProductsMatcher.find_similar(sample_listing, sample_candidates)
        if results:
            r = results[0]
            assert 'similarity_score' in r
            assert 'match_factors' in r
            for key in ['category', 'text', 'price', 'distance', 'freshness']:
                assert key in r['match_factors']

    def test_scores_above_threshold(self, sample_listing, sample_candidates):
        """All returned results have similarity_score >= 0.5 threshold"""
        results = SimilarProductsMatcher.find_similar(sample_listing, sample_candidates)
        for r in results:
            assert r['similarity_score'] >= 0.5
