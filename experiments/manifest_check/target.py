"""Order book matching engine — toy implementation."""

from __future__ import annotations

import heapq
import time
from dataclasses import dataclass, field
from typing import Optional


@dataclass(order=True)
class Order:
    price: float
    ts: float = field(compare=True)
    side: str = field(compare=False)
    qty: int = field(compare=False)
    id: str = field(compare=False)


class Book:
    def __init__(self) -> None:
        self.bids: list[Order] = []   # max-heap via negated price
        self.asks: list[Order] = []   # min-heap

    def submit(self, order: Order) -> list[tuple[str, str, int, float]]:
        fills: list[tuple[str, str, int, float]] = []
        if order.side == "buy":
            while order.qty > 0 and self.asks and self.asks[0].price <= order.price:
                top = self.asks[0]
                take = min(order.qty, top.qty)
                fills.append((order.id, top.id, take, top.price))
                order.qty -= take
                top.qty -= take
                if top.qty == 0:
                    heapq.heappop(self.asks)
            if order.qty > 0:
                heapq.heappush(self.bids, Order(-order.price, order.ts, "buy", order.qty, order.id))
        else:
            while order.qty > 0 and self.bids and -self.bids[0].price >= order.price:
                top = self.bids[0]
                take = min(order.qty, top.qty)
                fills.append((top.id, order.id, take, -top.price))
                order.qty -= take
                top.qty -= take
                if top.qty == 0:
                    heapq.heappop(self.bids)
            if order.qty > 0:
                heapq.heappush(self.asks, Order(order.price, order.ts, "sell", order.qty, order.id))
        return fills

    def best_bid(self) -> Optional[float]:
        return -self.bids[0].price if self.bids else None

    def best_ask(self) -> Optional[float]:
        return self.asks[0].price if self.asks else None


def now() -> float:
    return time.time()
