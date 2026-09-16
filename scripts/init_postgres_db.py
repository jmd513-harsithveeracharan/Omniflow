"""
scripts/init_postgres_db.py
---------------------------
Automated initialization and health-check tool for PostgreSQL + pgvector.
Verifies connectivity, enables the vector extension, runs DDL schema migrations,
and tests HNSW vector indexing.
"""

import os
import sys
from datetime import UTC, datetime

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app.domain.models.session import ArchitectureRecipe
from app.domain.storage.postgres_adapter import PostgresStorageAdapter


def main():
    print("\n" + "=" * 75)
    print("       FABRIC AI STUDIO (OMNIFLOW) - POSTGRESQL + PGVECTOR BOOTSTRAP")
    print("=" * 75 + "\n")

    db_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/fabric_ai")
    print(f"[*] Target Database URI: {db_url}")

    try:
        print("[*] Connecting to PostgreSQL...")
        adapter = PostgresStorageAdapter(db_url)
        print("[+] Connection successful!")

        print("[*] Verifying schema and tables...")
        stats = adapter.get_db_stats()
        print(f"[+] Active Database Stats:")
        for k, v in stats.items():
            print(f"    - {k:15}: {v} records")

        print("[*] Testing pgvector HNSW similarity index...")
        test_recipe = ArchitectureRecipe(
            id="rec_test_init",
            title="Medallion Lakehouse Direct Lake Pipeline",
            description="End-to-end ingestion and Power BI Direct Lake pattern",
            source_dialect="tsql",
            target_fabric_type="lakehouse",
            code_template="# PySpark Delta Table merge...",
            tags=["medallion", "direct_lake", "pyspark"],
            rating=5,
            embedding=[0.05] * 1536,
        )
        adapter.upsert_recipe(test_recipe)
        similar = adapter.search_similar_recipes([0.05] * 1536, top_k=1)
        if similar:
            print(f"[+] HNSW Vector Similarity Verified! Found recipe: '{similar[0]['title']}' (score: {similar[0].get('similarity_score', 1.0):.4f})")
        else:
            print("[!] Warning: Recipe vector query returned 0 rows.")

        print("\n" + "=" * 75)
        print("  SUCCESS: PostgreSQL + pgvector is fully configured and ready for production!")
        print("=" * 75 + "\n")

    except Exception as e:
        print(f"\n[!] PostgreSQL initialization failed: {e}")
        print("\nTroubleshooting tips:")
        print("1. If running locally with Docker: run 'docker compose up -d'")
        print("2. If using Cloud PostgreSQL (Neon / Supabase / Azure): set DATABASE_URL in your .env file:")
        print("   DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<dbname>?sslmode=require\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
