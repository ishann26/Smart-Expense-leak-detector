"""
astar_prioritizer.py — A* Best-First Prioritization Layer
Ranks detected violations by a composite f-score:
  f(n) = g(n) + h(n)
  g(n) = actual overspend (cost already paid)
  h(n) = estimated saving potential (heuristic of future gain)
Violations with the highest f-score should be fixed first.
"""

import heapq
from dataclasses import dataclass
from ai.csp_solver import Violation


SEV_WEIGHT = {"high": 3.0, "med": 2.0, "low": 1.0}


@dataclass
class RankedLeak:
    rank: int
    name: str
    category: str
    severity: str
    amount: float
    overspend: float
    saving: float
    pct_of_total: float
    tip: str
    f_score: float


class AStarPrioritizer:
    """
    Uses A*-style scoring to order violations by urgency.
    g = money already wasted above the allowed limit
    h = money that can realistically be saved (weighted by severity)
    """

    def prioritize(self, violations: list[Violation], total: float) -> list[RankedLeak]:
        heap = []  # min-heap, so we negate f for max-first ordering

        for v in violations:
            sev = v.constraint.severity
            w = SEV_WEIGHT[sev]

            g = v.overspend                    # already overspent
            h = v.saving_estimate * w          # weighted saving potential
            f = g + h

            heapq.heappush(heap, (-f, v))      # negate for max-heap behaviour

        ranked = []
        rank = 1
        while heap:
            neg_f, v = heapq.heappop(heap)
            ranked.append(
                RankedLeak(
                    rank=rank,
                    name=v.constraint.name,
                    category=v.constraint.category,
                    severity=v.constraint.severity,
                    amount=v.actual_amount,
                    overspend=v.overspend,
                    saving=round(v.saving_estimate),
                    pct_of_total=round(v.actual_pct * 100, 1),
                    tip=v.constraint.tip,
                    f_score=round(-neg_f, 2),
                )
            )
            rank += 1

        return ranked

    def compute_health_score(self, ranked_leaks: list[RankedLeak], total: float) -> dict:
        """
        Computes an overall financial health score (0-100)
        and a letter grade based on how much is leaking.
        """
        if total == 0:
            return {"score": 100, "grade": "A", "verdict": "No data"}

        leak_total = sum(l.amount for l in ranked_leaks)
        leak_pct = leak_total / total
        score = max(5, min(100, round(100 - leak_pct * 120)))

        if score >= 85:
            grade, verdict = "A", "Excellent control — minimal leaks detected"
        elif score >= 70:
            grade, verdict = "B", "Good shape, but a few leaks worth fixing"
        elif score >= 55:
            grade, verdict = "C", "Several leaks draining your budget"
        elif score >= 40:
            grade, verdict = "D", "Significant financial leakage detected"
        else:
            grade, verdict = "F", "Critical — money is flowing out fast"

        return {
            "score": score,
            "grade": grade,
            "verdict": verdict,
            "total_savings": sum(l.saving for l in ranked_leaks),
            "leak_total": round(leak_total),
        }