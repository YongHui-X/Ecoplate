"""
Comprehensive tests for the EcoPlate Recommendation Engine.
Run with: pytest test_app.py -v --cov=app --cov-report=term-missing

This file is python test for recommendation engine
"""

import pytest
import json
from datetime import datetime, timedelta
from app import (
    app,
    SimilarProductsMatcher,
    PriceRecommender,
    SIMILARITY_THRESHOLD,
    MAX_CANDIDATES,
    MAX_RESULT_LIMIT,
    DEFAULT_NEUTRAL_SCORE,
    MAX_DISCOUNT_CAP,
    PRICE_FLOOR_RATIO
)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def client():
    """Create test client"""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


@pytest.fixture
def sample_target():
    """Sample target listing for similarity tests"""
    return {
        'id': 1,
        'sellerId': 1,
        'title': 'Fresh Organic Apples',
        'description': 'Delicious green apples from local farm',
        'category': 'produce',
        'price': 5.00,
        'days_until_expiry': 5
    }


@pytest.fixture
def sample_candidates():
    """Sample candidate listings for similarity tests"""
    return [
        {
            'id': 2,
            'sellerId': 2,
            'title': 'Red Apples',
            'description': 'Sweet red apples',
            'category': 'produce',
            'price': 4.50,
            'distance_km': 2.5,
            'days_until_expiry': 4
        },
        {
            'id': 3,
            'sellerId': 3,
            'title': 'Fresh Milk',
            'description': 'Whole milk 1 liter',
            'category': 'dairy',
            'price': 3.00,
            'distance_km': 1.0,
            'days_until_expiry': 3
        },
        {
            'id': 4,
            'sellerId': 4,
            'title': 'Organic Bananas',
            'description': 'Yellow bananas organic',
            'category': 'produce',
            'price': 2.50,
            'distance_km': 5.0,
            'days_until_expiry': 2
        },
        {
            'id': 5,
            'sellerId': 1,  # Same seller as target - should be excluded
            'title': 'Green Apples',
            'description': 'More apples from same seller',
            'category': 'produce',
            'price': 5.00,
            'distance_km': 0,
            'days_until_expiry': 5
        }
    ]


# ============================================================================
# Health Check Tests
# ============================================================================

class TestHealthCheck:
    """Tests for health check endpoint"""

    def test_health_check_returns_ok(self, client):
        """Health check should return status ok"""
        response = client.get('/health')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'ok'
        assert data['service'] == 'recommendation-engine'


# ============================================================================
# SimilarProductsMatcher Tests
# ============================================================================

class TestSimilarProductsMatcher:
    """Tests for SimilarProductsMatcher class"""

    # Category Score Tests
    def test_category_score_exact_match(self):
        """Exact category match should return 1.0"""
        score = SimilarProductsMatcher.calculate_category_score('produce', 'produce')
        assert score == 1.0

    def test_category_score_exact_match_case_insensitive(self):
        """Category matching should be case insensitive"""
        score = SimilarProductsMatcher.calculate_category_score('PRODUCE', 'Produce')
        assert score == 1.0

    def test_category_score_related_categories(self):
        """Related categories should return 0.5"""
        # produce is related to frozen
        score = SimilarProductsMatcher.calculate_category_score('produce', 'frozen')
        assert score == 0.5

    def test_category_score_unrelated_categories(self):
        """Unrelated categories should return 0.0"""
        score = SimilarProductsMatcher.calculate_category_score('produce', 'dairy')
        assert score == 0.0

    def test_category_score_empty_target(self):
        """Empty target category should return 0.5"""
        score = SimilarProductsMatcher.calculate_category_score('', 'produce')
        assert score == 0.5

    def test_category_score_empty_candidate(self):
        """Empty candidate category should return 0.5"""
        score = SimilarProductsMatcher.calculate_category_score('produce', '')
        assert score == 0.5

    def test_category_score_both_empty(self):
        """Both empty categories should return 0.5"""
        score = SimilarProductsMatcher.calculate_category_score('', '')
        assert score == 0.5

    def test_category_score_none_values(self):
        """None categories should return 0.5"""
        score = SimilarProductsMatcher.calculate_category_score(None, None)
        assert score == 0.5

    # Price Score Tests
    def test_price_score_exact_match(self):
        """Exact price match should return 1.0"""
        score = SimilarProductsMatcher.calculate_price_score(10.0, 10.0)
        assert score == 1.0

    def test_price_score_within_tolerance(self):
        """Price within 50% tolerance should return positive score"""
        score = SimilarProductsMatcher.calculate_price_score(10.0, 12.0)
        assert 0 < score < 1

    def test_price_score_outside_tolerance(self):
        """Price outside 50% tolerance should return 0"""
        score = SimilarProductsMatcher.calculate_price_score(10.0, 20.0)
        assert score == 0

    def test_price_score_zero_target(self):
        """Zero target price should return 0.5"""
        score = SimilarProductsMatcher.calculate_price_score(0, 10.0)
        assert score == 0.5

    def test_price_score_zero_candidate(self):
        """Zero candidate price should return 0.5"""
        score = SimilarProductsMatcher.calculate_price_score(10.0, 0)
        assert score == 0.5

    def test_price_score_none_values(self):
        """None prices should return 0.5"""
        score = SimilarProductsMatcher.calculate_price_score(None, None)
        assert score == 0.5

    # Distance Score Tests
    def test_distance_score_zero_distance(self):
        """Zero distance should return 1.0"""
        score = SimilarProductsMatcher.calculate_distance_score(0)
        assert score == 1.0

    def test_distance_score_max_distance(self):
        """Distance at max should return 0"""
        score = SimilarProductsMatcher.calculate_distance_score(10, max_distance=10)
        assert score == 0

    def test_distance_score_half_max(self):
        """Distance at half max should return 0.5"""
        score = SimilarProductsMatcher.calculate_distance_score(5, max_distance=10)
        assert score == 0.5

    def test_distance_score_beyond_max(self):
        """Distance beyond max should return 0 (not negative)"""
        score = SimilarProductsMatcher.calculate_distance_score(15, max_distance=10)
        assert score == 0

    def test_distance_score_none(self):
        """None distance should return 0.5"""
        score = SimilarProductsMatcher.calculate_distance_score(None)
        assert score == 0.5

    # Freshness Score Tests
    def test_freshness_score_exact_match(self):
        """Same days until expiry should return 1.0"""
        score = SimilarProductsMatcher.calculate_freshness_score(5, 5)
        assert score == 1.0

    def test_freshness_score_within_tolerance(self):
        """Days within 7-day tolerance should return positive score"""
        score = SimilarProductsMatcher.calculate_freshness_score(5, 8)
        assert 0 < score < 1

    def test_freshness_score_outside_tolerance(self):
        """Days outside 7-day tolerance should return 0"""
        score = SimilarProductsMatcher.calculate_freshness_score(5, 15)
        assert score == 0

    def test_freshness_score_none_target(self):
        """None target days should return 0.5"""
        score = SimilarProductsMatcher.calculate_freshness_score(None, 5)
        assert score == 0.5

    def test_freshness_score_none_candidate(self):
        """None candidate days should return 0.5"""
        score = SimilarProductsMatcher.calculate_freshness_score(5, None)
        assert score == 0.5

    # Text Similarity Tests
    def test_text_similarity_identical(self):
        """Identical texts should have high similarity"""
        texts = ['fresh organic apples', 'fresh organic apples']
        matrix = SimilarProductsMatcher.calculate_text_similarity(texts)
        assert matrix[0, 1] > 0.9

    def test_text_similarity_different(self):
        """Different texts should have lower similarity"""
        texts = ['fresh organic apples', 'frozen pizza']
        matrix = SimilarProductsMatcher.calculate_text_similarity(texts)
        assert matrix[0, 1] < 0.5

    def test_text_similarity_single_text(self):
        """Single text should return 1x1 matrix with 1.0"""
        texts = ['only one text']
        matrix = SimilarProductsMatcher.calculate_text_similarity(texts)
        assert matrix.shape == (1, 1)
        assert matrix[0, 0] == 1.0

    def test_text_similarity_empty_strings(self):
        """Empty strings should be handled gracefully"""
        texts = ['', '', 'some text']
        matrix = SimilarProductsMatcher.calculate_text_similarity(texts)
        assert matrix.shape == (3, 3)

    # Find Similar Tests
    def test_find_similar_empty_candidates(self):
        """Empty candidates should return empty list"""
        result = SimilarProductsMatcher.find_similar({'id': 1}, [])
        assert result == []

    def test_find_similar_excludes_same_id(self, sample_target):
        """Should exclude candidate with same ID as target"""
        candidates = [{'id': 1, 'sellerId': 2, 'title': 'Same ID', 'category': 'produce', 'price': 5.0}]
        result = SimilarProductsMatcher.find_similar(sample_target, candidates)
        assert len(result) == 0

    def test_find_similar_excludes_same_seller(self, sample_target, sample_candidates):
        """Should exclude candidates from same seller"""
        result = SimilarProductsMatcher.find_similar(sample_target, sample_candidates)
        seller_ids = [r['sellerId'] for r in result]
        assert sample_target['sellerId'] not in seller_ids

    def test_find_similar_respects_limit(self, sample_target, sample_candidates):
        """Should respect the limit parameter"""
        result = SimilarProductsMatcher.find_similar(sample_target, sample_candidates, limit=1)
        assert len(result) <= 1

    def test_find_similar_returns_sorted_by_score(self, sample_target, sample_candidates):
        """Results should be sorted by similarity score descending"""
        result = SimilarProductsMatcher.find_similar(sample_target, sample_candidates)
        if len(result) > 1:
            scores = [r['similarity_score'] for r in result]
            assert scores == sorted(scores, reverse=True)

    def test_find_similar_includes_match_factors(self, sample_target, sample_candidates):
        """Results should include match_factors breakdown"""
        result = SimilarProductsMatcher.find_similar(sample_target, sample_candidates)
        if result:
            assert 'match_factors' in result[0]
            factors = result[0]['match_factors']
            assert all(k in factors for k in ['category', 'text', 'price', 'distance', 'freshness'])


# ============================================================================
# PriceRecommender Tests
# ============================================================================

class TestPriceRecommender:
    """Tests for PriceRecommender class"""

    # Days Until Expiry Tests
    def test_days_until_expiry_future_date(self):
        """Future date should return positive days"""
        future_date = (datetime.now() + timedelta(days=10)).strftime('%Y-%m-%d')
        days = PriceRecommender.calculate_days_until_expiry(future_date)
        assert 9 <= days <= 10

    def test_days_until_expiry_past_date(self):
        """Past date should return 0 (not negative)"""
        past_date = (datetime.now() - timedelta(days=5)).strftime('%Y-%m-%d')
        days = PriceRecommender.calculate_days_until_expiry(past_date)
        assert days == 0

    def test_days_until_expiry_today(self):
        """Today's date should return 0"""
        today = datetime.now().strftime('%Y-%m-%d')
        days = PriceRecommender.calculate_days_until_expiry(today)
        assert days == 0

    def test_days_until_expiry_iso_format(self):
        """ISO format with time should be parsed correctly"""
        future_date = (datetime.now() + timedelta(days=5)).isoformat()
        days = PriceRecommender.calculate_days_until_expiry(future_date)
        assert 4 <= days <= 5

    def test_days_until_expiry_with_z_suffix(self):
        """ISO format with Z suffix should be parsed correctly"""
        future_date = (datetime.now() + timedelta(days=5)).strftime('%Y-%m-%dT%H:%M:%SZ')
        days = PriceRecommender.calculate_days_until_expiry(future_date)
        assert 4 <= days <= 5

    def test_days_until_expiry_empty_string(self):
        """Empty string should return default 30 days"""
        days = PriceRecommender.calculate_days_until_expiry('')
        assert days == 30

    def test_days_until_expiry_none(self):
        """None should return default 30 days"""
        days = PriceRecommender.calculate_days_until_expiry(None)
        assert days == 30

    def test_days_until_expiry_invalid_format(self):
        """Invalid format should return default 30 days"""
        days = PriceRecommender.calculate_days_until_expiry('not-a-date')
        assert days == 30

    # Discount Tier Tests
    def test_get_discount_tier_expiring_today(self):
        """Expiring today should get highest discount tier"""
        tier = PriceRecommender.get_discount_tier(0)
        assert tier['max_days'] == 1
        assert tier['min_discount'] == 0.50

    def test_get_discount_tier_expiring_tomorrow(self):
        """Expiring tomorrow should get highest discount tier"""
        tier = PriceRecommender.get_discount_tier(1)
        assert tier['max_days'] == 1

    def test_get_discount_tier_this_week(self):
        """Expiring this week should get medium-high discount"""
        tier = PriceRecommender.get_discount_tier(5)
        assert tier['label'] == 'Expiring this week'

    def test_get_discount_tier_long_shelf_life(self):
        """Long shelf life should get lowest discount"""
        tier = PriceRecommender.get_discount_tier(60)
        assert tier['label'] == 'Long shelf life'
        assert tier['min_discount'] == 0.00

    # Calculate Tests
    def test_calculate_returns_required_fields(self):
        """Calculate should return all required fields"""
        result = PriceRecommender.calculate(10.0, '2026-02-10', 'dairy')
        required_fields = [
            'recommended_price', 'min_price', 'max_price', 'original_price',
            'discount_percentage', 'days_until_expiry', 'category',
            'urgency_label', 'reasoning'
        ]
        assert all(field in result for field in required_fields)

    def test_calculate_invalid_price_zero(self):
        """Zero price should return error"""
        result = PriceRecommender.calculate(0, '2026-02-10', 'dairy')
        assert 'error' in result

    def test_calculate_invalid_price_negative(self):
        """Negative price should return error"""
        result = PriceRecommender.calculate(-10.0, '2026-02-10', 'dairy')
        assert 'error' in result

    def test_calculate_price_floor(self):
        """Recommended price should not go below 25% of original"""
        # Use expiring today for maximum discount
        today = datetime.now().strftime('%Y-%m-%d')
        result = PriceRecommender.calculate(100.0, today, 'seafood')
        assert result['recommended_price'] >= 25.0
        assert result['min_price'] >= 25.0

    def test_calculate_recommended_price_less_than_original(self):
        """Recommended price should always be less than or equal to original"""
        result = PriceRecommender.calculate(10.0, '2026-12-31', 'canned')
        assert result['recommended_price'] <= result['original_price']

    def test_calculate_min_less_than_max(self):
        """Min price should be less than or equal to max price"""
        result = PriceRecommender.calculate(10.0, '2026-02-10', 'dairy')
        assert result['min_price'] <= result['max_price']

    def test_calculate_category_affects_discount(self):
        """More perishable categories should have higher discounts"""
        date = (datetime.now() + timedelta(days=5)).strftime('%Y-%m-%d')
        seafood = PriceRecommender.calculate(10.0, date, 'seafood')
        canned = PriceRecommender.calculate(10.0, date, 'canned')
        assert seafood['discount_percentage'] > canned['discount_percentage']

    def test_calculate_unknown_category(self):
        """Unknown category should use 'other' defaults"""
        result = PriceRecommender.calculate(10.0, '2026-02-10', 'unknown_category')
        assert result['category'] == 'unknown_category'
        assert 'error' not in result

    def test_calculate_none_category(self):
        """None category should use 'other' defaults"""
        result = PriceRecommender.calculate(10.0, '2026-02-10', None)
        assert result['category'] == 'other'

    def test_calculate_reasoning_not_empty(self):
        """Reasoning should not be empty"""
        result = PriceRecommender.calculate(10.0, '2026-02-10', 'dairy')
        assert len(result['reasoning']) > 0

    def test_calculate_discount_percentage_reasonable(self):
        """Discount percentage should be between 0 and 75"""
        result = PriceRecommender.calculate(10.0, '2026-02-10', 'dairy')
        assert 0 <= result['discount_percentage'] <= 75


# ============================================================================
# API Endpoint Tests
# ============================================================================

class TestPriceRecommendationAPI:
    """Tests for /api/v1/recommendations/price endpoint"""

    def test_price_recommendation_success(self, client):
        """Valid request should return recommendation"""
        response = client.post(
            '/api/v1/recommendations/price',
            json={'original_price': 10.0, 'expiry_date': '2026-02-10', 'category': 'dairy'},
            content_type='application/json'
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'recommended_price' in data

    def test_price_recommendation_missing_price(self, client):
        """Missing original_price should return 400"""
        response = client.post(
            '/api/v1/recommendations/price',
            json={'expiry_date': '2026-02-10', 'category': 'dairy'},
            content_type='application/json'
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data

    def test_price_recommendation_invalid_price_type(self, client):
        """Non-numeric price should return 400"""
        response = client.post(
            '/api/v1/recommendations/price',
            json={'original_price': 'not-a-number', 'category': 'dairy'},
            content_type='application/json'
        )
        assert response.status_code == 400

    def test_price_recommendation_optional_fields(self, client):
        """Request with only required fields should succeed"""
        response = client.post(
            '/api/v1/recommendations/price',
            json={'original_price': 10.0},
            content_type='application/json'
        )
        assert response.status_code == 200


class TestSimilarProductsAPI:
    """Tests for /api/v1/recommendations/similar endpoint"""

    def test_similar_products_success(self, client, sample_target, sample_candidates):
        """Valid request should return similar products"""
        response = client.post(
            '/api/v1/recommendations/similar',
            json={'target': sample_target, 'candidates': sample_candidates},
            content_type='application/json'
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'similar_products' in data
        assert 'count' in data
        assert 'generated_at' in data

    def test_similar_products_missing_target(self, client, sample_candidates):
        """Missing target should return 400"""
        response = client.post(
            '/api/v1/recommendations/similar',
            json={'candidates': sample_candidates},
            content_type='application/json'
        )
        assert response.status_code == 400

    def test_similar_products_missing_candidates(self, client, sample_target):
        """Missing candidates should return 400"""
        response = client.post(
            '/api/v1/recommendations/similar',
            json={'target': sample_target},
            content_type='application/json'
        )
        assert response.status_code == 400

    def test_similar_products_empty_candidates(self, client, sample_target):
        """Empty candidates list should return empty results"""
        response = client.post(
            '/api/v1/recommendations/similar',
            json={'target': sample_target, 'candidates': []},
            content_type='application/json'
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['similar_products'] == []
        assert data['count'] == 0

    def test_similar_products_with_limit(self, client, sample_target, sample_candidates):
        """Limit parameter should be respected"""
        response = client.post(
            '/api/v1/recommendations/similar',
            json={'target': sample_target, 'candidates': sample_candidates, 'limit': 1},
            content_type='application/json'
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data['similar_products']) <= 1


# ============================================================================
# Edge Case Tests
# ============================================================================

class TestEdgeCases:
    """Tests for edge cases and boundary conditions"""

    def test_very_large_price(self):
        """Very large price should be handled correctly"""
        result = PriceRecommender.calculate(1000000.0, '2026-02-10', 'dairy')
        assert result['recommended_price'] > 0
        assert result['recommended_price'] < 1000000.0

    def test_very_small_price(self):
        """Very small price should be handled correctly"""
        result = PriceRecommender.calculate(0.01, '2026-02-10', 'dairy')
        assert result['recommended_price'] >= 0

    def test_price_score_with_very_different_prices(self):
        """Very different prices should not cause issues"""
        score = SimilarProductsMatcher.calculate_price_score(0.01, 1000000.0)
        assert score == 0

    def test_text_similarity_with_unicode(self):
        """Unicode text should be handled correctly"""
        texts = ['Fresh apples', 'Manzanas frescas']
        matrix = SimilarProductsMatcher.calculate_text_similarity(texts)
        assert matrix.shape == (2, 2)

    def test_text_similarity_with_special_characters(self):
        """Special characters should be handled correctly"""
        texts = ['Price: $5.00!!!', 'Cost: $5.00???']
        matrix = SimilarProductsMatcher.calculate_text_similarity(texts)
        assert matrix.shape == (2, 2)

    def test_many_candidates(self):
        """Large number of candidates should be handled"""
        target = {'id': 0, 'sellerId': 0, 'title': 'Test', 'category': 'produce', 'price': 5.0}
        candidates = [
            {'id': i, 'sellerId': i, 'title': f'Item {i}', 'category': 'produce', 'price': 5.0}
            for i in range(1, 101)
        ]
        result = SimilarProductsMatcher.find_similar(target, candidates, limit=10)
        assert len(result) <= 10


# ============================================================================
# Weights Validation Tests
# ============================================================================

class TestWeightsValidation:
    """Tests to verify weights sum to 1.0"""

    def test_similarity_weights_sum_to_one(self):
        """SimilarProductsMatcher weights should sum to 1.0"""
        total = sum(SimilarProductsMatcher.WEIGHTS.values())
        assert abs(total - 1.0) < 0.001

    def test_discount_tiers_are_ordered(self):
        """Discount tiers should be in ascending order of max_days"""
        tiers = PriceRecommender.DISCOUNT_TIERS
        for i in range(len(tiers) - 1):
            assert tiers[i]['max_days'] < tiers[i + 1]['max_days']

    def test_discount_tiers_increase_with_urgency(self):
        """Higher urgency should have higher discounts"""
        tiers = PriceRecommender.DISCOUNT_TIERS
        for i in range(len(tiers) - 1):
            # Items expiring sooner should have higher min_discount
            assert tiers[i]['min_discount'] >= tiers[i + 1]['min_discount']


class TestConstants:
    """Tests for configuration constants"""

    def test_similarity_threshold_reasonable(self):
        """Similarity threshold should be between 0 and 1"""
        assert 0 < SIMILARITY_THRESHOLD < 1

    def test_max_candidates_reasonable(self):
        """Max candidates should be reasonable"""
        assert MAX_CANDIDATES > 0
        assert MAX_CANDIDATES <= 1000

    def test_max_result_limit_reasonable(self):
        """Max result limit should be reasonable"""
        assert MAX_RESULT_LIMIT > 0
        assert MAX_RESULT_LIMIT <= 100

    def test_default_neutral_score_is_half(self):
        """Default neutral score should be 0.5"""
        assert DEFAULT_NEUTRAL_SCORE == 0.5

    def test_max_discount_cap_reasonable(self):
        """Max discount should not exceed 100%"""
        assert 0 < MAX_DISCOUNT_CAP <= 1.0

    def test_price_floor_ratio_reasonable(self):
        """Price floor should be positive and less than 1"""
        assert 0 < PRICE_FLOOR_RATIO < 1


class TestInputLimits:
    """Tests for input size limits"""

    def test_candidates_truncated_to_limit(self):
        """Candidates exceeding MAX_CANDIDATES should be truncated"""
        target = {'id': 0, 'sellerId': 0, 'title': 'Test', 'category': 'produce', 'price': 5.0}
        # Create more candidates than MAX_CANDIDATES
        candidates = [
            {'id': i, 'sellerId': i, 'title': f'Item {i}', 'category': 'produce', 'price': 5.0}
            for i in range(1, MAX_CANDIDATES + 100)
        ]
        # Should not raise an error, just truncate
        result = SimilarProductsMatcher.find_similar(target, candidates, limit=10)
        assert len(result) <= 10

    def test_result_limit_enforced(self):
        """Results should respect MAX_RESULT_LIMIT even if higher limit requested"""
        target = {'id': 0, 'sellerId': 0, 'title': 'Test', 'category': 'produce', 'price': 5.0}
        candidates = [
            {'id': i, 'sellerId': i, 'title': f'Item {i}', 'category': 'produce', 'price': 5.0}
            for i in range(1, 101)
        ]
        result = SimilarProductsMatcher.find_similar(target, candidates, limit=1000)
        assert len(result) <= MAX_RESULT_LIMIT


class TestAPIValidation:
    """Tests for API input validation"""

    def test_price_recommendation_no_body(self, client):
        """Missing request body should return 400"""
        response = client.post(
            '/api/v1/recommendations/price',
            content_type='application/json'
        )
        assert response.status_code == 400

    def test_similar_products_no_body(self, client):
        """Missing request body should return 400"""
        response = client.post(
            '/api/v1/recommendations/similar',
            content_type='application/json'
        )
        assert response.status_code == 400

    def test_similar_products_candidates_not_array(self, client, sample_target):
        """Candidates as non-array should return 400"""
        response = client.post(
            '/api/v1/recommendations/similar',
            json={'target': sample_target, 'candidates': 'not-an-array'},
            content_type='application/json'
        )
        assert response.status_code == 400

    def test_similar_products_null_candidates(self, client, sample_target):
        """Null candidates should return 400"""
        response = client.post(
            '/api/v1/recommendations/similar',
            json={'target': sample_target, 'candidates': None},
            content_type='application/json'
        )
        assert response.status_code == 400
