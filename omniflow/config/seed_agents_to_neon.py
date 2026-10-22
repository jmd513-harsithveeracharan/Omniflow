from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from omniflow.db.postgres_repo import PostgresRepository


def main() -> None:
    repo = PostgresRepository()
    stats = repo.bootstrap_registry(reset_synthesized_tools=False)
    print(f"[seed_agents] Synced {stats['agents_seeded']} core agents and {stats['base_tools_seeded']} base tools to Neon PostgreSQL.")


if __name__ == "__main__":
    main()
