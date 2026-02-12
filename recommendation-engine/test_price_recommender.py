"""Tests for PriceRecommender - price recommendation based on expiry and category."

this is for testing the price recommendation""

from app import PriceRecommender, PRICE_FLOOR_RATIO, MAX_DISCOUNT_CAP
from conftest import days_from_now


# ── calculate_days_until_expiry ───────────────────────────────────────────────


class TestDaysUntilExpiry:

    def test_future_date(self):
        """Date 10 days from now returns approximately 10"""
        days = PriceRecommender.calculate_days_until_expiry(days_from_now(10))
        assert 9 <= days <= 10

    def test_past_date_returns_zero(self):
        """Past date returns 0 (clamped to minimum)"""
        days = PriceRecommender.calculate_days_until_expiry(days_from_now(-5))
        assert days == 0

    def test_none_returns_default(self):
        """None expiry returns default 30 days"""
        days = PriceRecommender.calculate_days_until_expiry(None)
        assert days == 30

    def test_plain_date_format(self):
        """YYYY-MM-DD format is parsed correctly"""
        days = PriceRecommender.calculate_days_until_expiry("2099-12-31")
        assert days > 100

    def test_invalid_date_returns_default(self):
        """Invalid date string returns default 30 days"""
        days = PriceRecommender.calculate_days_until_expiry("not-a-date")
        assert days == 30


# ── get_discount_tier ─────────────────────────────────────────────────────────


class TestDiscountTier:

    def test_expiring_today(self):
        """0 days falls in first tier (today/tomorrow)"""
        tier = PriceRecommender.get_discount_tier(0)
        assert tier['max_days'] == 1

    def test_expiring_in_5_days(self):
        """5 days falls in 'Expiring this week' tier"""
        tier = PriceRecommender.get_discount_tier(5)
        assert tier['max_days'] == 7

    def test_expiring_in_10_days(self):
        """10 days falls in '1-2 weeks' tier"""
        tier = PriceRecommender.get_discount_tier(10)
        assert tier['max_days'] == 14

    def test_long_shelf_life(self):
        """60 days falls in 'Long shelf life' tier"""
        tier = PriceRecommender.get_discount_tier(60)
        assert tier['label'] == 'Long shelf life'


# ── calculate (full price recommendation) ─────────────────────────────────────


class TestCalculate:

    def test_expiring_soon_dairy_high_discount(self):
        """Dairy expiring tomorrow gets high discount (>= 50%)"""
        result = PriceRecommender.calculate(10.0, days_from_now(1), "dairy")
        assert result['discount_percentage'] >= 50
        assert result['recommended_price'] <= 6.0

    def test_long_shelf_life_frozen_low_discount(self):
        """Frozen with 60 days gets low discount (<= 15%)"""
        result = PriceRecommender.calculate(20.0, days_from_now(60), "frozen")
        assert result['discount_percentage'] <= 15
        assert result['recommended_price'] >= 17.0

    def test_price_floor_enforced(self):
        """Price never drops below PRICE_FLOOR_RATIO (25%) of original"""
        result = PriceRecommender.calculate(10.0, days_from_now(0), "seafood")
        floor = 10.0 * PRICE_FLOOR_RATIO
        assert result['recommended_price'] >= floor
        assert result['min_price'] >= floor

    def test_discount_cap_enforced(self):
        """Discount never exceeds MAX_DISCOUNT_CAP (75%)"""
        result = PriceRecommender.calculate(100.0, days_from_now(0), "seafood")
        assert result['discount_percentage'] <= MAX_DISCOUNT_CAP * 100

    def test_no_expiry_uses_default_30_days(self):
        """None expiry date uses 30-day default with low discount"""
        result = PriceRecommender.calculate(15.0, None, "other")
        assert result['days_until_expiry'] == 30
        assert result['discount_percentage'] <= 20

    def test_unknown_category_still_works(self):
        """Unknown category falls back gracefully"""
        result = PriceRecommender.calculate(10.0, days_from_now(5), "xyz_unknown")
        assert 'recommended_price' in result
        assert result['recommended_price'] > 0

    def test_response_contains_all_expected_keys(self):
        """Response contains all expected keys"""
        result = PriceRecommender.calculate(10.0, days_from_now(5), "dairy")
        expected_keys = [
            'recommended_price', 'min_price', 'max_price', 'original_price',
            'discount_percentage', 'days_until_expiry', 'category',
            'urgency_label', 'reasoning'
        ]
        for key in expected_keys:
            assert key in result, f"Missing key: {key}"

    def test_meat_higher_discount_than_canned(self):
        """Meat (perishable) gets higher discount than canned at same expiry"""
        meat = PriceRecommender.calculate(10.0, days_from_now(5), "meat")
        canned = PriceRecommender.calculate(10.0, days_from_now(5), "canned")
        assert meat['discount_percentage'] > canned['discount_percentage']

    def test_invalid_zero_price_returns_error(self):
        """Zero price returns error dict"""
        result = PriceRecommender.calculate(0, days_from_now(5), "dairy")
        assert 'error' in result

    def test_recommended_between_min_and_max(self):
        """Recommended price is between min_price and max_price"""
        result = PriceRecommender.calculate(20.0, days_from_now(5), "produce")
        assert result['min_price'] <= result['recommended_price'] <= result['max_price']

    def test_reasoning_is_non_empty_string(self):
        """Reasoning field is a non-empty human-readable string"""
        result = PriceRecommender.calculate(10.0, days_from_now(3), "dairy")
        assert isinstance(result['reasoning'], str)
        assert len(result['reasoning']) > 10
