"""
csp_solver.py — Constraint Satisfaction Problem Layer
Defines budget rules as constraints and checks violations.
Each constraint is: category spending must not exceed X% of total AND an absolute minimum.
"""

from dataclasses import dataclass, field


@dataclass
class Constraint:
    name: str
    category: str
    max_pct: float          # e.g. 0.22 = 22% of total spend
    min_amount: float       # The minimum absolute rupees required to trigger a leak
    severity: str           # "high" | "med" | "low"
    tip: str = ""


@dataclass
class Violation:
    constraint: Constraint
    actual_amount: float
    actual_pct: float
    overspend: float        # how much over the allowed limit
    saving_estimate: float  # realistic saving if fixed


# ── Default rule set (with absolute minimums added) ────────────────────────
DEFAULT_CONSTRAINTS = [
    Constraint(
        name="Subscription Creep",
        category="Subscriptions",
        max_pct=0.12,
        min_amount=300,     # Don't flag unless they spend at least ₹300
        severity="high",
        tip="Too many subscriptions overlap in content. Audit and cancel unused ones.",
    ),
    Constraint(
        name="Food Delivery Overload",
        category="Food",
        max_pct=0.20,
        min_amount=800,     # Don't flag unless they spend at least ₹800
        severity="high",
        tip="Food spend exceeds 20%. Cooking 3 days/week can cut this significantly.",
    ),
    Constraint(
        name="Impulse Shopping",
        category="Shopping",
        max_pct=0.15,
        min_amount=500,     # Don't flag unless they spend at least ₹500
        severity="med",
        tip="Apply a 48-hour rule before any purchase over ₹500.",
    ),
    Constraint(
        name="Transport Waste",
        category="Transport",
        max_pct=0.12,
        min_amount=500,     # Don't flag unless they spend at least ₹500
        severity="med",
        tip="Consider monthly passes or carpooling to reduce per-trip costs.",
    ),
    Constraint(
        name="Entertainment Excess",
        category="Entertainment",
        max_pct=0.10,
        min_amount=500,     # Don't flag unless they spend at least ₹500
        severity="low",
        tip="Look for free events, early-bird tickets, and family-share plans.",
    ),
    Constraint(
        name="Utility Overspend",
        category="Utilities",
        max_pct=0.15,
        min_amount=1000,    # Don't flag unless they spend at least ₹1000
        severity="low",
        tip="Check for vampire appliances and consider a lower mobile plan tier.",
    ),
]

SAVING_RATE = {"high": 0.45, "med": 0.40, "low": 0.25}


class CSPSolver:
    def __init__(self, constraints: list[Constraint] = None):
        self.constraints = constraints or DEFAULT_CONSTRAINTS

    def solve(self, cat_totals: dict[str, float], total: float) -> list[Violation]:
        """
        Returns list of Violation for every constraint that is breached.
        """
        if total == 0:
            return []

        # BASELINE BUDGET FIX: 
        # If the user only enters ₹200, evaluate percentages as if they have ₹5000.
        # This prevents tiny data entries from artificially bloating the percentages.
        effective_total = max(total, 5000)

        violations = []
        for c in self.constraints:
            actual = cat_totals.get(c.category, 0.0)
            
            # Calculate percentage against the effective total
            pct = actual / effective_total

            # MINIMUM AMOUNT FIX: 
            # Must violate the percentage rule AND exceed the absolute minimum rupee threshold
            if pct > c.max_pct and actual > c.min_amount:
                allowed = c.max_pct * effective_total
                overspend = actual - allowed
                saving = actual * SAVING_RATE[c.severity]
                violations.append(
                    Violation(
                        constraint=c,
                        actual_amount=actual,
                        actual_pct=(actual / total), # Keep display percentage based on real total
                        overspend=overspend,
                        saving_estimate=saving,
                    )
                )

        return violations

    def add_constraint(self, constraint: Constraint):
        """Dynamically add a new rule at runtime."""
        self.constraints.append(constraint)