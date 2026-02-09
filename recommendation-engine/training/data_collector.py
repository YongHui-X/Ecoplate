"""
Data collector for fetching training data from SQLite database.
"""
import sqlite3
import logging
from pathlib import Path
from typing import Optional, Dict, List, Tuple
from datetime import datetime

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


class DataCollector:
    """Collect training data from EcoPlate SQLite database."""

    def __init__(self, db_path: str):
        """
        Initialize data collector.

        Args:
            db_path: Path to SQLite database file
        """
        self.db_path = Path(db_path)
        if not self.db_path.exists():
            raise FileNotFoundError(f"Database not found: {self.db_path}")

    def _get_connection(self) -> sqlite3.Connection:
        """Get database connection."""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return conn

    def get_price_training_data(self) -> pd.DataFrame:
        """
        Fetch marketplace listings data for price model training.

        Returns:
            DataFrame with columns: original_price, price, days_until_expiry,
                                   category, quantity, status, discount_ratio
        """
        logger.info("Fetching price training data from marketplace_listings...")

        query = """
        SELECT
            id,
            seller_id,
            title,
            description,
            category,
            quantity,
            unit,
            price,
            original_price,
            expiry_date,
            status,
            created_at,
            completed_at
        FROM marketplace_listings
        WHERE original_price IS NOT NULL
          AND original_price > 0
          AND price IS NOT NULL
        """

        conn = self._get_connection()
        try:
            df = pd.read_sql_query(query, conn)
            logger.info(f"Fetched {len(df)} total listings")

            if df.empty:
                return df

            # Calculate discount ratio (target variable)
            df["discount_ratio"] = 1 - (df["price"] / df["original_price"])
            df["discount_ratio"] = df["discount_ratio"].clip(0, 1)  # Ensure 0-1 range

            # Calculate days until expiry at listing creation
            now_ts = datetime.now().timestamp()
            df["days_until_expiry"] = df["expiry_date"].apply(
                lambda x: max(0, (x - now_ts) / 86400) if pd.notna(x) else 30
            )

            # Normalize categories
            df["category"] = df["category"].fillna("other").str.lower()

            # Log statistics
            sold_count = (df["status"] == "sold").sum()
            active_count = (df["status"] == "active").sum()
            logger.info(
                f"Data breakdown: {sold_count} sold, {active_count} active, "
                f"{len(df) - sold_count - active_count} other"
            )

            return df

        finally:
            conn.close()

    def get_recommendation_training_data(
        self,
    ) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """
        Fetch data for recommendation model training.

        Returns:
            Tuple of (products_df, user_interactions_df, listings_df)
        """
        logger.info("Fetching recommendation training data...")

        conn = self._get_connection()
        try:
            # Get all marketplace listings (for TF-IDF training)
            listings_query = """
            SELECT
                id,
                seller_id,
                title,
                description,
                category,
                quantity,
                unit,
                price,
                original_price,
                status
            FROM marketplace_listings
            """
            listings_df = pd.read_sql_query(listings_query, conn)
            logger.info(f"Fetched {len(listings_df)} marketplace listings")

            # Get user interactions from sustainability metrics
            interactions_query = """
            SELECT
                psm.id,
                psm.product_id,
                psm.user_id,
                psm.today_date,
                psm.quantity,
                psm.type,
                p.product_name,
                p.category
            FROM product_sustainability_metrics psm
            LEFT JOIN products p ON psm.product_id = p.id
            WHERE psm.type IS NOT NULL
            """
            interactions_df = pd.read_sql_query(interactions_query, conn)
            logger.info(f"Fetched {len(interactions_df)} user interactions")

            # Get all products (for product descriptions)
            products_query = """
            SELECT
                id,
                user_id,
                product_name,
                category,
                description
            FROM products
            """
            products_df = pd.read_sql_query(products_query, conn)
            logger.info(f"Fetched {len(products_df)} products")

            return products_df, interactions_df, listings_df

        finally:
            conn.close()

    def get_user_category_preferences(self) -> Dict[int, Dict[str, float]]:
        """
        Calculate user preferences based on their sustainability actions.

        Returns:
            Dict mapping user_id to category preference weights
        """
        logger.info("Calculating user category preferences...")

        conn = self._get_connection()
        try:
            query = """
            SELECT
                psm.user_id,
                p.category,
                psm.type,
                COUNT(*) as action_count
            FROM product_sustainability_metrics psm
            JOIN products p ON psm.product_id = p.id
            WHERE psm.type IN ('consumed', 'shared', 'sold')
              AND p.category IS NOT NULL
            GROUP BY psm.user_id, p.category, psm.type
            """
            df = pd.read_sql_query(query, conn)

            if df.empty:
                return {}

            # Weight actions: consumed=1, shared=2, sold=2 (higher weight for sharing)
            action_weights = {"consumed": 1.0, "shared": 2.0, "sold": 2.0}
            df["weighted_count"] = df.apply(
                lambda row: row["action_count"]
                * action_weights.get(row["type"], 1.0),
                axis=1,
            )

            # Aggregate by user and category
            user_prefs: Dict[int, Dict[str, float]] = {}

            for user_id in df["user_id"].unique():
                user_data = df[df["user_id"] == user_id]
                total_weighted = user_data["weighted_count"].sum()

                if total_weighted > 0:
                    prefs = (
                        user_data.groupby("category")["weighted_count"]
                        .sum()
                        .to_dict()
                    )
                    # Normalize to 0-1
                    max_val = max(prefs.values())
                    prefs = {k: v / max_val for k, v in prefs.items()}
                    user_prefs[user_id] = prefs

            logger.info(
                f"Calculated preferences for {len(user_prefs)} users"
            )
            return user_prefs

        finally:
            conn.close()

    def get_data_summary(self) -> Dict:
        """
        Get summary statistics of available training data.

        Returns:
            Dict with data counts and quality metrics
        """
        conn = self._get_connection()
        try:
            summary = {}

            # Users count
            cursor = conn.execute("SELECT COUNT(*) FROM users")
            summary["total_users"] = cursor.fetchone()[0]

            # Listings counts
            cursor = conn.execute(
                """
                SELECT status, COUNT(*) as count
                FROM marketplace_listings
                GROUP BY status
            """
            )
            summary["listings_by_status"] = dict(cursor.fetchall())

            # Listings with valid price data
            cursor = conn.execute(
                """
                SELECT COUNT(*) FROM marketplace_listings
                WHERE original_price IS NOT NULL
                  AND original_price > 0
                  AND price IS NOT NULL
            """
            )
            summary["listings_with_prices"] = cursor.fetchone()[0]

            # Sold listings (for price training)
            cursor = conn.execute(
                """
                SELECT COUNT(*) FROM marketplace_listings
                WHERE status = 'sold'
                  AND original_price IS NOT NULL
                  AND price IS NOT NULL
            """
            )
            summary["sold_listings"] = cursor.fetchone()[0]

            # Sustainability metrics
            cursor = conn.execute(
                "SELECT COUNT(*) FROM product_sustainability_metrics"
            )
            summary["total_interactions"] = cursor.fetchone()[0]

            # Users with interactions
            cursor = conn.execute(
                """
                SELECT COUNT(DISTINCT user_id)
                FROM product_sustainability_metrics
            """
            )
            summary["users_with_interactions"] = cursor.fetchone()[0]

            # Products count
            cursor = conn.execute("SELECT COUNT(*) FROM products")
            summary["total_products"] = cursor.fetchone()[0]

            return summary

        finally:
            conn.close()
