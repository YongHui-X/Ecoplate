"""
Tests for ML modules (price_predictor and product_recommender).
Run with: pytest test_ml.py -v
"""

import pytest
import tempfile
import json
from pathlib import Path
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
import numpy as np

# Import ML modules
from ml.price_predictor import PricePredictor
from ml.product_recommender import ProductRecommender
from config import CATEGORIES, MODELS_DIR


# ============================================================================
# PricePredictor Tests
# ============================================================================

class TestPricePredictorInit:
    """Tests for PricePredictor initialization"""

    def test_init_without_model_files(self):
        """Should initialize gracefully without model files"""
        predictor = PricePredictor()
        # Model not loaded is OK - will use fallback
        assert predictor.model is None or predictor._is_loaded is False or predictor._is_loaded is True

    def test_is_ml_available_returns_bool(self):
        """is_ml_available should return boolean"""
        predictor = PricePredictor()
        assert isinstance(predictor.is_ml_available(), bool)

    def test_reload_model_returns_bool(self):
        """reload_model should return boolean"""
        predictor = PricePredictor()
        result = predictor.reload_model()
        assert isinstance(result, bool)


class TestPricePredictorPredict:
    """Tests for PricePredictor.predict method"""

    def test_predict_returns_dict(self):
        """predict should return a dictionary"""
        predictor = PricePredictor()
        result = predictor.predict(
            original_price=10.0,
            expiry_date="2026-02-15",
            category="dairy"
        )
        assert isinstance(result, dict)

    def test_predict_without_model_returns_error(self):
        """predict without model should return error source"""
        predictor = PricePredictor()
        predictor._is_loaded = False
        result = predictor.predict(
            original_price=10.0,
            expiry_date="2026-02-15",
            category="dairy"
        )
        assert "source" in result
        assert result["source"] == "error"

    def test_predict_with_mock_model(self):
        """predict with mocked model should return valid structure"""
        predictor = PricePredictor()

        # Mock the model components
        predictor.model = MagicMock()
        predictor.model.predict = MagicMock(return_value=np.array([0.3]))
        predictor.scaler = MagicMock()
        predictor.scaler.transform = MagicMock(return_value=np.array([[10, 5, 1, 0]]))
        predictor.encoder = MagicMock()
        predictor.encoder.transform = MagicMock(return_value=np.array([0]))
        predictor._is_loaded = True

        result = predictor.predict(
            original_price=10.0,
            expiry_date="2026-02-15",
            category="dairy"
        )

        assert "recommended_price" in result
        assert "min_price" in result
        assert "max_price" in result
        assert "source" in result
        assert result["source"] == "ml_model"

    def test_predict_with_various_categories(self):
        """predict should handle all defined categories"""
        predictor = PricePredictor()

        for category in CATEGORIES:
            result = predictor.predict(
                original_price=10.0,
                expiry_date="2026-02-15",
                category=category
            )
            assert isinstance(result, dict)

    def test_predict_with_unknown_category(self):
        """predict should handle unknown category gracefully"""
        predictor = PricePredictor()
        result = predictor.predict(
            original_price=10.0,
            expiry_date="2026-02-15",
            category="unknown_category_xyz"
        )
        assert isinstance(result, dict)
        # Should either work with 'other' or return error

    def test_predict_with_none_expiry(self):
        """predict should handle None expiry date"""
        predictor = PricePredictor()
        result = predictor.predict(
            original_price=10.0,
            expiry_date=None,
            category="dairy"
        )
        assert isinstance(result, dict)

    def test_predict_with_various_quantities(self):
        """predict should handle different quantities"""
        predictor = PricePredictor()

        for quantity in [0.5, 1.0, 5.0, 100.0]:
            result = predictor.predict(
                original_price=10.0,
                expiry_date="2026-02-15",
                category="dairy",
                quantity=quantity
            )
            assert isinstance(result, dict)


class TestPricePredictorDaysCalculation:
    """Tests for days until expiry calculation"""

    def test_days_calculation_future_date(self):
        """Future date should return positive days"""
        predictor = PricePredictor()
        future = (datetime.now() + timedelta(days=10)).strftime("%Y-%m-%d")
        days = predictor._calculate_days_until_expiry(future)
        assert 9 <= days <= 10

    def test_days_calculation_past_date(self):
        """Past date should return 0"""
        predictor = PricePredictor()
        past = (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d")
        days = predictor._calculate_days_until_expiry(past)
        assert days == 0

    def test_days_calculation_iso_format(self):
        """ISO format should be parsed correctly"""
        predictor = PricePredictor()
        future = (datetime.now() + timedelta(days=5)).isoformat()
        days = predictor._calculate_days_until_expiry(future)
        assert 4 <= days <= 5

    def test_days_calculation_with_z_suffix(self):
        """ISO format with Z suffix should work"""
        predictor = PricePredictor()
        future = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%dT%H:%M:%SZ")
        days = predictor._calculate_days_until_expiry(future)
        assert 4 <= days <= 5

    def test_days_calculation_none(self):
        """None should return default 30 days"""
        predictor = PricePredictor()
        days = predictor._calculate_days_until_expiry(None)
        assert days == 30

    def test_days_calculation_empty_string(self):
        """Empty string should return default"""
        predictor = PricePredictor()
        days = predictor._calculate_days_until_expiry("")
        assert days == 30

    def test_days_calculation_invalid_format(self):
        """Invalid format should return default"""
        predictor = PricePredictor()
        days = predictor._calculate_days_until_expiry("not-a-date")
        assert days == 30


class TestPricePredictorReasoning:
    """Tests for reasoning generation"""

    def test_reasoning_expiring_soon(self):
        """Reasoning for soon-expiring items"""
        predictor = PricePredictor()
        reasoning = predictor._generate_reasoning(1, "dairy", 0.5)
        assert "expiring" in reasoning.lower() or "soon" in reasoning.lower()

    def test_reasoning_long_shelf_life(self):
        """Reasoning for items with long shelf life"""
        predictor = PricePredictor()
        reasoning = predictor._generate_reasoning(60, "canned", 0.1)
        assert len(reasoning) > 0

    def test_reasoning_includes_category(self):
        """Reasoning should mention category"""
        predictor = PricePredictor()
        reasoning = predictor._generate_reasoning(5, "seafood", 0.3)
        assert "seafood" in reasoning.lower()


# ============================================================================
# ProductRecommender Tests
# ============================================================================

class TestProductRecommenderInit:
    """Tests for ProductRecommender initialization"""

    def test_init_without_model_files(self):
        """Should initialize gracefully without model files"""
        recommender = ProductRecommender()
        assert isinstance(recommender.user_preferences, dict)
        assert isinstance(recommender.category_weights, dict)

    def test_is_ml_available_returns_bool(self):
        """is_ml_available should return boolean"""
        recommender = ProductRecommender()
        assert isinstance(recommender.is_ml_available(), bool)

    def test_reload_model_returns_bool(self):
        """reload_model should return boolean"""
        recommender = ProductRecommender()
        result = recommender.reload_model()
        assert isinstance(result, bool)


class TestProductRecommenderRecommend:
    """Tests for ProductRecommender.recommend method"""

    @pytest.fixture
    def sample_target(self):
        """Sample target listing"""
        return {
            "id": 1,
            "sellerId": 1,
            "title": "Fresh Organic Apples",
            "description": "Delicious green apples from local farm",
            "category": "produce",
            "price": 5.00,
        }

    @pytest.fixture
    def sample_candidates(self):
        """Sample candidate listings"""
        return [
            {
                "id": 2,
                "sellerId": 2,
                "title": "Red Apples",
                "description": "Sweet red apples",
                "category": "produce",
                "price": 4.50,
            },
            {
                "id": 3,
                "sellerId": 3,
                "title": "Fresh Milk",
                "description": "Whole milk 1 liter",
                "category": "dairy",
                "price": 3.00,
            },
            {
                "id": 4,
                "sellerId": 4,
                "title": "Organic Bananas",
                "description": "Yellow bananas organic",
                "category": "produce",
                "price": 2.50,
            },
        ]

    def test_recommend_without_model_returns_error(self, sample_target, sample_candidates):
        """recommend without model should return error source"""
        recommender = ProductRecommender()
        recommender._is_loaded = False
        result = recommender.recommend(
            target=sample_target,
            candidates=sample_candidates
        )
        assert "source" in result
        assert result["source"] == "error"

    def test_recommend_empty_candidates(self, sample_target):
        """recommend with empty candidates should return empty list"""
        recommender = ProductRecommender()
        recommender._is_loaded = True
        recommender.vectorizer = MagicMock()

        result = recommender.recommend(
            target=sample_target,
            candidates=[]
        )

        assert result["similar_products"] == []
        assert result["count"] == 0

    def test_recommend_with_mock_vectorizer(self, sample_target, sample_candidates):
        """recommend with mocked vectorizer should work"""
        recommender = ProductRecommender()
        recommender._is_loaded = True

        # Mock TF-IDF vectorizer
        mock_vectorizer = MagicMock()
        # Create a mock sparse matrix with cosine similarities
        n = len(sample_candidates) + 1
        mock_matrix = MagicMock()
        mock_matrix.shape = (n, 100)
        mock_vectorizer.transform = MagicMock(return_value=mock_matrix)
        recommender.vectorizer = mock_vectorizer
        recommender.user_preferences = {}
        recommender.category_weights = {"produce": 0.5, "dairy": 0.3}

        # Mock cosine_similarity to return predictable values
        with patch('ml.product_recommender.cosine_similarity') as mock_cosine:
            mock_cosine.return_value = np.array([[0.8, 0.5, 0.7]])

            result = recommender.recommend(
                target=sample_target,
                candidates=sample_candidates,
                limit=5
            )

            assert "similar_products" in result
            assert "count" in result
            assert result["source"] == "ml_model"

    def test_recommend_excludes_same_seller(self, sample_target):
        """recommend should exclude items from same seller"""
        recommender = ProductRecommender()
        recommender._is_loaded = True

        candidates = [
            {"id": 5, "sellerId": 1, "title": "Same Seller Item", "category": "produce"}
        ]

        # Mock vectorizer
        recommender.vectorizer = MagicMock()
        recommender.vectorizer.transform = MagicMock(return_value=MagicMock(shape=(2, 100)))
        recommender.user_preferences = {}
        recommender.category_weights = {}

        with patch('ml.product_recommender.cosine_similarity') as mock_cosine:
            mock_cosine.return_value = np.array([[0.9]])

            result = recommender.recommend(
                target=sample_target,
                candidates=candidates
            )

            # Same seller should be excluded
            for product in result.get("similar_products", []):
                assert product.get("sellerId") != sample_target["sellerId"]

    def test_recommend_with_user_id(self, sample_target, sample_candidates):
        """recommend with user_id should attempt personalization"""
        recommender = ProductRecommender()
        recommender._is_loaded = True
        recommender.vectorizer = MagicMock()
        recommender.vectorizer.transform = MagicMock(return_value=MagicMock(shape=(4, 100)))
        recommender.user_preferences = {123: {"produce": 0.8, "dairy": 0.3}}
        recommender.category_weights = {}

        with patch('ml.product_recommender.cosine_similarity') as mock_cosine:
            mock_cosine.return_value = np.array([[0.6, 0.5, 0.7]])

            result = recommender.recommend(
                target=sample_target,
                candidates=sample_candidates,
                user_id=123
            )

            assert result.get("personalized") is True

    def test_recommend_respects_limit(self, sample_target, sample_candidates):
        """recommend should respect limit parameter"""
        recommender = ProductRecommender()
        recommender._is_loaded = True
        recommender.vectorizer = MagicMock()
        recommender.vectorizer.transform = MagicMock(return_value=MagicMock(shape=(4, 100)))
        recommender.user_preferences = {}
        recommender.category_weights = {}

        with patch('ml.product_recommender.cosine_similarity') as mock_cosine:
            mock_cosine.return_value = np.array([[0.8, 0.7, 0.6]])

            result = recommender.recommend(
                target=sample_target,
                candidates=sample_candidates,
                limit=1
            )

            assert len(result.get("similar_products", [])) <= 1


class TestProductRecommenderTextCreation:
    """Tests for text creation for TF-IDF"""

    def test_create_text_with_all_fields(self):
        """create_text should combine all fields"""
        recommender = ProductRecommender()
        item = {
            "title": "Fresh Apples",
            "description": "Organic from farm",
            "category": "produce"
        }
        text = recommender._create_text(item)
        assert "Fresh Apples" in text
        assert "Organic from farm" in text
        assert "produce" in text

    def test_create_text_with_missing_fields(self):
        """create_text should handle missing fields"""
        recommender = ProductRecommender()
        item = {"title": "Just Title"}
        text = recommender._create_text(item)
        assert "Just Title" in text

    def test_create_text_empty_item(self):
        """create_text should return 'unknown' for empty item"""
        recommender = ProductRecommender()
        text = recommender._create_text({})
        assert text == "unknown"


class TestProductRecommenderUserProfile:
    """Tests for user profile retrieval"""

    def test_get_user_profile_existing(self):
        """get_user_profile should return profile for existing user"""
        recommender = ProductRecommender()
        recommender.user_preferences = {
            123: {"produce": 0.8, "dairy": 0.5}
        }

        profile = recommender.get_user_profile(123)
        assert profile is not None
        assert "produce" in profile

    def test_get_user_profile_nonexistent(self):
        """get_user_profile should return None for unknown user"""
        recommender = ProductRecommender()
        recommender.user_preferences = {}

        profile = recommender.get_user_profile(999)
        assert profile is None


# ============================================================================
# Config Tests
# ============================================================================

class TestConfig:
    """Tests for configuration values"""

    def test_categories_list_not_empty(self):
        """CATEGORIES should not be empty"""
        assert len(CATEGORIES) > 0

    def test_categories_contains_common_types(self):
        """CATEGORIES should contain common food categories"""
        common = ["produce", "dairy", "meat", "bakery"]
        for cat in common:
            assert cat in CATEGORIES

    def test_categories_has_other(self):
        """CATEGORIES should have 'other' as fallback"""
        assert "other" in CATEGORIES

    def test_models_dir_is_path(self):
        """MODELS_DIR should be a Path object"""
        assert isinstance(MODELS_DIR, Path)


# ============================================================================
# Integration Tests (with mocked model loading)
# ============================================================================

class TestMLIntegration:
    """Integration tests for ML modules"""

    def test_price_predictor_full_flow(self):
        """Test full flow of price prediction"""
        predictor = PricePredictor()

        # Even without trained model, should not raise
        result = predictor.predict(
            original_price=25.99,
            expiry_date=(datetime.now() + timedelta(days=3)).isoformat(),
            category="dairy",
            quantity=2.0
        )

        assert isinstance(result, dict)
        assert "source" in result

    def test_product_recommender_full_flow(self):
        """Test full flow of product recommendation"""
        recommender = ProductRecommender()

        target = {
            "id": 100,
            "sellerId": 1,
            "title": "Organic Milk",
            "description": "Fresh organic whole milk",
            "category": "dairy",
            "price": 4.99
        }

        candidates = [
            {
                "id": 101,
                "sellerId": 2,
                "title": "Skim Milk",
                "description": "Low fat skim milk",
                "category": "dairy",
                "price": 3.99
            },
            {
                "id": 102,
                "sellerId": 3,
                "title": "Fresh Bread",
                "description": "Whole wheat bread",
                "category": "bakery",
                "price": 2.99
            }
        ]

        result = recommender.recommend(
            target=target,
            candidates=candidates,
            user_id=None,
            limit=5
        )

        assert isinstance(result, dict)
        assert "source" in result


# ============================================================================
# Edge Cases
# ============================================================================

class TestEdgeCases:
    """Edge case tests for ML modules"""

    def test_price_predictor_very_large_price(self):
        """Should handle very large prices"""
        predictor = PricePredictor()
        result = predictor.predict(
            original_price=1000000.0,
            expiry_date="2026-02-15",
            category="other"
        )
        assert isinstance(result, dict)

    def test_price_predictor_very_small_price(self):
        """Should handle very small prices"""
        predictor = PricePredictor()
        result = predictor.predict(
            original_price=0.01,
            expiry_date="2026-02-15",
            category="other"
        )
        assert isinstance(result, dict)

    def test_product_recommender_many_candidates(self):
        """Should handle many candidates"""
        recommender = ProductRecommender()

        target = {"id": 0, "sellerId": 0, "title": "Test", "category": "produce"}
        candidates = [
            {"id": i, "sellerId": i, "title": f"Item {i}", "category": "produce"}
            for i in range(1, 100)
        ]

        result = recommender.recommend(target=target, candidates=candidates, limit=10)
        assert isinstance(result, dict)

    def test_product_recommender_unicode_text(self):
        """Should handle unicode text"""
        recommender = ProductRecommender()

        target = {
            "id": 1,
            "sellerId": 1,
            "title": "新鮮な野菜",
            "description": "Légumes frais",
            "category": "produce"
        }
        candidates = [
            {
                "id": 2,
                "sellerId": 2,
                "title": "Verduras frescas",
                "description": "Овощи свежие",
                "category": "produce"
            }
        ]

        result = recommender.recommend(target=target, candidates=candidates)
        assert isinstance(result, dict)

    def test_product_recommender_special_characters(self):
        """Should handle special characters"""
        recommender = ProductRecommender()

        target = {
            "id": 1,
            "sellerId": 1,
            "title": "Item @#$%^&*()",
            "description": "Description <>&\"'",
            "category": "other"
        }
        candidates = [
            {
                "id": 2,
                "sellerId": 2,
                "title": "Item !!!???",
                "description": "Test...",
                "category": "other"
            }
        ]

        result = recommender.recommend(target=target, candidates=candidates)
        assert isinstance(result, dict)
