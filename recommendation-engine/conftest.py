"""
Shared test fixtures for recommendation engine tests.

Pytest auto-discovers this file and makes fixtures available to all test files.
"""

import pytest
from datetime import datetime, timedelta
from app import app


# ============================================================================
# Helpers
# ============================================================================

def days_from_now(n):
    """Generate ISO date string n days from today. Negative = past."""
    return (datetime.now() + timedelta(days=n)).isoformat()


# ============================================================================
# Flask Test Client
# ============================================================================

@pytest.fixture
def client():
    """Flask test client - sends HTTP requests without starting the server."""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


# ============================================================================
# Sample Data Fixtures
# ============================================================================

@pytest.fixture
def sample_listing():
    """Single marketplace listing with all fields (target for similar products)."""
    return {
        "id": 1,
        "sellerId": 1,
        "title": "Fresh Apples",
        "description": "Organic green apples from local farm",
        "category": "produce",
        "price": 5.00,
        "originalPrice": 8.00,
        "quantity": 3,
        "unit": "kg",
        "expiryDate": days_from_now(5),
        "days_until_expiry": 5,
        "distance_km": 2.5,
        "pickupLocation": "123 Main St",
        "images": None,
        "status": "active",
        "createdAt": datetime.now().isoformat(),
        "seller": {"id": 1, "name": "Test Seller"},
    }


@pytest.fixture
def sample_candidates():
    """3 candidate listings with varying categories, prices, and distances."""
    return [
        {
            "id": 2,
            "sellerId": 2,
            "title": "Red Apples",
            "description": "Sweet red apples from orchard",
            "category": "produce",
            "price": 4.50,
            "originalPrice": 7.00,
            "quantity": 2,
            "unit": "kg",
            "expiryDate": days_from_now(4),
            "days_until_expiry": 4,
            "distance_km": 1.5,
            "pickupLocation": "456 Oak Ave",
            "images": None,
            "status": "active",
            "createdAt": datetime.now().isoformat(),
            "seller": {"id": 2, "name": "Seller Two"},
        },
        {
            "id": 3,
            "sellerId": 3,
            "title": "Whole Milk",
            "description": "Fresh full cream milk 1L",
            "category": "dairy",
            "price": 3.00,
            "originalPrice": 5.50,
            "quantity": 1,
            "unit": "L",
            "expiryDate": days_from_now(2),
            "days_until_expiry": 2,
            "distance_km": 3.0,
            "pickupLocation": "789 Elm St",
            "images": None,
            "status": "active",
            "createdAt": datetime.now().isoformat(),
            "seller": {"id": 3, "name": "Seller Three"},
        },
        {
            "id": 4,
            "sellerId": 4,
            "title": "Frozen Pizza",
            "description": "Margherita frozen pizza family size",
            "category": "frozen",
            "price": 12.00,
            "originalPrice": 15.00,
            "quantity": 1,
            "unit": "item",
            "expiryDate": days_from_now(30),
            "days_until_expiry": 30,
            "distance_km": 8.0,
            "pickupLocation": "321 Pine Rd",
            "images": None,
            "status": "active",
            "createdAt": datetime.now().isoformat(),
            "seller": {"id": 4, "name": "Seller Four"},
        },
    ]


