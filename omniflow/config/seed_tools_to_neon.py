from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from omniflow.db.postgres_repo import PostgresRepository


def main() -> None:
    repo = PostgresRepository()
    stats = repo.bootstrap_registry(reset_synthesized_tools=False)
    tools = repo.get_all_active_tools()
    print(f"[seed_tools] Seeded {stats['base_tools_seeded']} base tools. Active tools in PostgreSQL: {list(tools.keys())}")


if __name__ == "__main__":
    main()
