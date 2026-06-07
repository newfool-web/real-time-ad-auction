"""Synthetic impression data generator.

Asli ad data nahi hai, isliye ek hidden 'true' click behaviour define karke
labelled impressions banate hain. Model ka kaam in patterns ko seekhna hai.
"""
import numpy as np

DEVICES = ["mobile", "desktop", "tablet"]
COUNTRIES = ["IN", "US", "UK", "DE"]
# Real-world ad categories (har brand ki actual industry). Saari first-class hain.
CATEGORIES = ["sports", "electronics", "food", "watches", "automobile", "beauty"]
# User interests: categories + thodi noise (jinpe koi advertiser nahi).
INTERESTS = ["sports", "electronics", "food", "watches", "automobile", "beauty", "travel", "news", "gaming"]


def _hidden_click_prob(interest_match: int, device: str, hour: int, category: str) -> float:
    """Hidden rule jo model ko seekhna hai (plus thoda noise)."""
    base = 0.02
    if interest_match:
        base += 0.06  # relevant ad -> zyada click (har category ke liye)
    if device == "mobile":
        base += 0.015
    if 18 <= hour <= 22:  # prime time
        base += 0.02
    if category == "automobile":
        base -= 0.01  # high-consideration purchase -> click thoda kam
    return min(max(base, 0.001), 0.5)


def make_dataset(n: int = 20000, seed: int = 42):
    rng = np.random.default_rng(seed)
    X, y = [], []
    for _ in range(n):
        category = rng.choice(CATEGORIES)
        # user ke interests (1-3 random)
        k = rng.integers(1, 4)
        user_interests = list(rng.choice(INTERESTS, size=k, replace=False))
        device = rng.choice(DEVICES)
        country = rng.choice(COUNTRIES)
        hour = int(rng.integers(0, 24))

        interest_match = int(category in user_interests)
        p = _hidden_click_prob(interest_match, device, hour, category)
        clicked = int(rng.random() < p)

        X.append(featurize(user_interests, device, country, hour, category))
        y.append(clicked)
    return np.array(X, dtype=float), np.array(y, dtype=int)


def featurize(interests, device, country, hour, ad_category):
    """Request ko fixed-length numeric vector me badalna (one-hot + flags)."""
    feats = []
    # interest match flag for the ad category
    feats.append(1.0 if ad_category in interests else 0.0)
    # number of interests
    feats.append(float(len(interests)))
    # device one-hot
    for d in DEVICES:
        feats.append(1.0 if device == d else 0.0)
    # country one-hot
    for c in COUNTRIES:
        feats.append(1.0 if country == c else 0.0)
    # category one-hot
    for cat in CATEGORIES:
        feats.append(1.0 if ad_category == cat else 0.0)
    # cyclical hour
    feats.append(np.sin(2 * np.pi * hour / 24))
    feats.append(np.cos(2 * np.pi * hour / 24))
    return feats
