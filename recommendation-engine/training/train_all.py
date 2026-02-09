#!/usr/bin/env python3
"""
Master training script for all EcoPlate ML models.

Usage:
    python training/train_all.py --db-path ../backend/ecoplate.db
"""
import argparse
import json
import logging
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import (
    DEFAULT_DB_PATH,
    MODELS_DIR,
    REPORTS_DIR,
    MODEL_METADATA_FILE,
    LOG_FORMAT,
    LOG_LEVEL,
)
from training.data_collector import DataCollector
from training.price_trainer import PriceModelTrainer
from training.recommendation_trainer import RecommendationModelTrainer

# Configure logging
logging.basicConfig(level=LOG_LEVEL, format=LOG_FORMAT)
logger = logging.getLogger(__name__)


def train_all_models(db_path: str, skip_price: bool = False, skip_recommendation: bool = False) -> dict:
    """
    Train all ML models.

    Args:
        db_path: Path to SQLite database
        skip_price: Skip price model training
        skip_recommendation: Skip recommendation model training

    Returns:
        Dict with training results for all models
    """
    training_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    logger.info(f"Starting training run: {training_id}")
    logger.info(f"Database: {db_path}")

    # Verify database exists
    if not Path(db_path).exists():
        logger.error(f"Database not found: {db_path}")
        return {"error": f"Database not found: {db_path}", "success": False}

    # Get data summary
    logger.info("=" * 60)
    logger.info("DATA SUMMARY")
    logger.info("=" * 60)

    try:
        collector = DataCollector(db_path)
        summary = collector.get_data_summary()
        for key, value in summary.items():
            logger.info(f"  {key}: {value}")
    except Exception as e:
        logger.error(f"Failed to get data summary: {e}")
        return {"error": str(e), "success": False}

    results = {
        "training_id": training_id,
        "timestamp": datetime.now().isoformat(),
        "database": str(db_path),
        "data_summary": summary,
        "models": {},
    }

    # Train Price Model
    if not skip_price:
        logger.info("")
        logger.info("=" * 60)
        logger.info("TRAINING PRICE OPTIMIZATION MODEL")
        logger.info("=" * 60)

        try:
            price_trainer = PriceModelTrainer(db_path)
            price_results = price_trainer.train(use_sold_only=True)

            if price_results.get("success"):
                price_trainer.save_model()
                price_trainer.generate_report(price_results)
                logger.info("Price model training successful!")
            else:
                logger.warning(f"Price model training skipped: {price_results.get('error')}")

            results["models"]["price_optimization"] = price_results

        except Exception as e:
            logger.error(f"Price model training failed: {e}")
            results["models"]["price_optimization"] = {"error": str(e), "success": False}

    # Train Recommendation Model
    if not skip_recommendation:
        logger.info("")
        logger.info("=" * 60)
        logger.info("TRAINING RECOMMENDATION MODEL")
        logger.info("=" * 60)

        try:
            rec_trainer = RecommendationModelTrainer(db_path)
            rec_results = rec_trainer.train()

            if rec_results.get("success"):
                rec_trainer.save_model()
                rec_trainer.generate_report(rec_results)
                logger.info("Recommendation model training successful!")
            else:
                logger.warning(f"Recommendation model training skipped: {rec_results.get('error')}")

            results["models"]["product_recommendation"] = rec_results

        except Exception as e:
            logger.error(f"Recommendation model training failed: {e}")
            results["models"]["product_recommendation"] = {"error": str(e), "success": False}

    # Save model metadata
    logger.info("")
    logger.info("=" * 60)
    logger.info("SAVING MODEL METADATA")
    logger.info("=" * 60)

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    metadata_path = MODELS_DIR / MODEL_METADATA_FILE

    metadata = {
        "training_id": training_id,
        "timestamp": datetime.now().isoformat(),
        "models": {},
    }

    for model_name, model_results in results["models"].items():
        if model_results.get("success"):
            metadata["models"][model_name] = {
                "version": training_id,
                "algorithm": model_results.get("algorithm"),
                "training_samples": model_results.get("training_samples")
                or model_results.get("products_trained"),
                "metrics": model_results.get("metrics", {}),
            }

    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

    logger.info(f"Model metadata saved to {metadata_path}")

    # Save combined training report
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report_path = REPORTS_DIR / f"training_report_{training_id}.json"

    with open(report_path, "w") as f:
        json.dump(results, f, indent=2)

    logger.info(f"Combined training report saved to {report_path}")

    # Print summary
    logger.info("")
    logger.info("=" * 60)
    logger.info("TRAINING SUMMARY")
    logger.info("=" * 60)

    for model_name, model_results in results["models"].items():
        status = "SUCCESS" if model_results.get("success") else "SKIPPED/FAILED"
        logger.info(f"  {model_name}: {status}")
        if model_results.get("success") and model_results.get("metrics"):
            for metric_name, metric_value in model_results["metrics"].items():
                logger.info(f"    {metric_name}: {metric_value}")

    return results


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Train all EcoPlate ML models"
    )
    parser.add_argument(
        "--db-path",
        type=str,
        default=str(DEFAULT_DB_PATH),
        help="Path to SQLite database",
    )
    parser.add_argument(
        "--skip-price",
        action="store_true",
        help="Skip price model training",
    )
    parser.add_argument(
        "--skip-recommendation",
        action="store_true",
        help="Skip recommendation model training",
    )

    args = parser.parse_args()

    results = train_all_models(
        db_path=args.db_path,
        skip_price=args.skip_price,
        skip_recommendation=args.skip_recommendation,
    )

    # Exit with error code if all models failed
    all_failed = all(
        not m.get("success") for m in results.get("models", {}).values()
    )
    if all_failed and results.get("models"):
        sys.exit(1)


if __name__ == "__main__":
    main()
