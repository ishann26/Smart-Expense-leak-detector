"""
graph_builder.py — BFS/DFS Layer
Converts raw expense transactions into a traversable graph.
Each category = node. Shared date buckets = edges.
"""

from collections import defaultdict, deque


class ExpenseGraph:
    def __init__(self):
        self.nodes = {}       # cat -> { total, items, neighbors }
        self.adjacency = defaultdict(set)

    def build(self, expenses: list[dict]) -> "ExpenseGraph":
        """
        expenses: list of { desc, amount, category, date }
        Groups by category, links categories that share spending on the same date.
        """
        date_cats = defaultdict(set)

        for e in expenses:
            cat = e["category"]
            date = e.get("date", "")

            if cat not in self.nodes:
                self.nodes[cat] = {"total": 0.0, "items": [], "neighbors": set()}

            self.nodes[cat]["total"] += e["amount"]
            self.nodes[cat]["items"].append(e)
            date_cats[date].add(cat)

        # Link categories that appear on the same date (edges)
        for date, cats in date_cats.items():
            cats = list(cats)
            for i in range(len(cats)):
                for j in range(i + 1, len(cats)):
                    self.adjacency[cats[i]].add(cats[j])
                    self.adjacency[cats[j]].add(cats[i])
                    self.nodes[cats[i]]["neighbors"].add(cats[j])
                    self.nodes[cats[j]]["neighbors"].add(cats[i])

        return self

    def bfs(self, start: str) -> list[str]:
        """BFS from a start category — returns all reachable categories."""
        if start not in self.nodes:
            return []
        visited = set()
        queue = deque([start])
        order = []
        while queue:
            node = queue.popleft()
            if node in visited:
                continue
            visited.add(node)
            order.append(node)
            for neighbor in self.adjacency.get(node, []):
                if neighbor not in visited:
                    queue.append(neighbor)
        return order

    def dfs(self, start: str, visited: set = None) -> list[str]:
        """DFS from a start category — returns all reachable categories."""
        if visited is None:
            visited = set()
        if start not in self.nodes or start in visited:
            return []
        visited.add(start)
        result = [start]
        for neighbor in self.adjacency.get(start, []):
            result.extend(self.dfs(neighbor, visited))
        return result

    def get_spend_clusters(self) -> list[list[str]]:
        """Find connected components (spending clusters) using DFS."""
        visited = set()
        clusters = []
        for node in self.nodes:
            if node not in visited:
                cluster = self.dfs(node, visited)
                if cluster:
                    clusters.append(cluster)
        return clusters

    def category_totals(self) -> dict[str, float]:
        return {cat: data["total"] for cat, data in self.nodes.items()}