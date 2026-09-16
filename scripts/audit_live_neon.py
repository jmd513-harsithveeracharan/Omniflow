import os
import sys
from dotenv import load_dotenv
import psycopg
from psycopg.rows import dict_row

load_dotenv()
db_url = os.getenv("DATABASE_URL")
print(f"Connecting to: {db_url.split('@')[-1]}")

conn = psycopg.connect(db_url, row_factory=dict_row)
cur = conn.cursor()

cur.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
""")
tables = [r["table_name"] for r in cur.fetchall()]

print("\n" + "=" * 80)
print(f"       LIVE NEON POSTGRESQL DATABASE AUDIT ({len(tables)} TABLES)")
print("=" * 80 + "\n")

for t in tables:
    cur.execute(f"SELECT count(*) as count FROM {t};")
    cnt = cur.fetchone()["count"]
    cur.execute(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{t}' ORDER BY ordinal_position;")
    cols = [f"{c['column_name']} ({c['data_type']})" for c in cur.fetchall()]
    print(f"[+] TABLE: {t:20} | Rows: {cnt:<6} | Columns ({len(cols)}):")
    print("    " + ", ".join(cols))
    print()

# Check foreign key relationships
cur.execute("""
    SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY';
""")
fks = cur.fetchall()
print("=" * 80)
print(f"       FOREIGN KEY RELATIONSHIPS IN NEON ({len(fks)} RELATIONS)")
print("=" * 80 + "\n")
for fk in fks:
    print(f"  - {fk['table_name']}.{fk['column_name']} -> {fk['foreign_table_name']}.{fk['foreign_column_name']}")
print("\n" + "=" * 80 + "\n")
