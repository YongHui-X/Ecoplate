"""
Price optimization model trainer using Gradient Boosting.
"""
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import joblib

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import (
    MODELS_DIR,
    REPORTS_DIR,
    PRICE_MODEL_FILE,
    PRICE_SCALER_FILE,
    PRICE_ENCODER_FILE,
    PRICE_MODEL_PARAMS,
    CV_FOLDS,
    CATEGORIES,
    MIN_PRICE_TRAINING_SAMPLES,
)
from training.data_collector import DataCollector

logger = logging.getLogger(__name__)


class PriceModelTrainer:
    """Train price optimization model using Gradient Boosting."""

    def __init__(self, db_path: str):
        """
        Initialize trainer.

        Args:
            db_path: Path to SQLite database
        """
        self.data_collector = DataCollector(db_path)
        self.model: Optional[GradientBoostingRegressor] = None
        self.scaler: Optional[StandardScaler] = None
        self.encoder: Optional[LabelEncoder] = None
        self.feature_names = ["original_price", "days_until_expiry", "quantity", "category_encoded"]

    def prepare_features(self, df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """
        Prepare features for training.

        Args:
            df: DataFrame with listing data

        Returns:
            Tuple of (X features, y target)
        """
        # Initialize encoder with all known categories
        self.encoder = LabelEncoder()
        self.encoder.fit(CATEGORIES)

        # Encode categories (handle unknown categories)
        df = df.copy()
        df["category"] = df["category"].apply(
            lambda x: x if x in CATEGORIES else "other"
        )
        df["category_encoded"] = self.encoder.transform(df["category"])

        # Select features
        feature_cols = ["original_price", "days_until_expiry", "quantity", "category_encoded"]
        X = df[feature_cols].values

        # Scale features
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)

        # Target: discount ratio
        y = df["discount_ratio"].values

        return X_scaled, y

    def train(self, use_sold_only: bool = True) -> Dict:
        """
        Train the price optimization model.

        Args:
            use_sold_only: If True, only use sold listings for training

        Returns:
            Dict with training metrics and results
        """
        logger.info("Starting price model training...")

        # Fetch data
        df = self.data_collector.get_price_training_data()

        if df.empty:
            logger.warning("No training data available")
            return {"error": "No training data available", "success": False}

        # Filter to sold listings if requested
        if use_sold_only:
            df = df[df["status"] == "sold"]
            logger.info(f"Using {len(df)} sold listings for training")

        if len(df) < MIN_PRICE_TRAINING_SAMPLES:
            logger.warning(
                f"Insufficient training data: {len(df)} < {MIN_PRICE_TRAINING_SAMPLES}"
            )
            return {
                "error": f"Insufficient training data: {len(df)} samples (need {MIN_PRICE_TRAINING_SAMPLES})",
                "success": False,
                "samples_available": len(df),
            }

        # Prepare features
        X, y = self.prepare_features(df)

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        # Train model
        logger.info("Training Gradient Boosting model...")
        self.model = GradientBoostingRegressor(**PRICE_MODEL_PARAMS)
        self.model.fit(X_train, y_train)

        # Evaluate on test set
        y_pred = self.model.predict(X_test)
        test_rmse = np.sqrt(mean_squared_error(y_test, y_pred))
        test_mae = mean_absolute_error(y_test, y_pred)
        test_r2 = r2_score(y_test, y_pred)

        # Cross-validation
        logger.info(f"Running {CV_FOLDS}-fold cross-validation...")
        cv_scores = cross_val_score(
            self.model, X, y, cv=CV_FOLDS, scoring="neg_root_mean_squared_error"
        )
        cv_rmse = -cv_scores.mean()
        cv_rmse_std = cv_scores.std()

        # Feature importance
        feature_importance = dict(
            zip(self.feature_names, self.model.feature_importances_)
        )

        # Compile results
        results = {
            "success": True,
            "algorithm": "GradientBoostingRegressor",
            "training_samples": len(df),
            "test_samples": len(X_test),
            "metrics": {
                "rmse": round(test_rmse, 4),
                "mae": round(test_mae, 4),
                "r2_score": round(test_r2, 4),
                "cv_rmse": round(cv_rmse, 4),
                "cv_rmse_std": round(cv_rmse_std, 4),
            },
            "feature_importance": {
                k: round(v, 4) for k, v in feature_importance.items()
            },
            "hyperparameters": PRICE_MODEL_PARAMS,
            "data_stats": {
                "discount_ratio_mean": round(df["discount_ratio"].mean(), 4),
                "discount_ratio_std": round(df["discount_ratio"].std(), 4),
                "original_price_mean": round(df["original_price"].mean(), 2),
                "categories": df["category"].value_counts().to_dict(),
            },
        }

        logger.info(f"Training complete. RMSE: {test_rmse:.4f}, R2: {test_r2:.4f}")
        return results

    def save_model(self) -> bool:
        """
        Save trained model, scaler, and encoder to disk.

        Returns:
            True if save successful
        """
        if self.model is None:
            logger.error("No model to save. Run train() first.")
            return False

        MODELS_DIR.mkdir(parents=True, exist_ok=True)

        model_path = MODELS_DIR / PRICE_MODEL_FILE
        scaler_path = MODELS_DIR / PRICE_SCALER_FILE
        encoder_path = MODELS_DIR / PRICE_ENCODER_FILE

        joblib.dump(self.model, model_path)
        joblib.dump(self.scaler, scaler_path)
        joblib.dump(self.encoder, encoder_path)

        logger.info(f"Price model saved to {model_path}")
        return True

    def generate_report(self, results: Dict) -> str:
        """
        Generate training report and save to reports directory.

        Args:
            results: Training results dict

        Returns:
            Path to report file
        """
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_path = REPORTS_DIR / f"price_training_report_{timestamp}.json"

        report = {
            "training_id": timestamp,
            "timestamp": datetime.now().isoformat(),
            "model_type": "price_optimization",
            **results,
        }

        with open(report_path, "w") as f:
            json.dump(report, f, indent=2)

        logger.info(f"Training report saved to {report_path}")
        return str(report_path)
