"""
Price prediction using trained ML model.
"""
import logging
from pathlib import Path
from typing import Dict, Optional
from datetime import datetime

import numpy as np
import joblib

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import (
    MODELS_DIR,
    PRICE_MODEL_FILE,
    PRICE_SCALER_FILE,
    PRICE_ENCODER_FILE,
    CATEGORIES,
)

logger = logging.getLogger(__name__)


class PricePredictor:
    """Predict optimal prices using trained Gradient Boosting model."""

    def __init__(self):
        """Initialize predictor and attempt to load model."""
        self.model = None
        self.scaler = None
        self.encoder = None
        self._is_loaded = False
        self._load_model()

    def _load_model(self) -> bool:
        """
        Load trained model from disk.

        Returns:
            True if model loaded successfully
        """
        model_path = MODELS_DIR / PRICE_MODEL_FILE
        scaler_path = MODELS_DIR / PRICE_SCALER_FILE
        encoder_path = MODELS_DIR / PRICE_ENCODER_FILE

        if not all(p.exists() for p in [model_path, scaler_path, encoder_path]):
            logger.info("Price model not found, will use rule-based fallback")
            return False

        try:
            self.model = joblib.load(model_path)
            self.scaler = joblib.load(scaler_path)
            self.encoder = joblib.load(encoder_path)
            self._is_loaded = True
            logger.info("Price prediction model loaded successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to load price model: {e}")
            self._is_loaded = False
            return False

    def is_ml_available(self) -> bool:
        """Check if ML model is available for predictions."""
        return self._is_loaded

    def reload_model(self) -> bool:
        """Reload model from disk (e.g., after retraining)."""
        self._is_loaded = False
        return self._load_model()

    def predict(
        self,
        original_price: float,
        expiry_date: Optional[str],
        category: Optional[str],
        quantity: float = 1.0,
    ) -> Dict:
        """
        Predict optimal discount ratio using ML model.

        Args:
            original_price: Original item price
            expiry_date: Expiry date (ISO format or YYYY-MM-DD)
            category: Product category
            quantity: Item quantity

        Returns:
            Dict with predicted prices and discount info
        """
        if not self._is_loaded:
            return {"error": "Model not available", "source": "error"}

        try:
            # Calculate days until expiry
            days_until_expiry = self._calculate_days_until_expiry(expiry_date)

            # Normalize category
            category = (category or "other").lower()
            if category not in CATEGORIES:
                category = "other"

            # Encode category
            category_encoded = self.encoder.transform([category])[0]

            # Prepare features
            features = np.array([[original_price, days_until_expiry, quantity, category_encoded]])
            features_scaled = self.scaler.transform(features)

            # Predict discount ratio
            predicted_discount = self.model.predict(features_scaled)[0]

            # Clip to valid range [0, 0.75] (max 75% discount)
            predicted_discount = np.clip(predicted_discount, 0, 0.75)

            # Calculate prices
            recommended_price = round(original_price * (1 - predicted_discount), 2)
            min_price = round(original_price * (1 - min(predicted_discount + 0.10, 0.75)), 2)
            max_price = round(original_price * (1 - max(predicted_discount - 0.10, 0)), 2)

            # Ensure minimum viable price
            floor_price = round(original_price * 0.25, 2)
            recommended_price = max(recommended_price, floor_price)
            min_price = max(min_price, floor_price)

            # Generate reasoning
            reasoning = self._generate_reasoning(
                days_until_expiry, category, predicted_discount
            )

            return {
                "recommended_price": recommended_price,
                "min_price": min_price,
                "max_price": max_price,
                "original_price": original_price,
                "discount_percentage": round(predicted_discount * 100, 1),
                "days_until_expiry": days_until_expiry,
                "category": category,
                "reasoning": reasoning,
                "source": "ml_model",
            }

        except Exception as e:
            logger.error(f"Prediction failed: {e}")
            return {"error": str(e), "source": "error"}

    def _calculate_days_until_expiry(self, expiry_date: Optional[str]) -> int:
        """Calculate days remaining until expiry."""
        if not expiry_date:
            return 30  # Default

        try:
            if "T" in expiry_date:
                expiry = datetime.fromisoformat(expiry_date.replace("Z", "+00:00"))
                now = datetime.now(expiry.tzinfo) if expiry.tzinfo else datetime.now()
            else:
                expiry = datetime.strptime(expiry_date, "%Y-%m-%d")
                now = datetime.now()
            return max(0, (expiry - now).days)
        except (ValueError, TypeError):
            return 30

    def _generate_reasoning(
        self, days: int, category: str, discount: float
    ) -> str:
        """Generate explanation for the ML prediction."""
        discount_pct = int(discount * 100)

        if days <= 1:
            urgency = "expiring very soon"
        elif days <= 3:
            urgency = f"expiring in {days} days"
        elif days <= 7:
            urgency = "expiring this week"
        elif days <= 14:
            urgency = "expiring in 1-2 weeks"
        else:
            urgency = "having good shelf life"

        return (
            f"Based on ML analysis of similar {category} items {urgency}, "
            f"a {discount_pct}% discount optimizes sale probability while preserving value. "
            f"This recommendation is learned from historical marketplace data."
        )
