"""
Configuration for ML training and inference.

configuration for machine learning.
"""
import os
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).parent
MODELS_DIR = BASE_DIR / "models"
REPORTS_DIR = BASE_DIR / "reports"
TRAINING_DIR = BASE_DIR / "training"

# Database path (relative to project root)
DEFAULT_DB_PATH = BASE_DIR.parent / "backend" / "ecoplate.db"

# Model file names
PRICE_MODEL_FILE = "price_model.joblib"
PRICE_SCALER_FILE = "price_scaler.joblib"
PRICE_ENCODER_FILE = "price_encoder.joblib"
RECOMMENDATION_MODEL_FILE = "recommendation_model.joblib"
RECOMMENDATION_VECTORIZER_FILE = "recommendation_vectorizer.joblib"
MODEL_METADATA_FILE = "model_metadata.json"

# Training thresholds
MIN_PRICE_TRAINING_SAMPLES = 50  # Minimum sold listings for price model
MIN_RECOMMENDATION_USERS = 3     # Minimum users with interactions
MIN_PRODUCTS_FOR_TFIDF = 10      # Minimum products for TF-IDF vectorizer

# Price model hyperparameters
PRICE_MODEL_PARAMS = {
    "n_estimators": 100,
    "max_depth": 5,
    "learning_rate": 0.1,
    "min_samples_split": 5,
    "min_samples_leaf": 2,
    "random_state": 42,
}

# Cross-validation settings
CV_FOLDS = 5

# Categories for encoding
CATEGORIES = [
    "produce",
    "dairy",
    "meat",
    "seafood",
    "bakery",
    "frozen",
    "canned",
    "beverages",
    "snacks",
    "condiments",
    "pantry",
    "other",
]

# TF-IDF settings
TFIDF_MAX_FEATURES = 2000
TFIDF_MIN_DF = 1
TFIDF_MAX_DF = 0.95
TFIDF_NGRAM_RANGE = (1, 2)

# Recommendation settings
RECOMMENDATION_TOP_K = 10

# Logging
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
