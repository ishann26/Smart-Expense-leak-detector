"""
app.py — Flask REST API
Exposes the AI engine at POST /analyze so your existing
index.html / script.js can call it instead of the JS rule engine.

Run:
  pip install flask flask-cors
  python app.py

Endpoints:
  POST /analyze        — analyze expenses, returns full report JSON
  GET  /health         — server health check
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from ai.engine import ExpenseAI

app = Flask(__name__)
CORS(app)   # allow calls from index.html served on any port

ai_engine = ExpenseAI()


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "engine": "Smart Expense AI v1.0"})


@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json(silent=True)

    if not data or "expenses" not in data:
        return jsonify({"error": "Send JSON with key 'expenses'"}), 400

    raw_expenses = data["expenses"]
    raw_rules = data.get("rules", []) # Fetch custom rules if they exist

    # Normalise + validate expenses
    expenses = []
    for row in raw_expenses:
        try:
            expenses.append({
                "desc": str(row.get("desc", "")),
                "amount": float(row.get("amount", 0)),
                "category": str(row.get("category", "Others")),
                "date": str(row.get("date", "")),
            })
        except (ValueError, TypeError):
            continue

    expenses = [e for e in expenses if e["desc"] and e["amount"] > 0]
    if len(expenses) < 2:
        return jsonify({"error": "Add at least 2 valid expenses"}), 422

    # Pass BOTH expenses and rules to the engine
    result = ai_engine.analyze(expenses, custom_rules=raw_rules)
    return jsonify(result)


if __name__ == "__main__":
    print("Starting Smart Expense AI server on http://localhost:5000")
    app.run(debug=True, port=5000)