"""
omniflow/db/source_data_seeder.py
---------------------------------
Seeds a realistic operational PostgreSQL database schema ('source_crm') with
genuine eCommerce & commercial sales tables and rows inside Neon PostgreSQL.
Provides a real live source system that OmniFlow agents can dynamically introspect.
"""

from __future__ import annotations

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_URI = os.getenv("NEON_DATABASE_URL") or os.getenv("DATABASE_URL", "")


def seed_live_source_crm(db_uri: str = "") -> dict[str, int]:
    """Provisions schema 'source_crm' and populates 4 realistic tables with sample business data."""
    target_uri = db_uri or DB_URI or os.getenv("NEON_DATABASE_URL", "") or os.getenv("DATABASE_URL", "")
    if not target_uri:
        raise ValueError(
            "CRITICAL: PostgreSQL connection string not configured!\n"
            "Please set NEON_DATABASE_URL or DATABASE_URL in your .env or omniflow/.env file."
        )
    conn = psycopg2.connect(target_uri, connect_timeout=10)
    counts = {"customers": 0, "products": 0, "orders": 0, "order_items": 0}

    try:
        with conn.cursor() as cur:
            # 1. Create Schema
            cur.execute("CREATE SCHEMA IF NOT EXISTS source_crm;")

            # 2. Customers Table
            cur.execute("""
            CREATE TABLE IF NOT EXISTS source_crm.customers (
                customer_id SERIAL PRIMARY KEY,
                first_name VARCHAR(64) NOT NULL,
                last_name VARCHAR(64) NOT NULL,
                email VARCHAR(128) UNIQUE NOT NULL,
                phone VARCHAR(32),
                company VARCHAR(128),
                street_address VARCHAR(256),
                city VARCHAR(64),
                country VARCHAR(64),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            """)

            # 3. Products Table
            cur.execute("""
            CREATE TABLE IF NOT EXISTS source_crm.products (
                product_id SERIAL PRIMARY KEY,
                sku VARCHAR(32) UNIQUE NOT NULL,
                product_name VARCHAR(128) NOT NULL,
                category VARCHAR(64) NOT NULL,
                unit_price NUMERIC(10, 2) NOT NULL,
                cost NUMERIC(10, 2) NOT NULL,
                is_active BOOLEAN DEFAULT TRUE
            );
            """)

            # 4. Orders Table
            cur.execute("""
            CREATE TABLE IF NOT EXISTS source_crm.orders (
                order_id SERIAL PRIMARY KEY,
                customer_id INT REFERENCES source_crm.customers(customer_id),
                order_date TIMESTAMPTZ DEFAULT NOW(),
                status VARCHAR(32) NOT NULL,
                total_amount NUMERIC(12, 2) NOT NULL,
                payment_method VARCHAR(32),
                shipping_address VARCHAR(256),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            """)

            # 5. Order Items Table
            cur.execute("""
            CREATE TABLE IF NOT EXISTS source_crm.order_items (
                order_item_id SERIAL PRIMARY KEY,
                order_id INT REFERENCES source_crm.orders(order_id),
                product_id INT REFERENCES source_crm.products(product_id),
                quantity INT NOT NULL,
                unit_price NUMERIC(10, 2) NOT NULL,
                discount NUMERIC(5, 2) DEFAULT 0.00,
                line_total NUMERIC(12, 2) NOT NULL
            );
            """)

            # Insert sample data if empty
            cur.execute("SELECT COUNT(*) FROM source_crm.customers;")
            if cur.fetchone()[0] == 0:
                cur.execute("""
                INSERT INTO source_crm.customers (first_name, last_name, email, phone, company, street_address, city, country)
                VALUES 
                  ('Sarah', 'Jenkins', 'sarah.jenkins@acmehealth.com', '+1-617-555-0192', 'Acme Health Group', '742 Evergreen Terrace', 'Boston', 'USA'),
                  ('Marcus', 'Vance', 'm.vance@cryotech-logistics.de', '+49-89-555-4321', 'CryoTech Logistics GmbH', 'Leopoldstrasse 45', 'Munich', 'Germany'),
                  ('Elena', 'Rostova', 'elena.rostova@nordicbio.se', '+46-8-555-8899', 'Nordic Bio Labs', 'Kungsgatan 12', 'Stockholm', 'Sweden'),
                  ('Devon', 'Miles', 'devon.miles@apexpharma.co.uk', '+44-20-555-7733', 'Apex Pharma UK', '221B Baker Street', 'London', 'UK'),
                  ('Harsith', 'Bheesetti', 'harsith.bheesetti@pelibiothermal.com', '+1-763-555-9011', 'Peli BioThermal Global', '10050 89th Ave N', 'Maple Grove', 'USA'),
                  ('Claire', 'Dubois', 'c.dubois@sanofi-supply.fr', '+33-1-555-3412', 'Sanofi Supply Chain', 'Boulevard Haussmann 88', 'Paris', 'France'),
                  ('Kenji', 'Sato', 'k.sato@nippon-coldchain.jp', '+81-3-555-6677', 'Nippon Cold Chain KK', 'Marunouchi 1-1', 'Tokyo', 'Japan'),
                  ('Liam', 'OConnor', 'liam@dublinbiologics.ie', '+353-1-555-9922', 'Dublin Biologics Ltd', 'Grand Canal Dock 4', 'Dublin', 'Ireland');
                """)

            cur.execute("SELECT COUNT(*) FROM source_crm.products;")
            if cur.fetchone()[0] == 0:
                cur.execute("""
                INSERT INTO source_crm.products (sku, product_name, category, unit_price, cost, is_active)
                VALUES
                  ('PBT-CRYO-01', 'Credo Cube Thermal Shipper 4L', 'Thermal Shippers', 450.00, 180.00, TRUE),
                  ('PBT-CRYO-02', 'Credo Cube Thermal Shipper 16L', 'Thermal Shippers', 890.00, 360.00, TRUE),
                  ('PBT-PRO-VIP', 'Credo ProEnthalp VIP Container', 'High-Capacity Containers', 2400.00, 950.00, TRUE),
                  ('PBT-PCM-TIC', 'TIC Smart Coolant Pack 2-8C', 'Phase Change Material', 45.00, 14.50, TRUE),
                  ('PBT-MON-01', 'BioSens Wireless Temperature Logger', 'IoT Monitoring', 120.00, 48.00, TRUE),
                  ('PBT-DRY-ICE', 'Deep Freeze Dry Ice Shipper (-70C)', 'Ultra-Low Temp Shippers', 1150.00, 420.00, TRUE);
                """)

            cur.execute("SELECT COUNT(*) FROM source_crm.orders;")
            if cur.fetchone()[0] == 0:
                cur.execute("""
                INSERT INTO source_crm.orders (customer_id, status, total_amount, payment_method, shipping_address)
                VALUES
                  (1, 'COMPLETED', 1890.00, 'WIRE_TRANSFER', '742 Evergreen Terrace, Boston, MA 02101'),
                  (2, 'COMPLETED', 5450.00, 'SEPA', 'Leopoldstrasse 45, 80802 Munich, Germany'),
                  (3, 'PROCESSING', 980.00, 'CREDIT_CARD', 'Kungsgatan 12, 111 35 Stockholm, Sweden'),
                  (4, 'COMPLETED', 7200.00, 'WIRE_TRANSFER', '221B Baker Street, London NW1 6XE, UK'),
                  (5, 'COMPLETED', 14500.00, 'CORPORATE_PO', '10050 89th Ave N, Maple Grove, MN 55369'),
                  (6, 'DELIVERED', 3240.00, 'SEPA', 'Boulevard Haussmann 88, 75008 Paris, France'),
                  (7, 'SHIPPED', 8900.00, 'WIRE_TRANSFER', 'Marunouchi 1-1, Chiyoda-ku, Tokyo 100-0005, Japan'),
                  (8, 'PENDING', 1340.00, 'CREDIT_CARD', 'Grand Canal Dock 4, Dublin D02, Ireland');
                """)

            cur.execute("SELECT COUNT(*) FROM source_crm.order_items;")
            if cur.fetchone()[0] == 0:
                cur.execute("""
                INSERT INTO source_crm.order_items (order_id, product_id, quantity, unit_price, discount, line_total)
                VALUES
                  (1, 1, 2, 450.00, 0.00, 900.00),
                  (1, 4, 22, 45.00, 0.00, 990.00),
                  (2, 2, 5, 890.00, 50.00, 4400.00),
                  (2, 5, 10, 120.00, 150.00, 1050.00),
                  (3, 1, 2, 450.00, 0.00, 900.00),
                  (3, 4, 2, 45.00, 10.00, 80.00),
                  (4, 3, 3, 2400.00, 0.00, 7200.00),
                  (5, 3, 5, 2400.00, 500.00, 11500.00),
                  (5, 6, 3, 1150.00, 450.00, 3000.00),
                  (6, 2, 3, 890.00, 0.00, 2670.00),
                  (6, 5, 5, 120.00, 30.00, 570.00),
                  (7, 3, 3, 2400.00, 0.00, 7200.00),
                  (7, 6, 2, 1150.00, 600.00, 1700.00),
                  (8, 1, 2, 450.00, 0.00, 900.00),
                  (8, 4, 10, 45.00, 10.00, 440.00);
                """)

            conn.commit()

            for tbl in ("customers", "products", "orders", "order_items"):
                cur.execute(f"SELECT COUNT(*) FROM source_crm.{tbl};")
                counts[tbl] = cur.fetchone()[0]

    finally:
        conn.close()

    return counts


if __name__ == "__main__":
    res = seed_live_source_crm()
    print("[SUCCESS] Seeded live PostgreSQL CRM source data:", res)

