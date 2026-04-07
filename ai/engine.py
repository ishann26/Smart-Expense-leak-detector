"""
engine.py — Main AI Engine
Orchestrates the three-layer pipeline:
  1. BFS/DFS  → build expense graph + detect clusters
  2. CSP      → check budget rule violations
  3. A*       → rank violations by priority score

Usage:
  from ai.engine import ExpenseAI
  result = ExpenseAI().analyze(expenses)
"""

from ai.graph_builder import ExpenseGraph
from ai.csp_solver import CSPSolver
from ai.astar_prioritizer import AStarPrioritizer


class ExpenseAI:
    def __init__(self):
        self.graph_builder = ExpenseGraph()
        self.csp_solver = CSPSolver()
        self.prioritizer = AStarPrioritizer()

    def analyze(self, expenses: list[dict], custom_rules: list[dict] = None) -> dict:
        """
        expenses: list of dicts with keys: { "desc": str, "amount": float, "category": str, "date": str }
        custom_rules: optional list of dicts with keys: { "name": str, "category": str, "max_pct": float, "min_amount": float, "severity": str }
        """
        if not expenses:
            return {"error": "No expense data provided"}

        total = sum(e["amount"] for e in expenses)
        if total == 0:
            return {"error": "All amounts are zero"}

        # ── Setup Dynamic Rules ──────────────────────────────────────────
        if custom_rules:
            from ai.csp_solver import Constraint
            constraints = []
            for r in custom_rules:
                constraints.append(Constraint(
                    name=r.get("name", "Custom Rule"),
                    category=r.get("category", "Others"),
                    max_pct=float(r.get("max_pct", 10)) / 100.0, # Convert 15% to 0.15
                    min_amount=float(r.get("min_amount", 0)),
                    severity=r.get("severity", "med"),
                    tip="You broke your custom budget rule!"
                ))
            self.csp_solver = CSPSolver(constraints)
        else:
            self.csp_solver = CSPSolver() # Revert to defaults if no custom rules

        # ── Layer 1: BFS/DFS ─────────────────────────────────────────────
        graph = ExpenseGraph().build(expenses)
        cat_totals = graph.category_totals()
        clusters = graph.get_spend_clusters()

        # ── Layer 2: CSP ─────────────────────────────────────────────────
        violations = self.csp_solver.solve(cat_totals, total)

        # ── Layer 3: A* ──────────────────────────────────────────────────
        ranked_leaks = self.prioritizer.prioritize(violations, total)
        health = self.prioritizer.compute_health_score(ranked_leaks, total)

        return {
            "total": total,
            "category_totals": cat_totals,
            "spend_clusters": clusters,
            "leaks": [
                {
                    "rank": l.rank,
                    "name": l.name,
                    "category": l.category,
                    "severity": l.severity,
                    "amount": l.amount,
                    "overspend": round(l.overspend),
                    "saving": l.saving,
                    "pct_of_total": l.pct_of_total,
                    "tip": l.tip,
                    "f_score": l.f_score,
                }
                for l in ranked_leaks
            ],
            "health": health,
            "recommendations": self._generate_recs(ranked_leaks),
        }

    def _generate_recs(self, leaks) -> list[dict]:
        recs = []
        names = {l.name for l in leaks}

        if "Subscription Creep" in names:
            recs.append({
                "title": "Subscription Audit Sprint",
                "desc": "Cancel anything unused for 30+ days. Merge overlapping services.",
                "saving": "Save up to ₹1,200/month",
            })
        if "Food Delivery Overload" in names:
            recs.append({
                "title": "Meal Prep 3×/Week",
                "desc": "Batch cooking 3 meals/week typically halves food delivery spend.",
                "saving": "Save up to ₹1,800/month",
            })
        if "Impulse Shopping" in names:
            recs.append({
                "title": "48-Hour Purchase Rule",
                "desc": "Add to cart, wait 48 hours. 60% of impulse items get abandoned naturally.",
                "saving": "Save up to ₹900/month",
            })
        if "Transport Waste" in names:
            recs.append({
                "title": "Transport Optimisation",
                "desc": "Evaluate monthly pass vs per-ride. Batch errands to cut individual trips.",
                "saving": "Save up to ₹500/month",
            })

        recs.append({
            "title": "Zero-Based Budget Review",
            "desc": "Assign every rupee a job at month start. Reduces spending by ~15% in month one.",
            "saving": "Ongoing control",
        })
        recs.append({
            "title": "Automate Savings First",
            "desc": "Auto-transfer 20% of income to savings the moment salary arrives.",
            "saving": "Builds long-term wealth",
        })

        return recs