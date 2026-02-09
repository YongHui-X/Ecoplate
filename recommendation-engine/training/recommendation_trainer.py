"""
Recommendation model trainer using TF-IDF and user preferences.
"""
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, List

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import joblib

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import (
    MODELS_DIR,
    REPORTS_DIR,
    RECOMMENDATION_MODEL_FILE,
    RECOMMENDATION_VECTORIZER_FILE,
    TFIDF_MAX_FEATURES,
    TFIDF_MIN_DF,
    TFIDF_MAX_DF,
    TFIDF_NGRAM_RANGE,
    MIN_RECOMMENDATION_USERS,
    MIN_PRODUCTS_FOR_TFIDF,
    CATEGORIES,
)
from training.data_collector import DataCollector

logger = logging.getLogger(__name__)


class RecommendationModelTrainer:
    """Train content-based recommendation model using TF-IDF and user preferences."""

    def __init__(self, db_path: str):
        """
        Initialize trainer.

        Args:
            db_path: Path to SQLite database
        """
        self.data_collector = DataCollector(db_path)
        self.vectorizer: Optional[TfidfVectorizer] = None
        self.user_preferences: Dict[int, Dict[str, float]] = {}
        self.category_weights: Dict[str, float] = {}

    def _create_product_text(self, row: pd.Series) -> str:
        """Create text representation of a product for TF-IDF."""
        parts = []
        if pd.notna(row.get("title")):
            parts.append(str(row["title"]))
        if pd.notna(row.get("product_name")):
            parts.append(str(row["product_name"]))
        if pd.notna(row.get("description")):
            parts.append(str(row["description"]))
        if pd.notna(row.get("category")):
            parts.append(str(row["category"]))
        return " ".join(parts) if parts else "unknown"

    def train(self) -> Dict:
        """
        Train the recommendation model.

        Returns:
            Dict with training metrics and results
        """
        logger.info("Starting recommendation model training...")

        # Fetch data
        products_df, interactions_df, listings_df = (
            self.data_collector.get_recommendation_training_data()
        )

        # Check minimum data requirements
        unique_users = interactions_df["user_id"].nunique() if not interactions_df.empty else 0
        total_products = len(products_df) + len(listings_df)

        if unique_users < MIN_RECOMMENDATION_USERS:
            logger.warning(
                f"Insufficient users with interactions: {unique_users} < {MIN_RECOMMENDATION_USERS}"
            )
            return {
                "error": f"Insufficient users: {unique_users} (need {MIN_RECOMMENDATION_USERS})",
                "success": False,
                "users_available": unique_users,
            }

        if total_products < MIN_PRODUCTS_FOR_TFIDF:
            logger.warning(
                f"Insufficient products: {total_products} < {MIN_PRODUCTS_FOR_TFIDF}"
            )
            return {
                "error": f"Insufficient products: {total_products} (need {MIN_PRODUCTS_FOR_TFIDF})",
                "success": False,
                "products_available": total_products,
            }

        # Combine products and listings for TF-IDF training
        all_texts = []
        all_categories = []

        for _, row in listings_df.iterrows():
            text = self._create_product_text(row)
            all_texts.append(text)
            all_categories.append(row.get("category", "other"))

        for _, row in products_df.iterrows():
            text = self._create_product_text(row)
            all_texts.append(text)
            all_categories.append(row.get("category", "other"))

        # Train TF-IDF vectorizer
        logger.info(f"Training TF-IDF vectorizer on {len(all_texts)} documents...")
        self.vectorizer = TfidfVectorizer(
            max_features=TFIDF_MAX_FEATURES,
            min_df=TFIDF_MIN_DF,
            max_df=TFIDF_MAX_DF,
            ngram_range=TFIDF_NGRAM_RANGE,
            stop_words="english",
        )

        try:
            tfidf_matrix = self.vectorizer.fit_transform(all_texts)
        except ValueError as e:
            logger.error(f"TF-IDF training failed: {e}")
            return {"error": str(e), "success": False}

        # Calculate vocabulary statistics
        vocab_size = len(self.vectorizer.vocabulary_)
        logger.info(f"TF-IDF vocabulary size: {vocab_size}")

        # Calculate category distribution
        category_counts = pd.Series(all_categories).value_counts().to_dict()

        # Learn user preferences from interactions
        logger.info("Learning user category preferences...")
        self.user_preferences = self.data_collector.get_user_category_preferences()

        # Calculate global category weights based on interaction frequency
        self._calculate_global_category_weights(interactions_df)

        # Calculate model quality metrics
        metrics = self._calculate_metrics(tfidf_matrix, all_categories)

        # Compile results
        results = {
            "success": True,
            "algorithm": "ContentBased_TF-IDF",
            "products_trained": len(all_texts),
            "vocabulary_size": vocab_size,
            "user_preferences_learned": len(self.user_preferences),
            "metrics": metrics,
            "tfidf_params": {
                "max_features": TFIDF_MAX_FEATURES,
                "min_df": TFIDF_MIN_DF,
                "max_df": TFIDF_MAX_DF,
                "ngram_range": list(TFIDF_NGRAM_RANGE),
            },
            "category_distribution": category_counts,
            "global_category_weights": self.category_weights,
        }

        logger.info(
            f"Training complete. {vocab_size} vocabulary terms, "
            f"{len(self.user_preferences)} user preference profiles"
        )
        return results

    def _calculate_global_category_weights(self, interactions_df: pd.DataFrame) -> None:
        """Calculate global category weights from all interactions."""
        if interactions_df.empty or "category" not in interactions_df.columns:
            self.category_weights = {cat: 1.0 for cat in CATEGORIES}
            return

        # Filter to positive actions only
        positive_actions = interactions_df[
            interactions_df["type"].isin(["consumed", "shared", "sold"])
        ]

        if positive_actions.empty:
            self.category_weights = {cat: 1.0 for cat in CATEGORIES}
            return

        # Count interactions per category
        category_counts = (
            positive_actions["category"].fillna("other").value_counts().to_dict()
        )

        # Normalize to 0-1 weights
        if category_counts:
            max_count = max(category_counts.values())
            self.category_weights = {
                cat: round(count / max_count, 4)
                for cat, count in category_counts.items()
            }

        # Add missing categories with default weight
        for cat in CATEGORIES:
            if cat not in self.category_weights:
                self.category_weights[cat] = 0.1

    def _calculate_metrics(
        self, tfidf_matrix: np.ndarray, categories: List[str]
    ) -> Dict:
        """
        Calculate recommendation model quality metrics.

        Args:
            tfidf_matrix: Trained TF-IDF matrix
            categories: List of product categories

        Returns:
            Dict with precision@k, coverage, diversity metrics
        """
        n_items = tfidf_matrix.shape[0]

        if n_items < 10:
            return {
                "precision_at_5": 0.0,
                "coverage": 0.0,
                "diversity": 0.0,
            }

        # Calculate similarity matrix (sample for large datasets)
        sample_size = min(100, n_items)
        sample_indices = np.random.choice(n_items, sample_size, replace=False)
        sample_matrix = tfidf_matrix[sample_indices]

        sim_matrix = cosine_similarity(sample_matrix)

        # Precision@5: how often top-5 similar items share the same category
        precision_scores = []
        for i in range(sample_size):
            sim_scores = sim_matrix[i]
            top_k_indices = np.argsort(sim_scores)[-6:-1]  # Top 5, excluding self

            query_category = categories[sample_indices[i]]
            same_category_count = sum(
                1
                for idx in top_k_indices
                if categories[sample_indices[idx]] == query_category
            )
            precision_scores.append(same_category_count / 5.0)

        precision_at_5 = np.mean(precision_scores)

        # Coverage: proportion of items that appear in top-5 recommendations
        all_recommended = set()
        for i in range(sample_size):
            sim_scores = sim_matrix[i]
            top_k_indices = np.argsort(sim_scores)[-6:-1]
            all_recommended.update(top_k_indices)

        coverage = len(all_recommended) / sample_size

        # Diversity: average dissimilarity of recommended items
        diversity_scores = []
        for i in range(sample_size):
            sim_scores = sim_matrix[i]
            top_k_indices = np.argsort(sim_scores)[-6:-1]
            if len(top_k_indices) > 1:
                top_k_matrix = sample_matrix[top_k_indices]
                pairwise_sim = cosine_similarity(top_k_matrix)
                # Average off-diagonal similarity
                n = len(top_k_indices)
                avg_sim = (pairwise_sim.sum() - n) / (n * (n - 1))
                diversity_scores.append(1 - avg_sim)  # Convert to diversity

        diversity = np.mean(diversity_scores) if diversity_scores else 0.0

        return {
            "precision_at_5": round(precision_at_5, 4),
            "coverage": round(coverage, 4),
            "diversity": round(diversity, 4),
        }

    def save_model(self) -> bool:
        """
        Save trained vectorizer and user preferences to disk.

        Returns:
            True if save successful
        """
        if self.vectorizer is None:
            logger.error("No model to save. Run train() first.")
            return False

        MODELS_DIR.mkdir(parents=True, exist_ok=True)

        vectorizer_path = MODELS_DIR / RECOMMENDATION_VECTORIZER_FILE
        model_path = MODELS_DIR / RECOMMENDATION_MODEL_FILE

        # Save vectorizer
        joblib.dump(self.vectorizer, vectorizer_path)

        # Save user preferences and category weights
        model_data = {
            "user_preferences": self.user_preferences,
            "category_weights": self.category_weights,
        }
        joblib.dump(model_data, model_path)

        logger.info(f"Recommendation model saved to {model_path}")
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
        report_path = REPORTS_DIR / f"recommendation_training_report_{timestamp}.json"

        report = {
            "training_id": timestamp,
            "timestamp": datetime.now().isoformat(),
            "model_type": "product_recommendation",
            **results,
        }

        with open(report_path, "w") as f:
            json.dump(report, f, indent=2)

        logger.info(f"Training report saved to {report_path}")
        return str(report_path)
