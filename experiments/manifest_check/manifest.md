# target.py — line manifest

Strict line-by-line claims about `target.py`. Each entry MUST hold at the listed
line number exactly. No fuzzy matching, no "near line N" — the claim is precisely
what is on that line in the source file.

| Line | Claim |
|------|-------|
| 1  | Module docstring describing the order-book engine. |
| 3  | `import heapq` — heap primitives for the order book. |
| 5  | `class Book:` — the order-book class is declared here. |
| 6  | `def __init__(self) -> None:` — Book constructor. |
| 7  | `self.bids: list[Order] = []` — bid side initialized. |
| 8  | `self.asks: list[Order] = []` — ask side initialized. |
| 10 | `def submit(self, order: Order)` — submit method signature. |
| 11 | `fills: list[tuple[str, str, int, float]] = []` — fills list created. |
| 13 | `if order.side == "buy":` — buy-side matching branch begins. |
| 22 | `heapq.heappush(self.bids, ...)` — leftover buy quantity rests on the book. |
| 24 | `else:` — sell-side matching branch begins. |
| 38 | `def best_bid(self)` — returns the top of the bid heap (negated). |
| 41 | `def best_ask(self)` — returns the top of the ask heap. |
| 44 | `def now() -> float:` — wall-clock helper returning `time.time()`. |
