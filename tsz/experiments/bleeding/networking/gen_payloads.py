#!/usr/bin/env python3
"""Generate JSON test payloads at 3 size tiers."""
import json, os

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, "payloads")
os.makedirs(OUT, exist_ok=True)

def make_payload(num_items, pad_size=0):
    """Generate a realistic API response payload."""
    items = []
    for i in range(num_items):
        items.append({
            "id": i + 1,
            "name": f"Item {i+1:04d}" + ("x" * pad_size),
            "price": round(9.99 + i * 0.37, 2),
            "category": ["electronics", "books", "clothing", "food"][i % 4],
            "in_stock": i % 3 != 0,
            "tags": [f"tag{j}" for j in range(min(i % 5 + 1, 5))],
        })

    payload = {
        "id": 12345,
        "user": {
            "name": "Jane Doe",
            "email": "jane@example.com",
            "address": {
                "street": "123 Main St",
                "city": "Portland",
                "state": "OR",
                "zip": "97201"
            }
        },
        "items": items,
        "metadata": {
            "total": sum(it["price"] for it in items),
            "currency": "USD",
            "timestamp": "2026-03-28T12:00:00Z",
            "request_id": "abc-def-123-456"
        }
    }
    return payload

# Small: ~100B target
small = make_payload(1)
# Medium: ~10KB target
medium = make_payload(50, pad_size=100)
# Large: ~1MB target
large = make_payload(2000, pad_size=300)

for name, data in [("small", small), ("medium", medium), ("large", large)]:
    path = os.path.join(OUT, f"{name}.json")
    raw = json.dumps(data, separators=(",", ":"))
    with open(path, "w") as f:
        f.write(raw)
    print(f"{name}: {len(raw):,} bytes -> {path}")
