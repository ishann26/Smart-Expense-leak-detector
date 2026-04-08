"""
test_ai.py — Quick smoke test for the AI pipeline
Run: python test_ai.py
No external dependencies — just the ai/ package.
"""

import json
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from ai.engine import ExpenseAI

DEMO_EXPENSES = [
    {"desc": "Netflix",          "amount": 649,  "category": "Subscriptions", "date": "2025-04-01"},
    {"desc": "Amazon Prime",     "amount": 299,  "category": "Subscriptions", "date": "2025-04-01"},
    {"desc": "Hotstar",          "amount": 899,  "category": "Subscriptions", "date": "2025-04-02"},
    {"desc": "Spotify",          "amount": 119,  "category": "Subscriptions", "date": "2025-04-03"},
    {"desc": "Swiggy Dinner",    "amount": 480,  "category": "Food",          "date": "2025-04-01"},
    {"desc": "Zomato Lunch",     "amount": 320,  "category": "Food",          "date": "2025-04-02"},
    {"desc": "Uber Eats",        "amount": 270,  "category": "Food",          "date": "2025-04-03"},
    {"desc": "Random Snacks",    "amount": 150,  "category": "Food",          "date": "2025-04-04"},
    {"desc": "Electricity",      "amount": 2100, "category": "Utilities",     "date": "2025-04-05"},
    {"desc": "Internet",         "amount": 999,  "category": "Utilities",     "date": "2025-04-05"},
    {"desc": "Mobile Plan",      "amount": 799,  "category": "Utilities",     "date": "2025-04-06"},
    {"desc": "Gym Membership",   "amount": 1500, "category": "Subscriptions", "date": "2025-04-06"},
    {"desc": "Cab to Office",    "amount": 650,  "category": "Transport",     "date": "2025-04-07"},
    {"desc": "Petrol",           "amount": 1800, "category": "Transport",     "date": "2025-04-08"},
    {"desc": "New Shoes",        "amount": 2999, "category": "Shopping",      "date": "2025-04-09"},
    {"desc": "Online Impulse",   "amount": 1799, "category": "Shopping",      "date": "2025-04-10"},
    {"desc": "Movie Tickets",    "amount": 700,  "category": "Entertainment", "date": "2025-04-11"},
    {"desc": "Coffee x30",       "amount": 1800, "category": "Food",          "date": "2025-04-12"},
    {"desc": "Cloud Storage",    "amount": 130,  "category": "Subscriptions", "date": "2025-04-13"},
    {"desc": "VPN Service",      "amount": 250,  "category": "Subscriptions", "date": "2025-04-14"},
]


def run_test():
    engine = ExpenseAI()
    result = engine.analyze(DEMO_EXPENSES)

    print("=" * 60)
    print("SMART EXPENSE AI — TEST RESULTS")
    print("=" * 60)

    print(f"\nTotal spend : ₹{result['total']:,.0f}")
    print(f"Health score: {result['health']['score']}/100  Grade: {result['health']['grade']}")
    print(f"Verdict     : {result['health']['verdict']}")
    print(f"Total savings possible: ₹{result['health']['total_savings']:,.0f}/month")

    print(f"\nSpend clusters ({len(result['spend_clusters'])} found):")
    for i, cluster in enumerate(result['spend_clusters'], 1):
        print(f"  Cluster {i}: {' → '.join(cluster)}")

    print(f"\nLeaks detected ({len(result['leaks'])} total, ranked by A* f-score):")
    for leak in result['leaks']:
        bar = "█" * int(leak['f_score'] / 500)
        print(f"  #{leak['rank']} [{leak['severity'].upper():4}] {leak['name']:<25} "
              f"₹{leak['amount']:>6,.0f}  f={leak['f_score']:>8.1f}  {bar}")

    print(f"\nTop recommendation: {result['recommendations'][0]['title']}")
    print(f"  → {result['recommendations'][0]['desc']}")

    print("\n" + "=" * 60)
    print("Full JSON output saved to test_output.json")
    with open("test_output.json", "w") as f:
        json.dump(result, f, indent=2)


if __name__ == "__main__":
    run_test()