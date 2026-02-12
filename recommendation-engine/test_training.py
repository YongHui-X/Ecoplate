"""
Tests for the training modules: data_collector, price_trainer, recommendation_trainer,

train all test data
"""

import json
import os
import sqlite3
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch, Mock
import shutil

import numpy as np
import pandas as pd
import pytest

from training.data_collector import DataCollector
from training.price_trainer import PriceModelTrainer
from training.recommendation_trainer import RecommendationModelTrainer
from training.train_all import train_all_models, main


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def temp_db():
    """Create a temporary SQLite database with test data."""
    fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(fd)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Create tables
    cursor.execute("""
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            name TEXT,
            email TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE products (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            product_name TEXT,
            category TEXT,
            description TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE marketplace_listings (
            id INTEGER PRIMARY KEY,
            seller_id INTEGER,
            title TEXT,
            description TEXT,
            category TEXT,
            quantity INTEGER,
            unit TEXT,
            price REAL,
            original_price REAL,
            expiry_date REAL,
            status TEXT,
            created_at TEXT,
            completed_at TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE product_sustainability_metrics (
            id INTEGER PRIMARY KEY,
            product_id INTEGER,
            user_id INTEGER,
            today_date TEXT,
            quantity INTEGER,
            type TEXT
        )
    """)

    # Insert test users
    for i in range(1, 6):
        cursor.execute(
            "INSERT INTO users (id, name, email) VALUES (?, ?, ?)",
            (i, f"User {i}", f"user{i}@test.com")
        )

    # Insert test products
    categories = ["produce", "dairy", "meat", "bakery", "frozen"]
    for i in range(1, 21):
        cursor.execute(
            "INSERT INTO products (id, user_id, product_name, category, description) VALUES (?, ?, ?, ?, ?)",
            (i, (i % 5) + 1, f"Product {i}", categories[i % 5], f"Description for product {i}")
        )

    # Insert marketplace listings (mix of sold and active)
    now = datetime.now()
    for i in range(1, 101):
        expiry_ts = (now + timedelta(days=(i % 30) + 1)).timestamp()
        original_price = 10.0 + (i % 20)
        discount = 0.1 + (i % 5) * 0.05
        price = original_price * (1 - discount)
        status = "sold" if i <= 60 else "active"

        cursor.execute("""
            INSERT INTO marketplace_listings
            (id, seller_id, title, description, category, quantity, unit, price, original_price, expiry_date, status, created_at, completed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            i,
            (i % 5) + 1,
            f"Listing {i}",
            f"Description for listing {i}",
            categories[i % 5],
            (i % 5) + 1,
            "kg",
            round(price, 2),
            round(original_price, 2),
            expiry_ts,
            status,
            now.isoformat(),
            now.isoformat() if status == "sold" else None
        ))

    # Insert sustainability metrics
    action_types = ["consumed", "shared", "sold", "wasted"]
    for i in range(1, 51):
        cursor.execute("""
            INSERT INTO product_sustainability_metrics
            (id, product_id, user_id, today_date, quantity, type)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            i,
            (i % 20) + 1,
            (i % 5) + 1,
            now.isoformat(),
            (i % 3) + 1,
            action_types[i % 4]
        ))

    conn.commit()
    conn.close()

    yield db_path

    # Cleanup
    os.unlink(db_path)


@pytest.fixture
def temp_db_minimal():
    """Create a minimal database with insufficient data for training."""
    fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(fd)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)")
    cursor.execute("CREATE TABLE products (id INTEGER PRIMARY KEY, user_id INTEGER, product_name TEXT, category TEXT, description TEXT)")
    cursor.execute("""
        CREATE TABLE marketplace_listings (
            id INTEGER PRIMARY KEY, seller_id INTEGER, title TEXT, description TEXT,
            category TEXT, quantity INTEGER, unit TEXT, price REAL, original_price REAL,
            expiry_date REAL, status TEXT, created_at TEXT, completed_at TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE product_sustainability_metrics (
            id INTEGER PRIMARY KEY, product_id INTEGER, user_id INTEGER,
            today_date TEXT, quantity INTEGER, type TEXT
        )
    """)

    # Insert minimal data (not enough for training)
    cursor.execute("INSERT INTO users (id, name, email) VALUES (1, 'User 1', 'user1@test.com')")
    cursor.execute("INSERT INTO products (id, user_id, product_name, category, description) VALUES (1, 1, 'Product 1', 'produce', 'desc')")

    # Only 5 sold listings (below MIN_PRICE_TRAINING_SAMPLES=50)
    now = datetime.now()
    for i in range(1, 6):
        cursor.execute("""
            INSERT INTO marketplace_listings
            (id, seller_id, title, description, category, quantity, unit, price, original_price, expiry_date, status, created_at, completed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (i, 1, f"Listing {i}", "desc", "produce", 1, "kg", 8.0, 10.0, now.timestamp(), "sold", now.isoformat(), now.isoformat()))

    conn.commit()
    conn.close()

    yield db_path
    os.unlink(db_path)


@pytest.fixture
def temp_output_dirs():
    """Create temporary directories for models and reports."""
    temp_dir = tempfile.mkdtemp()
    models_dir = Path(temp_dir) / "models"
    reports_dir = Path(temp_dir) / "reports"
    models_dir.mkdir()
    reports_dir.mkdir()

    yield models_dir, reports_dir

    shutil.rmtree(temp_dir)


# ============================================================================
# DataCollector Tests
# ============================================================================

class TestDataCollector:
    """Tests for DataCollector class."""

    def test_init_valid_db(self, temp_db):
        """Test initialization with valid database path."""
        collector = DataCollector(temp_db)
        assert collector.db_path == Path(temp_db)

    def test_init_invalid_db(self):
        """Test initialization with non-existent database raises error."""
        with pytest.raises(FileNotFoundError, match="Database not found"):
            DataCollector("/nonexistent/path/db.sqlite")

    def test_get_connection(self, temp_db):
        """Test database connection creation."""
        collector = DataCollector(temp_db)
        conn = collector._get_connection()

        assert conn is not None
        # Verify row_factory is set
        cursor = conn.execute("SELECT 1 as test")
        row = cursor.fetchone()
        assert row["test"] == 1
        conn.close()

    def test_get_price_training_data(self, temp_db):
        """Test fetching price training data."""
        collector = DataCollector(temp_db)
        df = collector.get_price_training_data()

        assert not df.empty
        assert "discount_ratio" in df.columns
        assert "days_until_expiry" in df.columns
        assert "category" in df.columns
        assert "original_price" in df.columns
        assert "price" in df.columns

        # Check discount_ratio is in valid range
        assert df["discount_ratio"].min() >= 0
        assert df["discount_ratio"].max() <= 1

    def test_get_price_training_data_empty_db(self, temp_db_minimal):
        """Test price data with minimal database."""
        collector = DataCollector(temp_db_minimal)
        df = collector.get_price_training_data()

        # Should still return data, just not enough for training
        assert len(df) < 50  # Below MIN_PRICE_TRAINING_SAMPLES

    def test_get_recommendation_training_data(self, temp_db):
        """Test fetching recommendation training data."""
        collector = DataCollector(temp_db)
        products_df, interactions_df, listings_df = collector.get_recommendation_training_data()

        assert not products_df.empty
        assert not listings_df.empty
        assert "product_name" in products_df.columns
        assert "title" in listings_df.columns

    def test_get_user_category_preferences(self, temp_db):
        """Test calculating user category preferences."""
        collector = DataCollector(temp_db)
        prefs = collector.get_user_category_preferences()

        assert isinstance(prefs, dict)
        # Check preferences are normalized
        for user_id, user_prefs in prefs.items():
            assert isinstance(user_prefs, dict)
            for category, weight in user_prefs.items():
                assert 0 <= weight <= 1

    def test_get_user_category_preferences_empty(self, temp_db_minimal):
        """Test user preferences with no interaction data."""
        collector = DataCollector(temp_db_minimal)
        prefs = collector.get_user_category_preferences()

        assert prefs == {}

    def test_get_data_summary(self, temp_db):
        """Test data summary generation."""
        collector = DataCollector(temp_db)
        summary = collector.get_data_summary()

        assert "total_users" in summary
        assert "listings_by_status" in summary
        assert "listings_with_prices" in summary
        assert "sold_listings" in summary
        assert "total_interactions" in summary
        assert "users_with_interactions" in summary
        assert "total_products" in summary

        assert summary["total_users"] == 5
        assert summary["total_products"] == 20


# ============================================================================
# PriceModelTrainer Tests
# ============================================================================

class TestPriceModelTrainer:
    """Tests for PriceModelTrainer class."""

    def test_init(self, temp_db):
        """Test trainer initialization."""
        trainer = PriceModelTrainer(temp_db)

        assert trainer.data_collector is not None
        assert trainer.model is None
        assert trainer.scaler is None
        assert trainer.encoder is None

    def test_prepare_features(self, temp_db):
        """Test feature preparation."""
        trainer = PriceModelTrainer(temp_db)
        df = trainer.data_collector.get_price_training_data()

        X, y = trainer.prepare_features(df)

        assert X.shape[0] == len(df)
        assert X.shape[1] == 4  # original_price, days_until_expiry, quantity, category_encoded
        assert len(y) == len(df)
        assert trainer.scaler is not None
        assert trainer.encoder is not None

    def test_train_success(self, temp_db, temp_output_dirs):
        """Test successful model training."""
        models_dir, reports_dir = temp_output_dirs

        with patch("training.price_trainer.MODELS_DIR", models_dir), \
             patch("training.price_trainer.REPORTS_DIR", reports_dir):

            trainer = PriceModelTrainer(temp_db)
            results = trainer.train(use_sold_only=True)

        assert results["success"] is True
        assert "metrics" in results
        assert "rmse" in results["metrics"]
        assert "mae" in results["metrics"]
        assert "r2_score" in results["metrics"]
        assert "feature_importance" in results
        assert trainer.model is not None

    def test_train_insufficient_data(self, temp_db_minimal, temp_output_dirs):
        """Test training with insufficient data."""
        models_dir, reports_dir = temp_output_dirs

        with patch("training.price_trainer.MODELS_DIR", models_dir), \
             patch("training.price_trainer.REPORTS_DIR", reports_dir):

            trainer = PriceModelTrainer(temp_db_minimal)
            results = trainer.train(use_sold_only=True)

        assert results["success"] is False
        assert "error" in results
        assert "Insufficient" in results["error"]

    def test_train_use_all_listings(self, temp_db, temp_output_dirs):
        """Test training with all listings (not just sold)."""
        models_dir, reports_dir = temp_output_dirs

        with patch("training.price_trainer.MODELS_DIR", models_dir), \
             patch("training.price_trainer.REPORTS_DIR", reports_dir):

            trainer = PriceModelTrainer(temp_db)
            results = trainer.train(use_sold_only=False)

        assert results["success"] is True
        assert results["training_samples"] == 100  # All listings

    def test_save_model(self, temp_db, temp_output_dirs):
        """Test model saving."""
        models_dir, reports_dir = temp_output_dirs

        with patch("training.price_trainer.MODELS_DIR", models_dir), \
             patch("training.price_trainer.REPORTS_DIR", reports_dir):

            trainer = PriceModelTrainer(temp_db)
            trainer.train(use_sold_only=True)

            result = trainer.save_model()

        assert result is True
        assert (models_dir / "price_model.joblib").exists()
        assert (models_dir / "price_scaler.joblib").exists()
        assert (models_dir / "price_encoder.joblib").exists()

    def test_save_model_without_training(self, temp_db, temp_output_dirs):
        """Test save_model fails without training."""
        models_dir, reports_dir = temp_output_dirs

        with patch("training.price_trainer.MODELS_DIR", models_dir):
            trainer = PriceModelTrainer(temp_db)
            result = trainer.save_model()

        assert result is False

    def test_generate_report(self, temp_db, temp_output_dirs):
        """Test report generation."""
        models_dir, reports_dir = temp_output_dirs

        with patch("training.price_trainer.MODELS_DIR", models_dir), \
             patch("training.price_trainer.REPORTS_DIR", reports_dir):

            trainer = PriceModelTrainer(temp_db)
            results = trainer.train(use_sold_only=True)
            report_path = trainer.generate_report(results)

        assert Path(report_path).exists()

        with open(report_path) as f:
            report = json.load(f)

        assert "training_id" in report
        assert "timestamp" in report
        assert "model_type" in report
        assert report["model_type"] == "price_optimization"


# ============================================================================
# RecommendationModelTrainer Tests
# ============================================================================

class TestRecommendationModelTrainer:
    """Tests for RecommendationModelTrainer class."""

    def test_init(self, temp_db):
        """Test trainer initialization."""
        trainer = RecommendationModelTrainer(temp_db)

        assert trainer.data_collector is not None
        assert trainer.vectorizer is None
        assert trainer.user_preferences == {}
        assert trainer.category_weights == {}

    def test_create_product_text(self, temp_db):
        """Test product text creation for TF-IDF."""
        trainer = RecommendationModelTrainer(temp_db)

        row = pd.Series({
            "title": "Fresh Apples",
            "product_name": "Organic Apples",
            "description": "Locally grown",
            "category": "produce"
        })

        text = trainer._create_product_text(row)

        assert "Fresh Apples" in text
        assert "Organic Apples" in text
        assert "Locally grown" in text
        assert "produce" in text

    def test_create_product_text_missing_fields(self, temp_db):
        """Test product text with missing fields."""
        trainer = RecommendationModelTrainer(temp_db)

        row = pd.Series({
            "title": "Apples",
            "product_name": None,
            "description": None,
            "category": None
        })

        text = trainer._create_product_text(row)
        assert text == "Apples"

    def test_create_product_text_all_missing(self, temp_db):
        """Test product text with all fields missing."""
        trainer = RecommendationModelTrainer(temp_db)

        row = pd.Series({
            "title": None,
            "product_name": None,
            "description": None,
            "category": None
        })

        text = trainer._create_product_text(row)
        assert text == "unknown"

    def test_train_success(self, temp_db, temp_output_dirs):
        """Test successful recommendation model training."""
        models_dir, reports_dir = temp_output_dirs

        with patch("training.recommendation_trainer.MODELS_DIR", models_dir), \
             patch("training.recommendation_trainer.REPORTS_DIR", reports_dir):

            trainer = RecommendationModelTrainer(temp_db)
            results = trainer.train()

        assert results["success"] is True
        assert "vocabulary_size" in results
        assert "user_preferences_learned" in results
        assert "metrics" in results
        assert "precision_at_5" in results["metrics"]
        assert trainer.vectorizer is not None

    def test_train_insufficient_users(self, temp_db_minimal, temp_output_dirs):
        """Test training with insufficient users."""
        models_dir, reports_dir = temp_output_dirs

        with patch("training.recommendation_trainer.MODELS_DIR", models_dir), \
             patch("training.recommendation_trainer.REPORTS_DIR", reports_dir), \
             patch("training.recommendation_trainer.MIN_RECOMMENDATION_USERS", 100):

            trainer = RecommendationModelTrainer(temp_db_minimal)
            results = trainer.train()

        assert results["success"] is False
        assert "Insufficient users" in results["error"]

    def test_calculate_global_category_weights(self, temp_db):
        """Test category weight calculation."""
        trainer = RecommendationModelTrainer(temp_db)

        # Create test interactions dataframe
        interactions_df = pd.DataFrame({
            "type": ["consumed", "shared", "sold", "consumed", "consumed"],
            "category": ["produce", "produce", "dairy", "produce", "bakery"]
        })

        trainer._calculate_global_category_weights(interactions_df)

        assert "produce" in trainer.category_weights
        assert trainer.category_weights["produce"] == 1.0  # Most frequent

    def test_calculate_global_category_weights_empty(self, temp_db):
        """Test category weights with empty dataframe."""
        trainer = RecommendationModelTrainer(temp_db)

        trainer._calculate_global_category_weights(pd.DataFrame())

        # Should have default weights for all categories
        assert len(trainer.category_weights) > 0

    def test_save_model(self, temp_db, temp_output_dirs):
        """Test model saving."""
        models_dir, reports_dir = temp_output_dirs

        with patch("training.recommendation_trainer.MODELS_DIR", models_dir), \
             patch("training.recommendation_trainer.REPORTS_DIR", reports_dir):

            trainer = RecommendationModelTrainer(temp_db)
            trainer.train()

            result = trainer.save_model()

        assert result is True
        assert (models_dir / "recommendation_vectorizer.joblib").exists()
        assert (models_dir / "recommendation_model.joblib").exists()

    def test_save_model_without_training(self, temp_db, temp_output_dirs):
        """Test save_model fails without training."""
        models_dir, reports_dir = temp_output_dirs

        with patch("training.recommendation_trainer.MODELS_DIR", models_dir):
            trainer = RecommendationModelTrainer(temp_db)
            result = trainer.save_model()

        assert result is False

    def test_generate_report(self, temp_db, temp_output_dirs):
        """Test report generation."""
        models_dir, reports_dir = temp_output_dirs

        with patch("training.recommendation_trainer.MODELS_DIR", models_dir), \
             patch("training.recommendation_trainer.REPORTS_DIR", reports_dir):

            trainer = RecommendationModelTrainer(temp_db)
            results = trainer.train()
            report_path = trainer.generate_report(results)

        assert Path(report_path).exists()

        with open(report_path) as f:
            report = json.load(f)

        assert report["model_type"] == "product_recommendation"


# ============================================================================
# train_all Tests
# ============================================================================

class TestTrainAll:
    """Tests for train_all module."""

    def test_train_all_models_success(self, temp_db, temp_output_dirs):
        """Test training all models successfully."""
        models_dir, reports_dir = temp_output_dirs

        with patch("training.train_all.MODELS_DIR", models_dir), \
             patch("training.train_all.REPORTS_DIR", reports_dir), \
             patch("training.price_trainer.MODELS_DIR", models_dir), \
             patch("training.price_trainer.REPORTS_DIR", reports_dir), \
             patch("training.recommendation_trainer.MODELS_DIR", models_dir), \
             patch("training.recommendation_trainer.REPORTS_DIR", reports_dir):

            results = train_all_models(temp_db)

        assert "training_id" in results
        assert "models" in results
        assert "price_optimization" in results["models"]
        assert "product_recommendation" in results["models"]
        assert results["models"]["price_optimization"]["success"] is True
        assert results["models"]["product_recommendation"]["success"] is True

    def test_train_all_models_db_not_found(self, temp_output_dirs):
        """Test training with non-existent database."""
        models_dir, reports_dir = temp_output_dirs

        results = train_all_models("/nonexistent/db.sqlite")

        assert results["success"] is False
        assert "Database not found" in results["error"]

    def test_train_all_models_skip_price(self, temp_db, temp_output_dirs):
        """Test skipping price model training."""
        models_dir, reports_dir = temp_output_dirs

        with patch("training.train_all.MODELS_DIR", models_dir), \
             patch("training.train_all.REPORTS_DIR", reports_dir), \
             patch("training.recommendation_trainer.MODELS_DIR", models_dir), \
             patch("training.recommendation_trainer.REPORTS_DIR", reports_dir):

            results = train_all_models(temp_db, skip_price=True)

        assert "price_optimization" not in results["models"]
        assert "product_recommendation" in results["models"]

    def test_train_all_models_skip_recommendation(self, temp_db, temp_output_dirs):
        """Test skipping recommendation model training."""
        models_dir, reports_dir = temp_output_dirs

        with patch("training.train_all.MODELS_DIR", models_dir), \
             patch("training.train_all.REPORTS_DIR", reports_dir), \
             patch("training.price_trainer.MODELS_DIR", models_dir), \
             patch("training.price_trainer.REPORTS_DIR", reports_dir):

            results = train_all_models(temp_db, skip_recommendation=True)

        assert "price_optimization" in results["models"]
        assert "product_recommendation" not in results["models"]

    def test_train_all_saves_metadata(self, temp_db, temp_output_dirs):
        """Test that training saves model metadata."""
        models_dir, reports_dir = temp_output_dirs

        with patch("training.train_all.MODELS_DIR", models_dir), \
             patch("training.train_all.REPORTS_DIR", reports_dir), \
             patch("training.price_trainer.MODELS_DIR", models_dir), \
             patch("training.price_trainer.REPORTS_DIR", reports_dir), \
             patch("training.recommendation_trainer.MODELS_DIR", models_dir), \
             patch("training.recommendation_trainer.REPORTS_DIR", reports_dir):

            train_all_models(temp_db)

        metadata_path = models_dir / "model_metadata.json"
        assert metadata_path.exists()

        with open(metadata_path) as f:
            metadata = json.load(f)

        assert "training_id" in metadata
        assert "models" in metadata

    def test_main_with_args(self, temp_db, temp_output_dirs):
        """Test main function with command line arguments."""
        models_dir, reports_dir = temp_output_dirs

        with patch("training.train_all.MODELS_DIR", models_dir), \
             patch("training.train_all.REPORTS_DIR", reports_dir), \
             patch("training.price_trainer.MODELS_DIR", models_dir), \
             patch("training.price_trainer.REPORTS_DIR", reports_dir), \
             patch("training.recommendation_trainer.MODELS_DIR", models_dir), \
             patch("training.recommendation_trainer.REPORTS_DIR", reports_dir), \
             patch("sys.argv", ["train_all.py", "--db-path", temp_db]):

            # Should not raise
            main()

    def test_main_skip_flags(self, temp_db, temp_output_dirs):
        """Test main function with skip flags."""
        models_dir, reports_dir = temp_output_dirs

        with patch("training.train_all.MODELS_DIR", models_dir), \
             patch("training.train_all.REPORTS_DIR", reports_dir), \
             patch("training.price_trainer.MODELS_DIR", models_dir), \
             patch("training.price_trainer.REPORTS_DIR", reports_dir), \
             patch("sys.argv", ["train_all.py", "--db-path", temp_db, "--skip-recommendation"]):

            main()


# ============================================================================
# Edge Cases and Error Handling
# ============================================================================

class TestEdgeCases:
    """Tests for edge cases and error handling."""

    def test_data_collector_empty_tables(self):
        """Test data collector with completely empty tables."""
        fd, db_path = tempfile.mkstemp(suffix=".db")
        os.close(fd)

        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        cursor.execute("CREATE TABLE users (id INTEGER PRIMARY KEY)")
        cursor.execute("CREATE TABLE products (id INTEGER PRIMARY KEY, user_id INTEGER, product_name TEXT, category TEXT, description TEXT)")
        cursor.execute("""
            CREATE TABLE marketplace_listings (
                id INTEGER PRIMARY KEY, seller_id INTEGER, title TEXT, description TEXT,
                category TEXT, quantity INTEGER, unit TEXT, price REAL, original_price REAL,
                expiry_date REAL, status TEXT, created_at TEXT, completed_at TEXT
            )
        """)
        cursor.execute("""
            CREATE TABLE product_sustainability_metrics (
                id INTEGER PRIMARY KEY, product_id INTEGER, user_id INTEGER,
                today_date TEXT, quantity INTEGER, type TEXT
            )
        """)
        conn.commit()
        conn.close()

        try:
            collector = DataCollector(db_path)

            # Should return empty dataframes without crashing
            price_df = collector.get_price_training_data()
            assert price_df.empty

            products_df, interactions_df, listings_df = collector.get_recommendation_training_data()
            assert listings_df.empty

            prefs = collector.get_user_category_preferences()
            assert prefs == {}

            summary = collector.get_data_summary()
            assert summary["total_users"] == 0
        finally:
            os.unlink(db_path)

    def test_price_trainer_handles_unknown_categories(self, temp_db, temp_output_dirs):
        """Test that price trainer handles unknown categories."""
        models_dir, reports_dir = temp_output_dirs

        # Add a listing with unknown category
        conn = sqlite3.connect(temp_db)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO marketplace_listings
            (id, seller_id, title, description, category, quantity, unit, price, original_price, expiry_date, status, created_at)
            VALUES (999, 1, 'Test', 'desc', 'unknown_category', 1, 'kg', 8.0, 10.0, ?, 'sold', ?)
        """, (datetime.now().timestamp(), datetime.now().isoformat()))
        conn.commit()
        conn.close()

        with patch("training.price_trainer.MODELS_DIR", models_dir), \
             patch("training.price_trainer.REPORTS_DIR", reports_dir):

            trainer = PriceModelTrainer(temp_db)
            results = trainer.train(use_sold_only=True)

        # Should still succeed - unknown categories mapped to 'other'
        assert results["success"] is True

    def test_recommendation_metrics_small_dataset(self, temp_db_minimal, temp_output_dirs):
        """Test recommendation metrics calculation with very small dataset."""
        models_dir, reports_dir = temp_output_dirs

        trainer = RecommendationModelTrainer(temp_db_minimal)

        # Create a small TF-IDF matrix
        from sklearn.feature_extraction.text import TfidfVectorizer
        vectorizer = TfidfVectorizer()
        texts = ["apple fruit", "banana fruit", "milk dairy"]
        tfidf_matrix = vectorizer.fit_transform(texts)
        categories = ["produce", "produce", "dairy"]

        metrics = trainer._calculate_metrics(tfidf_matrix, categories)

        assert "precision_at_5" in metrics
        assert "coverage" in metrics
        assert "diversity" in metrics
