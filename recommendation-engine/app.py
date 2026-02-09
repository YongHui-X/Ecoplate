# Recommendation Engine for EcoPlate
# Flask API for similar product recommendations

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
from datetime import datetime, timezone
from typing import List, Dict, Optional
import os
import logging
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# ML model imports
from ml import PricePredictor, ProductRecommender

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize ML predictors
price_predictor = PricePredictor()
product_recommender = ProductRecommender()

app = Flask(__name__)

# Configure CORS - restrict origins in production
ALLOWED_ORIGINS = os.environ.get('CORS_ORIGINS', '*').split(',')
CORS(app, origins=ALLOWED_ORIGINS)


# ============================================================================
# Security Headers Middleware
# ============================================================================

@app.after_request
def add_security_headers(response):
    """Add security headers to all responses to address OWASP ZAP findings."""
    # Prevent MIME type sniffing
    response.headers['X-Content-Type-Options'] = 'nosniff'
    # Prevent clickjacking
    response.headers['X-Frame-Options'] = 'DENY'
    # XSS Protection (legacy, but still useful)
    response.headers['X-XSS-Protection'] = '1; mode=block'
    # Referrer policy
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    # Content Security Policy for API
    response.headers['Content-Security-Policy'] = "default-src 'none'; frame-ancestors 'none'"
    # Cache control for sensitive endpoints
    if request.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, private'
        response.headers['Pragma'] = 'no-cache'
    return response

# ============================================================================
# Constants - extracted magic numbers for maintainability
# ============================================================================

# Similarity scoring
SIMILARITY_THRESHOLD = 0.5          # Minimum score to include in results
DEFAULT_NEUTRAL_SCORE = 0.5         # Score when data is missing
PRICE_TOLERANCE_RATIO = 0.5         # 50% price difference tolerance
FRESHNESS_TOLERANCE_DAYS = 7        # Days difference for freshness scoring
DEFAULT_MAX_DISTANCE_KM = 10        # Default max distance for scoring
MIN_PRICE_DIVISOR = 0.01            # Prevent division by zero

# Price recommendation
MAX_DISCOUNT_CAP = 0.75             # Maximum 75% discount
PRICE_FLOOR_RATIO = 0.25            # Minimum 25% of original price
DEFAULT_EXPIRY_DAYS = 30            # Default when no expiry provided

# API limits
MAX_CANDIDATES = 500                # Maximum candidates to process
MAX_RESULT_LIMIT = 50               # Maximum results to return


class SimilarProductsMatcher:
    """Find similar products using TF-IDF text similarity and multi-factor scoring"""

    RELATED_CATEGORIES = {
        "produce": ["frozen"],
        "dairy": ["beverages"],
        "meat": ["frozen"],
        "bakery": ["pantry"],
        "frozen": ["meat", "dairy"],
        "beverages": ["dairy"],
        "pantry": ["bakery"]
    }

    WEIGHTS = {
        'category': 0.35,
        'text': 0.25,
        'price': 0.15,
        'distance': 0.15,
        'freshness': 0.10
    }

    @staticmethod
    def calculate_category_score(target_cat: Optional[str], candidate_cat: Optional[str]) -> float:
        """Score based on category match: exact=1.0, related=0.5, different=0.0"""
        if not target_cat or not candidate_cat:
            return DEFAULT_NEUTRAL_SCORE
        target_cat = target_cat.lower()
        candidate_cat = candidate_cat.lower()
        if target_cat == candidate_cat:
            return 1.0
        related = SimilarProductsMatcher.RELATED_CATEGORIES.get(target_cat, [])
        return DEFAULT_NEUTRAL_SCORE if candidate_cat in related else 0.0

    @staticmethod
    def calculate_text_similarity(texts: List[str]) -> np.ndarray:
        """Calculate TF-IDF cosine similarity matrix for texts"""
        if len(texts) < 2:
            return np.array([[1.0]])
        # Handle empty strings by adding placeholder
        processed_texts = [t if t.strip() else "unknown" for t in texts]
        try:
            vectorizer = TfidfVectorizer(stop_words='english')
            tfidf_matrix = vectorizer.fit_transform(processed_texts)
            return cosine_similarity(tfidf_matrix)
        except ValueError as e:
            # Occurs when all documents are empty or contain only stop words
            logger.warning(f"TF-IDF vectorization failed: {e}")
            return np.ones((len(texts), len(texts))) * DEFAULT_NEUTRAL_SCORE

    @staticmethod
    def calculate_price_score(target_price: Optional[float], candidate_price: Optional[float]) -> float:
        """Score based on price similarity (within tolerance ratio)"""
        if not target_price or not candidate_price:
            return DEFAULT_NEUTRAL_SCORE
        diff_ratio = abs(target_price - candidate_price) / max(target_price, MIN_PRICE_DIVISOR)
        return max(0, 1 - (diff_ratio / PRICE_TOLERANCE_RATIO))

    @staticmethod
    def calculate_distance_score(distance_km: Optional[float], max_distance: float = DEFAULT_MAX_DISTANCE_KM) -> float:
        """Score based on distance (closer = higher score)"""
        if distance_km is None:
            return DEFAULT_NEUTRAL_SCORE
        return max(0, 1 - (distance_km / max_distance))

    @staticmethod
    def calculate_freshness_score(target_days: Optional[int], candidate_days: Optional[int]) -> float:
        """Score based on similarity in days until expiry"""
        if target_days is None or candidate_days is None:
            return DEFAULT_NEUTRAL_SCORE
        diff = abs(target_days - candidate_days)
        return max(0, 1 - (diff / FRESHNESS_TOLERANCE_DAYS))

    @classmethod
    def find_similar(cls, target: Dict, candidates: List[Dict], limit: int = 6) -> List[Dict]:
        """
        Find similar products using multi-factor weighted scoring.

        Args:
            target: Target listing dict with id, title, description, category, price, etc.
            candidates: List of candidate listings (max MAX_CANDIDATES)
            limit: Maximum number of results to return (max MAX_RESULT_LIMIT)

        Returns:
            List of similar products with similarity_score and match_factors
        """
        if not candidates:
            return []

        # Enforce limits
        candidates = candidates[:MAX_CANDIDATES]
        limit = min(limit, MAX_RESULT_LIMIT)

        results = []

        # Prepare texts for TF-IDF
        target_text = f"{target.get('title', '')} {target.get('description', '')}"
        all_texts = [target_text] + [
            f"{c.get('title', '')} {c.get('description', '')}" for c in candidates
        ]

        # Calculate text similarities
        similarity_matrix = cls.calculate_text_similarity(all_texts)

        for i, candidate in enumerate(candidates):
            # Skip same listing
            if candidate.get('id') == target.get('id'):
                continue
            # Skip same seller
            if candidate.get('sellerId') == target.get('sellerId'):
                continue

            # Calculate individual scores
            category_score = cls.calculate_category_score(
                target.get('category', ''),
                candidate.get('category', '')
            )
            text_score = float(similarity_matrix[0, i + 1])
            price_score = cls.calculate_price_score(
                target.get('price'),
                candidate.get('price')
            )
            distance_score = cls.calculate_distance_score(
                candidate.get('distance_km')
            )
            freshness_score = cls.calculate_freshness_score(
                target.get('days_until_expiry'),
                candidate.get('days_until_expiry')
            )

            # Weighted total
            total_score = (
                cls.WEIGHTS['category'] * category_score +
                cls.WEIGHTS['text'] * text_score +
                cls.WEIGHTS['price'] * price_score +
                cls.WEIGHTS['distance'] * distance_score +
                cls.WEIGHTS['freshness'] * freshness_score
            )

            if total_score >= SIMILARITY_THRESHOLD:
                result = {
                    'id': candidate.get('id'),
                    'sellerId': candidate.get('sellerId'),
                    'title': candidate.get('title'),
                    'description': candidate.get('description'),
                    'category': candidate.get('category'),
                    'price': candidate.get('price'),
                    'originalPrice': candidate.get('originalPrice'),
                    'quantity': candidate.get('quantity'),
                    'unit': candidate.get('unit'),
                    'expiryDate': candidate.get('expiryDate'),
                    'pickupLocation': candidate.get('pickupLocation'),
                    'images': candidate.get('images'),
                    'status': candidate.get('status'),
                    'createdAt': candidate.get('createdAt'),
                    'seller': candidate.get('seller'),
                    'similarity_score': round(total_score, 3),
                    'match_factors': {
                        'category': round(category_score, 2),
                        'text': round(text_score, 2),
                        'price': round(price_score, 2),
                        'distance': round(distance_score, 2),
                        'freshness': round(freshness_score, 2)
                    }
                }
                results.append(result)

        # Sort by score descending, return top N
        results.sort(key=lambda x: x['similarity_score'], reverse=True)
        return results[:limit]


class PriceRecommender:
    """Recommend optimal selling price based on expiry date and category"""

    # How quickly items in each category lose value (lower = faster decay)
    CATEGORY_FRESHNESS = {
        'produce': 0.85,
        'dairy': 0.80,
        'meat': 0.75,
        'seafood': 0.70,
        'bakery': 0.85,
        'frozen': 0.95,
        'canned': 0.98,
        'beverages': 0.95,
        'snacks': 0.95,
        'condiments': 0.97,
        'pantry': 0.96,
        'other': 0.90
    }

    # Discount ranges by urgency level
    DISCOUNT_TIERS = [
        {'max_days': 1, 'min_discount': 0.50, 'max_discount': 0.70, 'label': 'Expiring today/tomorrow'},
        {'max_days': 3, 'min_discount': 0.35, 'max_discount': 0.50, 'label': 'Expiring in 2-3 days'},
        {'max_days': 7, 'min_discount': 0.20, 'max_discount': 0.35, 'label': 'Expiring this week'},
        {'max_days': 14, 'min_discount': 0.10, 'max_discount': 0.20, 'label': 'Expiring in 1-2 weeks'},
        {'max_days': 30, 'min_discount': 0.05, 'max_discount': 0.15, 'label': 'Expiring this month'},
        {'max_days': float('inf'), 'min_discount': 0.00, 'max_discount': 0.10, 'label': 'Long shelf life'}
    ]

    @classmethod
    def calculate_days_until_expiry(cls, expiry_date: Optional[str]) -> int:
        """Calculate days remaining until expiry"""
        if not expiry_date:
            return DEFAULT_EXPIRY_DAYS

        try:
            if 'T' in expiry_date:
                expiry = datetime.fromisoformat(expiry_date.replace('Z', '+00:00'))
                now = datetime.now(expiry.tzinfo) if expiry.tzinfo else datetime.now()
            else:
                expiry = datetime.strptime(expiry_date, '%Y-%m-%d')
                now = datetime.now()
            return max(0, (expiry - now).days)
        except (ValueError, TypeError) as e:
            logger.warning(f"Failed to parse expiry date '{expiry_date}': {e}")
            return DEFAULT_EXPIRY_DAYS

    @classmethod
    def get_discount_tier(cls, days_until_expiry: int) -> Dict:
        """Get the appropriate discount tier based on days until expiry"""
        for tier in cls.DISCOUNT_TIERS:
            if days_until_expiry <= tier['max_days']:
                return tier
        return cls.DISCOUNT_TIERS[-1]

    @classmethod
    def calculate(cls, original_price: float, expiry_date: Optional[str], category: Optional[str]) -> Dict:
        """
        Calculate recommended selling price.

        Args:
            original_price: Original retail price of the item
            expiry_date: Expiry date (ISO format or YYYY-MM-DD)
            category: Product category

        Returns:
            Dict with recommended_price, min_price, max_price, discount info, and reasoning
        """
        if not original_price or original_price <= 0:
            return {'error': 'Invalid original price'}

        # Get days until expiry
        days_remaining = cls.calculate_days_until_expiry(expiry_date)

        # Get discount tier
        tier = cls.get_discount_tier(days_remaining)

        # Get category freshness factor (lower = more perishable = higher discount)
        category_key = (category or 'other').lower()
        freshness_factor = cls.CATEGORY_FRESHNESS.get(category_key, 0.90)

        # Adjust discount based on category perishability
        perishability_adjustment = (1 - freshness_factor) * 0.15

        # Calculate final discount range
        base_discount = (tier['min_discount'] + tier['max_discount']) / 2
        adjusted_discount = min(base_discount + perishability_adjustment, MAX_DISCOUNT_CAP)

        min_discount = max(tier['min_discount'], adjusted_discount - 0.10)
        max_discount = min(tier['max_discount'] + perishability_adjustment, MAX_DISCOUNT_CAP)

        # Calculate prices
        recommended_price = round(original_price * (1 - adjusted_discount), 2)
        min_price = round(original_price * (1 - max_discount), 2)
        max_price = round(original_price * (1 - min_discount), 2)

        # Ensure minimum viable price (at least 0.01 for any positive original price)
        floor_price = max(round(original_price * PRICE_FLOOR_RATIO, 2), 0.01)
        recommended_price = max(recommended_price, floor_price)
        min_price = max(min_price, floor_price)

        # Generate reasoning
        reasoning = cls._generate_reasoning(
            days_remaining, category_key, adjusted_discount, tier['label']
        )

        return {
            'recommended_price': recommended_price,
            'min_price': min_price,
            'max_price': max_price,
            'original_price': original_price,
            'discount_percentage': round(adjusted_discount * 100, 1),
            'days_until_expiry': days_remaining,
            'category': category_key,
            'urgency_label': tier['label'],
            'reasoning': reasoning
        }

    @staticmethod
    def _generate_reasoning(days: int, category: str, discount: float, urgency_label: str) -> str:
        """Generate human-readable pricing explanation"""
        discount_pct = int(discount * 100)

        if days <= 1:
            return f"Item expires very soon. A {discount_pct}% discount will help ensure a quick sale and prevent waste."
        elif days <= 3:
            return f"With only {days} days left, a {discount_pct}% discount makes this {category} item attractive to buyers."
        elif days <= 7:
            return f"This {category} item expires this week. A {discount_pct}% discount balances value and urgency."
        elif days <= 14:
            return f"Good shelf life remaining. A modest {discount_pct}% discount positions this {category} item competitively."
        else:
            return f"Plenty of time before expiry. A {discount_pct}% discount offers buyers good value while maintaining your margin."


# ============================================================================
# API Routes
# ============================================================================

@app.route('/health', methods=['GET'])
def health_check() -> tuple:
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'service': 'recommendation-engine'}), 200


@app.route('/api/v1/recommendations/price', methods=['POST'])
def get_price_recommendation() -> tuple:
    """
    Get recommended selling price based on expiry date and category.

    Request body:
    {
        "original_price": 10.00,
        "expiry_date": "2026-02-10",
        "category": "dairy"
    }
    """
    data = request.get_json()

    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    if not data.get('original_price'):
        return jsonify({'error': 'original_price is required'}), 400

    try:
        original_price = float(data['original_price'])
    except (ValueError, TypeError):
        return jsonify({'error': 'original_price must be a number'}), 400

    logger.info(f"Price recommendation request: price={original_price}, category={data.get('category')}")

    # Try ML model first, fallback to rule-based
    if price_predictor.is_ml_available():
        recommendation = price_predictor.predict(
            original_price=original_price,
            expiry_date=data.get('expiry_date'),
            category=data.get('category', 'other'),
            quantity=data.get('quantity', 1.0)
        )
        if recommendation.get('source') != 'error':
            logger.info("Using ML-based price prediction")
            return jsonify(recommendation), 200

    # Fallback to rule-based
    logger.info("Using rule-based price recommendation")
    recommendation = PriceRecommender.calculate(
        original_price=original_price,
        expiry_date=data.get('expiry_date'),
        category=data.get('category', 'other')
    )
    recommendation['source'] = 'rule_based'

    return jsonify(recommendation), 200


@app.route('/api/v1/recommendations/similar', methods=['POST'])
def get_similar_products() -> tuple:
    """
    Find similar products based on multi-factor scoring.

    Request body:
    {
        "target": { ... },
        "candidates": [ ... ],
        "limit": 6,
        "user_id": 123  # Optional: for personalized recommendations
    }
    """
    data = request.get_json()

    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    if data.get('target') is None or data.get('candidates') is None:
        return jsonify({'error': 'target and candidates are required'}), 400

    # Validate candidates is a list
    if not isinstance(data.get('candidates'), list):
        return jsonify({'error': 'candidates must be an array'}), 400

    candidates = data['candidates']
    if len(candidates) > MAX_CANDIDATES:
        logger.warning(f"Candidates truncated from {len(candidates)} to {MAX_CANDIDATES}")

    logger.info(f"Similar products request: target_id={data['target'].get('id')}, candidates={len(candidates)}")

    limit = data.get('limit', 6)
    user_id = data.get('user_id')

    # Try ML model first, fallback to rule-based
    if product_recommender.is_ml_available():
        result = product_recommender.recommend(
            target=data['target'],
            candidates=candidates,
            user_id=user_id,
            limit=limit
        )
        if result.get('source') != 'error':
            logger.info(f"Using ML-based recommendations (personalized={result.get('personalized', False)})")
            result['threshold'] = SIMILARITY_THRESHOLD
            result['generated_at'] = datetime.now(timezone.utc).isoformat()
            return jsonify(result), 200

    # Fallback to rule-based
    logger.info("Using rule-based similar products matching")
    similar = SimilarProductsMatcher.find_similar(
        target=data['target'],
        candidates=candidates,
        limit=limit
    )

    return jsonify({
        'similar_products': similar,
        'count': len(similar),
        'threshold': SIMILARITY_THRESHOLD,
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'source': 'rule_based'
    }), 200


@app.route('/api/v1/models/status', methods=['GET'])
def get_model_status() -> tuple:
    """Get status of loaded ML models."""
    return jsonify({
        'price_model': {
            'loaded': price_predictor.is_ml_available(),
            'type': 'GradientBoostingRegressor'
        },
        'recommendation_model': {
            'loaded': product_recommender.is_ml_available(),
            'type': 'ContentBased_TF-IDF'
        }
    }), 200


@app.route('/api/v1/models/reload', methods=['POST'])
def reload_models() -> tuple:
    """Reload ML models from disk (after retraining)."""
    price_reloaded = price_predictor.reload_model()
    rec_reloaded = product_recommender.reload_model()

    return jsonify({
        'price_model_reloaded': price_reloaded,
        'recommendation_model_reloaded': rec_reloaded,
        'message': 'Models reloaded successfully' if (price_reloaded or rec_reloaded) else 'No models found to reload'
    }), 200


# ============================================================================
# Entry Point
# ============================================================================

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'

    logger.info(f"Recommendation Engine starting on port {port}")
    logger.info(f"Price model available: {price_predictor.is_ml_available()}")
    logger.info(f"Recommendation model available: {product_recommender.is_ml_available()}")
    # nosec B104 - binding to 0.0.0.0 is required for Docker container networking
    app.run(host='0.0.0.0', port=port, debug=debug)  # nosec B104
