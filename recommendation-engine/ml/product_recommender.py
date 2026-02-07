"""
Product recommendation using trained TF-IDF model and user preferences.
"""
import logging
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import joblib

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import (
    MODELS_DIR,
    RECOMMENDATION_MODEL_FILE,
    RECOMMENDATION_VECTORIZER_FILE,
    RECOMMENDATION_TOP_K,
)

logger = logging.getLogger(__name__)


class ProductRecommender:
    """Recommend similar products using trained TF-IDF and user preferences."""

    def __init__(self):
        """Initialize recommender and attempt to load model."""
        self.vectorizer = None
        self.user_preferences: Dict[int, Dict[str, float]] = {}
        self.category_weights: Dict[str, float] = {}
        self._is_loaded = False
        self._load_model()

    def _load_model(self) -> bool:
        """
        Load trained model from disk.

        Returns:
            True if model loaded successfully
        """
        vectorizer_path = MODELS_DIR / RECOMMENDATION_VECTORIZER_FILE
        model_path = MODELS_DIR / RECOMMENDATION_MODEL_FILE

        if not all(p.exists() for p in [vectorizer_path, model_path]):
            logger.info("Recommendation model not found, will use rule-based fallback")
            return False

        try:
            self.vectorizer = joblib.load(vectorizer_path)
            model_data = joblib.load(model_path)
            self.user_preferences = model_data.get("user_preferences", {})
            self.category_weights = model_data.get("category_weights", {})
            self._is_loaded = True
            logger.info(
                f"Recommendation model loaded: {len(self.user_preferences)} user profiles"
            )
            return True
        except Exception as e:
            logger.error(f"Failed to load recommendation model: {e}")
            self._is_loaded = False
            return False

    def is_ml_available(self) -> bool:
        """Check if ML model is available for recommendations."""
        return self._is_loaded

    def reload_model(self) -> bool:
        """Reload model from disk (e.g., after retraining)."""
        self._is_loaded = False
        return self._load_model()

    def _create_text(self, item: Dict) -> str:
        """Create text representation for TF-IDF vectorization."""
        parts = []
        if item.get("title"):
            parts.append(str(item["title"]))
        if item.get("description"):
            parts.append(str(item["description"]))
        if item.get("category"):
            parts.append(str(item["category"]))
        return " ".join(parts) if parts else "unknown"

    def recommend(
        self,
        target: Dict,
        candidates: List[Dict],
        user_id: Optional[int] = None,
        limit: int = RECOMMENDATION_TOP_K,
    ) -> Dict:
        """
        Find similar products using ML model with optional user preference boosting.

        Args:
            target: Target listing dict
            candidates: List of candidate listings
            user_id: Optional user ID for personalized recommendations
            limit: Maximum number of results

        Returns:
            Dict with similar products and source indicator
        """
        if not self._is_loaded:
            return {"error": "Model not available", "source": "error"}

        if not candidates:
            return {
                "similar_products": [],
                "count": 0,
                "source": "ml_model",
            }

        try:
            # Create text for target
            target_text = self._create_text(target)

            # Create texts for all candidates
            candidate_texts = [self._create_text(c) for c in candidates]

            # Vectorize all texts
            all_texts = [target_text] + candidate_texts
            tfidf_matrix = self.vectorizer.transform(all_texts)

            # Calculate cosine similarity between target and candidates
            target_vector = tfidf_matrix[0:1]
            candidate_vectors = tfidf_matrix[1:]
            similarities = cosine_similarity(target_vector, candidate_vectors)[0]

            # Get user preferences if available
            user_prefs = None
            if user_id and user_id in self.user_preferences:
                user_prefs = self.user_preferences[user_id]
                logger.debug(f"Using personalized preferences for user {user_id}")

            # Score and rank candidates
            results = []
            for i, (candidate, sim_score) in enumerate(zip(candidates, similarities)):
                # Skip same listing or same seller
                if candidate.get("id") == target.get("id"):
                    continue
                if candidate.get("sellerId") == target.get("sellerId"):
                    continue

                # Base score from TF-IDF similarity
                final_score = float(sim_score)

                # Apply user preference boost (if available)
                category = (candidate.get("category") or "other").lower()
                preference_boost = 0.0

                if user_prefs and category in user_prefs:
                    preference_boost = user_prefs[category] * 0.2  # 20% max boost
                    final_score += preference_boost

                # Apply global category weight
                if category in self.category_weights:
                    category_boost = self.category_weights[category] * 0.1  # 10% max
                    final_score += category_boost

                # Calculate match factors
                match_factors = {
                    "text_similarity": round(float(sim_score), 3),
                    "user_preference": round(preference_boost, 3),
                    "category_popularity": round(
                        self.category_weights.get(category, 0.1), 3
                    ),
                }

                result = {
                    "id": candidate.get("id"),
                    "sellerId": candidate.get("sellerId"),
                    "title": candidate.get("title"),
                    "description": candidate.get("description"),
                    "category": candidate.get("category"),
                    "price": candidate.get("price"),
                    "originalPrice": candidate.get("originalPrice"),
                    "quantity": candidate.get("quantity"),
                    "unit": candidate.get("unit"),
                    "expiryDate": candidate.get("expiryDate"),
                    "pickupLocation": candidate.get("pickupLocation"),
                    "images": candidate.get("images"),
                    "status": candidate.get("status"),
                    "createdAt": candidate.get("createdAt"),
                    "seller": candidate.get("seller"),
                    "similarity_score": round(final_score, 3),
                    "match_factors": match_factors,
                }
                results.append(result)

            # Sort by score and limit
            results.sort(key=lambda x: x["similarity_score"], reverse=True)
            results = results[:limit]

            return {
                "similar_products": results,
                "count": len(results),
                "personalized": user_prefs is not None,
                "source": "ml_model",
            }

        except Exception as e:
            logger.error(f"Recommendation failed: {e}")
            return {"error": str(e), "source": "error"}

    def get_user_profile(self, user_id: int) -> Optional[Dict]:
        """
        Get learned preference profile for a user.

        Args:
            user_id: User ID

        Returns:
            Dict with category preferences or None if not found
        """
        return self.user_preferences.get(user_id)
