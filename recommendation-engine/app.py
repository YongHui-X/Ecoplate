# Recommendation Engine for EcoPlate
# Flask API for buyer/seller matching and notifications

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Any
import os
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

app = Flask(__name__)
CORS(app)

# ============================================================================
# Recommendation Models
# ============================================================================

class ExpiryUrgencyScorer:
    """Calculate urgency score based on days until expiry"""
    
    @staticmethod
    def calculate(expiry_date: str) -> float:
        """
        Returns urgency score 0-1 (1 = most urgent)
        Items expiring sooner get higher scores
        """
        if not expiry_date:
            return 0.5
        
        expiry = datetime.fromisoformat(expiry_date.replace('Z', '+00:00'))
        now = datetime.now(expiry.tzinfo) if expiry.tzinfo else datetime.now()
        days_until_expiry = (expiry - now).days
        
        if days_until_expiry <= 0:
            return 1.0  # Already expired - highest urgency
        elif days_until_expiry <= 1:
            return 0.95
        elif days_until_expiry <= 3:
            return 0.8
        elif days_until_expiry <= 7:
            return 0.5
        elif days_until_expiry <= 14:
            return 0.3
        else:
            return 0.1


class PriceRecommender:
    """Recommend optimal selling price based on freshness and market data"""
    
    @staticmethod
    def calculate(original_price: float, expiry_date: str, category: str) -> Dict[str, Any]:
        """
        Calculate recommended price based on:
        - Days until expiry (freshness discount)
        - Product category (perishability)
        - Market demand (simplified)
        """
        urgency = ExpiryUrgencyScorer.calculate(expiry_date)
        
        # Category-based perishability multiplier
        perishability = {
            'dairy': 0.9,
            'meat': 0.85,
            'seafood': 0.8,
            'produce': 0.85,
            'bakery': 0.9,
            'frozen': 0.95,
            'canned': 0.98,
            'beverages': 0.95,
            'snacks': 0.95,
            'other': 0.9
        }.get(category.lower() if category else 'other', 0.9)
        
        # Calculate discount based on urgency
        # Higher urgency = higher discount
        base_discount = urgency * 0.6  # Max 60% discount
        category_adjustment = (1 - perishability) * 0.2
        
        total_discount = min(base_discount + category_adjustment, 0.7)  # Cap at 70% off
        
        recommended_price = original_price * (1 - total_discount)
        min_price = original_price * 0.3  # Floor at 30% of original
        max_price = original_price * (1 - (total_discount * 0.5))  # More conservative max
        
        return {
            'recommended_price': round(max(recommended_price, min_price), 2),
            'min_price': round(min_price, 2),
            'max_price': round(max_price, 2),
            'discount_percentage': round(total_discount * 100, 1),
            'urgency_score': round(urgency, 2),
            'reasoning': _get_price_reasoning(urgency, category)
        }


def _get_price_reasoning(urgency: float, category: str) -> str:
    """Generate human-readable pricing reasoning"""
    if urgency >= 0.9:
        return f"Price reduced significantly - {category} item expiring very soon. Quick sale recommended."
    elif urgency >= 0.7:
        return f"Moderate discount applied - {category} item expiring within 3 days."
    elif urgency >= 0.4:
        return f"Light discount - {category} item has about a week of freshness remaining."
    else:
        return f"Minimal discount - {category} item still has good shelf life."


class BuyerMatcher:
    """Match listings with potential buyers based on preferences"""
    
    @staticmethod
    def score_match(listing: Dict, buyer_preferences: Dict) -> float:
        """
        Calculate match score between a listing and buyer preferences
        Returns score 0-1 (1 = perfect match)
        """
        score = 0.0
        weights = {
            'category': 0.3,
            'price': 0.25,
            'distance': 0.25,
            'freshness': 0.2
        }
        
        # Category match
        if buyer_preferences.get('preferred_categories'):
            if listing.get('category', '').lower() in [c.lower() for c in buyer_preferences['preferred_categories']]:
                score += weights['category']
        else:
            score += weights['category'] * 0.5  # Neutral if no preference
        
        # Price match
        max_price = buyer_preferences.get('max_price')
        if max_price and listing.get('price'):
            if listing['price'] <= max_price:
                # Better score for bigger savings
                price_ratio = listing['price'] / max_price
                score += weights['price'] * (1 - price_ratio + 0.5)
            # No score if over budget
        else:
            score += weights['price'] * 0.5
        
        # Distance match (simplified - assumes distance in km is provided)
        max_distance = buyer_preferences.get('max_distance_km', 10)
        listing_distance = listing.get('distance_km', 5)
        if listing_distance <= max_distance:
            distance_score = 1 - (listing_distance / max_distance)
            score += weights['distance'] * distance_score
        
        # Freshness preference
        min_days = buyer_preferences.get('min_days_until_expiry', 0)
        if listing.get('expiry_date'):
            expiry = datetime.fromisoformat(listing['expiry_date'].replace('Z', '+00:00'))
            now = datetime.now(expiry.tzinfo) if expiry.tzinfo else datetime.now()
            days_remaining = (expiry - now).days
            
            if days_remaining >= min_days:
                freshness_score = min(days_remaining / 7, 1)  # Normalize to week
                score += weights['freshness'] * freshness_score
        
        return min(score, 1.0)


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
    def calculate_category_score(target_cat: str, candidate_cat: str) -> float:
        """Score based on category match: exact=1.0, related=0.5, different=0.0"""
        if not target_cat or not candidate_cat:
            return 0.5
        target_cat = target_cat.lower()
        candidate_cat = candidate_cat.lower()
        if target_cat == candidate_cat:
            return 1.0
        related = SimilarProductsMatcher.RELATED_CATEGORIES.get(target_cat, [])
        return 0.5 if candidate_cat in related else 0.0

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
        except Exception:
            # Fallback if vectorization fails
            return np.ones((len(texts), len(texts))) * 0.5

    @staticmethod
    def calculate_price_score(target_price: float, candidate_price: float) -> float:
        """Score based on price similarity (50% tolerance)"""
        if not target_price or not candidate_price:
            return 0.5
        diff_ratio = abs(target_price - candidate_price) / max(target_price, 0.01)
        return max(0, 1 - (diff_ratio / 0.5))

    @staticmethod
    def calculate_distance_score(distance_km: float, max_distance: float = 10) -> float:
        """Score based on distance (closer = higher score)"""
        if distance_km is None:
            return 0.5
        return max(0, 1 - (distance_km / max_distance))

    @staticmethod
    def calculate_freshness_score(target_days: int, candidate_days: int) -> float:
        """Score based on similarity in days until expiry (7-day tolerance)"""
        if target_days is None or candidate_days is None:
            return 0.5
        diff = abs(target_days - candidate_days)
        return max(0, 1 - (diff / 7))

    @classmethod
    def find_similar(cls, target: Dict, candidates: List[Dict], limit: int = 6) -> List[Dict]:
        """
        Find similar products using multi-factor weighted scoring.

        Args:
            target: Target listing dict with id, title, description, category, price, etc.
            candidates: List of candidate listings
            limit: Maximum number of results to return

        Returns:
            List of similar products with similarity_score and match_factors
        """
        if not candidates:
            return []

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

            if total_score >= 0.5:  # Threshold
                # Create result without internal fields
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


class SellerNotificationEngine:
    """Generate notifications for sellers about their inventory"""
    
    @staticmethod
    def analyze_inventory(products: List[Dict]) -> List[Dict]:
        """
        Analyze seller's inventory and generate actionable notifications
        """
        notifications = []
        
        for product in products:
            urgency = ExpiryUrgencyScorer.calculate(product.get('expiry_date'))
            
            if urgency >= 0.9:
                notifications.append({
                    'type': 'critical_expiry',
                    'priority': 'high',
                    'product_id': product.get('product_id'),
                    'product_name': product.get('product_name'),
                    'message': f"⚠️ {product.get('product_name')} expires today/tomorrow! List now at 50%+ discount.",
                    'action': 'list_urgent',
                    'suggested_discount': 50
                })
            elif urgency >= 0.7:
                notifications.append({
                    'type': 'expiring_soon',
                    'priority': 'medium',
                    'product_id': product.get('product_id'),
                    'product_name': product.get('product_name'),
                    'message': f"🕐 {product.get('product_name')} expires in 2-3 days. Consider listing on marketplace.",
                    'action': 'list_soon',
                    'suggested_discount': 30
                })
            elif urgency >= 0.5:
                notifications.append({
                    'type': 'plan_ahead',
                    'priority': 'low',
                    'product_id': product.get('product_id'),
                    'product_name': product.get('product_name'),
                    'message': f"📅 {product.get('product_name')} expires within a week. Plan to use or sell.",
                    'action': 'plan',
                    'suggested_discount': 15
                })
        
        # Sort by priority
        priority_order = {'high': 0, 'medium': 1, 'low': 2}
        notifications.sort(key=lambda x: priority_order.get(x['priority'], 3))
        
        return notifications


class BuyerNotificationEngine:
    """Generate notifications for buyers about matching listings"""
    
    @staticmethod
    def find_matches(buyer_preferences: Dict, listings: List[Dict], limit: int = 10) -> List[Dict]:
        """
        Find and rank listings that match buyer preferences
        """
        matches = []
        
        for listing in listings:
            score = BuyerMatcher.score_match(listing, buyer_preferences)
            
            if score >= 0.3:  # Minimum threshold
                matches.append({
                    'listing': listing,
                    'match_score': round(score, 2),
                    'notification': _generate_buyer_notification(listing, score)
                })
        
        # Sort by match score descending
        matches.sort(key=lambda x: x['match_score'], reverse=True)
        
        return matches[:limit]


def _generate_buyer_notification(listing: Dict, score: float) -> Dict:
    """Generate notification message for buyer"""
    urgency = ExpiryUrgencyScorer.calculate(listing.get('expiry_date'))
    
    if score >= 0.8:
        message = f"🎯 Perfect match! {listing.get('title')} at great price."
    elif score >= 0.6:
        message = f"👍 Good deal: {listing.get('title')} matches your preferences."
    else:
        message = f"💡 You might like: {listing.get('title')}"
    
    if urgency >= 0.8:
        message += " Act fast - expiring soon!"
    
    return {
        'type': 'match_found',
        'priority': 'high' if score >= 0.7 else 'medium',
        'message': message,
        'listing_id': listing.get('listing_id')
    }


# ============================================================================
# API Routes
# ============================================================================

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'service': 'recommendation-engine'})


@app.route('/api/v1/recommendations/price', methods=['POST'])
def get_price_recommendation():
    """
    Get recommended selling price for a product
    
    Request body:
    {
        "original_price": 10.00,
        "expiry_date": "2026-01-28",
        "category": "dairy"
    }
    """
    data = request.get_json()
    
    if not data.get('original_price'):
        return jsonify({'error': 'original_price is required'}), 400
    
    recommendation = PriceRecommender.calculate(
        original_price=float(data['original_price']),
        expiry_date=data.get('expiry_date'),
        category=data.get('category', 'other')
    )
    
    return jsonify(recommendation)


@app.route('/api/v1/recommendations/seller/notifications', methods=['POST'])
def get_seller_notifications():
    """
    Analyze seller's inventory and return notifications
    
    Request body:
    {
        "products": [
            {
                "product_id": "uuid",
                "product_name": "Milk",
                "expiry_date": "2026-01-26",
                "category": "dairy"
            }
        ]
    }
    """
    data = request.get_json()
    
    if not data.get('products'):
        return jsonify({'error': 'products array is required'}), 400
    
    notifications = SellerNotificationEngine.analyze_inventory(data['products'])
    
    return jsonify({
        'notifications': notifications,
        'count': len(notifications),
        'generated_at': datetime.utcnow().isoformat()
    })


@app.route('/api/v1/recommendations/buyer/matches', methods=['POST'])
def get_buyer_matches():
    """
    Find listings matching buyer preferences
    
    Request body:
    {
        "preferences": {
            "preferred_categories": ["dairy", "produce"],
            "max_price": 15.00,
            "max_distance_km": 5,
            "min_days_until_expiry": 2
        },
        "listings": [
            {
                "listing_id": "uuid",
                "title": "Fresh Milk",
                "price": 8.00,
                "category": "dairy",
                "expiry_date": "2026-01-28",
                "distance_km": 2.5
            }
        ]
    }
    """
    data = request.get_json()
    
    if not data.get('preferences') or not data.get('listings'):
        return jsonify({'error': 'preferences and listings are required'}), 400
    
    matches = BuyerNotificationEngine.find_matches(
        buyer_preferences=data['preferences'],
        listings=data['listings'],
        limit=data.get('limit', 10)
    )
    
    return jsonify({
        'matches': matches,
        'count': len(matches),
        'generated_at': datetime.utcnow().isoformat()
    })


@app.route('/api/v1/recommendations/urgency', methods=['POST'])
def calculate_urgency():
    """
    Calculate urgency score for items
    
    Request body:
    {
        "items": [
            {"id": "1", "expiry_date": "2026-01-26"},
            {"id": "2", "expiry_date": "2026-01-30"}
        ]
    }
    """
    data = request.get_json()
    
    if not data.get('items'):
        return jsonify({'error': 'items array is required'}), 400
    
    results = []
    for item in data['items']:
        urgency = ExpiryUrgencyScorer.calculate(item.get('expiry_date'))
        results.append({
            'id': item.get('id'),
            'expiry_date': item.get('expiry_date'),
            'urgency_score': round(urgency, 2),
            'urgency_level': _get_urgency_level(urgency)
        })
    
    return jsonify({'results': results})


@app.route('/api/v1/recommendations/similar', methods=['POST'])
def get_similar_products():
    """
    Find similar products based on multi-factor scoring.

    Request body:
    {
        "target": {
            "id": 1,
            "title": "Fresh Apples",
            "description": "Organic green apples",
            "category": "produce",
            "price": 5.00,
            "days_until_expiry": 5,
            "sellerId": 1
        },
        "candidates": [
            {
                "id": 2,
                "title": "Red Apples",
                "description": "Sweet red apples",
                "category": "produce",
                "price": 4.50,
                "distance_km": 2.5,
                "days_until_expiry": 4,
                "sellerId": 2,
                ... (full listing fields)
            }
        ],
        "limit": 6
    }
    """
    data = request.get_json()

    if not data.get('target') or not data.get('candidates'):
        return jsonify({'error': 'target and candidates are required'}), 400

    similar = SimilarProductsMatcher.find_similar(
        target=data['target'],
        candidates=data['candidates'],
        limit=data.get('limit', 6)
    )

    return jsonify({
        'similar_products': similar,
        'count': len(similar),
        'threshold': 0.5,
        'generated_at': datetime.utcnow().isoformat()
    })


def _get_urgency_level(score: float) -> str:
    if score >= 0.9:
        return 'critical'
    elif score >= 0.7:
        return 'high'
    elif score >= 0.4:
        return 'medium'
    else:
        return 'low'


# ============================================================================
# Entry Point
# ============================================================================

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    print(f"🚀 Recommendation Engine starting on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug)
