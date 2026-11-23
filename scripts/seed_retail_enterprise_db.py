"""
seed_retail_enterprise_db.py
----------------------------
Seeds 32 enterprise tables in PostgreSQL schema 'retail_ops' on Neon DB.
Covers Customer, Loyalty, Product, Procurement, Store/Warehouse, Inventory, Orders, Fulfillment, and Returns.
"""

import psycopg2
import sys

POSTGRES_URL = "postgresql://neondb_owner:npg_o2FUwbtRgqA8@ep-summer-field-b50f50p0-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require"

DDL_SCRIPT = """
DROP SCHEMA IF EXISTS retail_ops CASCADE;
CREATE SCHEMA retail_ops;

-- 1. Customer Segments
CREATE TABLE IF NOT EXISTS retail_ops.customer_segments (
    segment_id SERIAL PRIMARY KEY,
    segment_code VARCHAR(30) UNIQUE NOT NULL,
    segment_name VARCHAR(100) NOT NULL,
    discount_tier_pct DECIMAL(5,2) DEFAULT 0.00,
    min_spend_annual DECIMAL(12,2) DEFAULT 0.00
);

-- 2. Customers
CREATE TABLE IF NOT EXISTS retail_ops.customers (
    customer_id SERIAL PRIMARY KEY,
    segment_id INT REFERENCES retail_ops.customer_segments(segment_id),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(200) NOT NULL,
    phone VARCHAR(50),
    street_address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    postal_code VARCHAR(30),
    country VARCHAR(50) DEFAULT 'USA',
    loyalty_tier VARCHAR(30) DEFAULT 'BRONZE',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Customer Addresses
CREATE TABLE IF NOT EXISTS retail_ops.customer_addresses (
    address_id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES retail_ops.customers(customer_id) ON DELETE CASCADE,
    address_type VARCHAR(30) DEFAULT 'SHIPPING',
    street TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    postal_code VARCHAR(30) NOT NULL,
    country VARCHAR(50) DEFAULT 'USA',
    is_default BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Customer Preferences
CREATE TABLE IF NOT EXISTS retail_ops.customer_preferences (
    preference_id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES retail_ops.customers(customer_id) ON DELETE CASCADE,
    preferred_channel VARCHAR(50) DEFAULT 'OMNICHANNEL',
    marketing_opt_in BOOLEAN DEFAULT TRUE,
    preferred_currency VARCHAR(10) DEFAULT 'USD',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Loyalty Accounts
CREATE TABLE IF NOT EXISTS retail_ops.loyalty_accounts (
    loyalty_id SERIAL PRIMARY KEY,
    customer_id INT UNIQUE REFERENCES retail_ops.customers(customer_id),
    card_number VARCHAR(50) UNIQUE NOT NULL,
    points_balance INT DEFAULT 0,
    lifetime_points INT DEFAULT 0,
    tier_status VARCHAR(30) DEFAULT 'SILVER',
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Loyalty Transactions
CREATE TABLE IF NOT EXISTS retail_ops.loyalty_transactions (
    transaction_id SERIAL PRIMARY KEY,
    loyalty_id INT REFERENCES retail_ops.loyalty_accounts(loyalty_id),
    points_change INT NOT NULL,
    reason_code VARCHAR(50) NOT NULL,
    reference_order_id INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Promotions and Coupons
CREATE TABLE IF NOT EXISTS retail_ops.promotions_and_coupons (
    coupon_id SERIAL PRIMARY KEY,
    promo_code VARCHAR(50) UNIQUE NOT NULL,
    discount_type VARCHAR(20) DEFAULT 'PERCENTAGE',
    discount_value DECIMAL(10,2) NOT NULL,
    min_order_value DECIMAL(10,2) DEFAULT 0.00,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- 8. Coupon Redemptions
CREATE TABLE IF NOT EXISTS retail_ops.coupon_redemptions (
    redemption_id SERIAL PRIMARY KEY,
    coupon_id INT REFERENCES retail_ops.promotions_and_coupons(coupon_id),
    customer_id INT REFERENCES retail_ops.customers(customer_id),
    order_id INT,
    redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    discount_applied DECIMAL(10,2) NOT NULL
);

-- 9. Product Departments
CREATE TABLE IF NOT EXISTS retail_ops.product_departments (
    department_id SERIAL PRIMARY KEY,
    department_code VARCHAR(30) UNIQUE NOT NULL,
    department_name VARCHAR(100) NOT NULL,
    manager_name VARCHAR(100)
);

-- 10. Product Categories
CREATE TABLE IF NOT EXISTS retail_ops.product_categories (
    category_id SERIAL PRIMARY KEY,
    department_id INT REFERENCES retail_ops.product_departments(department_id),
    category_code VARCHAR(50) NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    parent_category_id INT REFERENCES retail_ops.product_categories(category_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Product Brands
CREATE TABLE IF NOT EXISTS retail_ops.product_brands (
    brand_id SERIAL PRIMARY KEY,
    brand_code VARCHAR(50) UNIQUE NOT NULL,
    brand_name VARCHAR(100) NOT NULL,
    tier_level VARCHAR(30) DEFAULT 'STANDARD'
);

-- 12. Products
CREATE TABLE IF NOT EXISTS retail_ops.products (
    product_id SERIAL PRIMARY KEY,
    sku VARCHAR(60) UNIQUE NOT NULL,
    barcode_upc VARCHAR(60),
    product_name VARCHAR(200) NOT NULL,
    category_id INT REFERENCES retail_ops.product_categories(category_id),
    brand_id INT REFERENCES retail_ops.product_brands(brand_id),
    department_id INT REFERENCES retail_ops.product_departments(department_id),
    unit_cost DECIMAL(12,4) NOT NULL,
    unit_price DECIMAL(12,4) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Product Attributes
CREATE TABLE IF NOT EXISTS retail_ops.product_attributes (
    attribute_id SERIAL PRIMARY KEY,
    product_id INT REFERENCES retail_ops.products(product_id) ON DELETE CASCADE,
    color VARCHAR(50),
    size VARCHAR(30),
    weight_kg DECIMAL(8,3),
    material VARCHAR(100),
    release_season VARCHAR(50)
);

-- 14. Product Price History
CREATE TABLE IF NOT EXISTS retail_ops.product_price_history (
    history_id SERIAL PRIMARY KEY,
    product_id INT REFERENCES retail_ops.products(product_id),
    old_price DECIMAL(12,4) NOT NULL,
    new_price DECIMAL(12,4) NOT NULL,
    change_reason VARCHAR(100),
    effective_from TIMESTAMP WITH TIME ZONE NOT NULL,
    effective_to TIMESTAMP WITH TIME ZONE
);

-- 15. Suppliers
CREATE TABLE IF NOT EXISTS retail_ops.suppliers (
    supplier_id SERIAL PRIMARY KEY,
    supplier_code VARCHAR(50) UNIQUE NOT NULL,
    company_name VARCHAR(200) NOT NULL,
    contact_name VARCHAR(100),
    contact_email VARCHAR(150),
    country VARCHAR(50) DEFAULT 'USA',
    lead_time_days INT DEFAULT 7,
    rating DECIMAL(3,2) DEFAULT 4.5
);

-- 16. Purchase Orders
CREATE TABLE IF NOT EXISTS retail_ops.purchase_orders (
    po_id SERIAL PRIMARY KEY,
    po_number VARCHAR(60) UNIQUE NOT NULL,
    supplier_id INT REFERENCES retail_ops.suppliers(supplier_id),
    order_date DATE NOT NULL,
    expected_date DATE NOT NULL,
    status VARCHAR(30) DEFAULT 'CONFIRMED',
    total_amount DECIMAL(14,2) DEFAULT 0.00
);

-- 17. Purchase Order Lines
CREATE TABLE IF NOT EXISTS retail_ops.purchase_order_lines (
    po_line_id SERIAL PRIMARY KEY,
    po_id INT REFERENCES retail_ops.purchase_orders(po_id) ON DELETE CASCADE,
    product_id INT REFERENCES retail_ops.products(product_id),
    quantity_ordered INT NOT NULL,
    quantity_received INT DEFAULT 0,
    unit_cost DECIMAL(12,4) NOT NULL,
    line_total DECIMAL(14,2) NOT NULL
);

-- 18. Store Channels
CREATE TABLE IF NOT EXISTS retail_ops.store_channels (
    channel_id SERIAL PRIMARY KEY,
    channel_code VARCHAR(30) UNIQUE NOT NULL,
    channel_name VARCHAR(100) NOT NULL,
    commission_pct DECIMAL(5,2) DEFAULT 0.00
);

-- 19. Stores
CREATE TABLE IF NOT EXISTS retail_ops.stores (
    store_id SERIAL PRIMARY KEY,
    channel_id INT REFERENCES retail_ops.store_channels(channel_id),
    store_code VARCHAR(50) UNIQUE NOT NULL,
    store_name VARCHAR(150) NOT NULL,
    channel_type VARCHAR(50) DEFAULT 'brick_and_mortar',
    region VARCHAR(50) NOT NULL,
    street_address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    postal_code VARCHAR(30),
    square_footage INT,
    manager_name VARCHAR(100),
    opened_date DATE
);

-- 20. Warehouses and Distribution Centers
CREATE TABLE IF NOT EXISTS retail_ops.warehouses_and_dc (
    warehouse_id SERIAL PRIMARY KEY,
    warehouse_code VARCHAR(50) UNIQUE NOT NULL,
    facility_name VARCHAR(150) NOT NULL,
    facility_type VARCHAR(50) DEFAULT 'REGIONAL_DC',
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    total_capacity_sqft INT
);

-- 21. Inventory Positions (Real-time)
CREATE TABLE IF NOT EXISTS retail_ops.inventory_positions (
    position_id SERIAL PRIMARY KEY,
    warehouse_id INT REFERENCES retail_ops.warehouses_and_dc(warehouse_id),
    store_id INT REFERENCES retail_ops.stores(store_id),
    product_id INT REFERENCES retail_ops.products(product_id),
    quantity_on_hand INT NOT NULL DEFAULT 0,
    quantity_reserved INT DEFAULT 0,
    safety_stock_level INT DEFAULT 10,
    last_restocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 22. Inventory Snapshots (Daily History)
CREATE TABLE IF NOT EXISTS retail_ops.inventory_snapshots (
    snapshot_id SERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL,
    store_id INT REFERENCES retail_ops.stores(store_id),
    product_id INT REFERENCES retail_ops.products(product_id),
    quantity_on_hand INT NOT NULL,
    reorder_point INT NOT NULL,
    unit_holding_cost DECIMAL(10,4) DEFAULT 0.50,
    stockout_risk_flag SMALLINT DEFAULT 0
);

-- 23. Inventory Adjustments
CREATE TABLE IF NOT EXISTS retail_ops.inventory_adjustments (
    adjustment_id SERIAL PRIMARY KEY,
    product_id INT REFERENCES retail_ops.products(product_id),
    warehouse_id INT REFERENCES retail_ops.warehouses_and_dc(warehouse_id),
    store_id INT REFERENCES retail_ops.stores(store_id),
    adjustment_type VARCHAR(50) NOT NULL,
    quantity_adjusted INT NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 24. Orders Header
CREATE TABLE IF NOT EXISTS retail_ops.orders (
    order_id SERIAL PRIMARY KEY,
    order_number VARCHAR(60) UNIQUE NOT NULL,
    customer_id INT REFERENCES retail_ops.customers(customer_id),
    store_id INT REFERENCES retail_ops.stores(store_id),
    channel_id INT REFERENCES retail_ops.store_channels(channel_id),
    order_status VARCHAR(30) DEFAULT 'DELIVERED',
    payment_status VARCHAR(30) DEFAULT 'PAID',
    gross_amount DECIMAL(14,2) NOT NULL,
    discount_amount DECIMAL(14,2) DEFAULT 0.00,
    net_amount DECIMAL(14,2) NOT NULL,
    tax_amount DECIMAL(14,2) DEFAULT 0.00,
    shipping_fee DECIMAL(10,2) DEFAULT 0.00,
    ordered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 25. Order Line Items
CREATE TABLE IF NOT EXISTS retail_ops.order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INT REFERENCES retail_ops.orders(order_id) ON DELETE CASCADE,
    product_id INT REFERENCES retail_ops.products(product_id),
    line_number INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(12,4) NOT NULL,
    discount_rate DECIMAL(5,4) DEFAULT 0.00,
    line_total DECIMAL(14,2) NOT NULL,
    estimated_profit DECIMAL(14,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 26. Order Taxes
CREATE TABLE IF NOT EXISTS retail_ops.order_taxes (
    tax_id SERIAL PRIMARY KEY,
    order_id INT REFERENCES retail_ops.orders(order_id) ON DELETE CASCADE,
    jurisdiction VARCHAR(100) NOT NULL,
    tax_rate DECIMAL(6,4) NOT NULL,
    tax_amount DECIMAL(10,2) NOT NULL,
    is_exempt BOOLEAN DEFAULT FALSE
);

-- 27. Order Payment Transactions
CREATE TABLE IF NOT EXISTS retail_ops.order_payment_transactions (
    payment_id SERIAL PRIMARY KEY,
    order_id INT REFERENCES retail_ops.orders(order_id) ON DELETE CASCADE,
    payment_method VARCHAR(50) DEFAULT 'CREDIT_CARD',
    gateway_reference VARCHAR(100),
    authorization_code VARCHAR(50),
    transaction_status VARCHAR(30) DEFAULT 'SETTLED',
    amount_charged DECIMAL(14,2) NOT NULL,
    fee_deducted DECIMAL(8,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 28. Carriers
CREATE TABLE IF NOT EXISTS retail_ops.carriers (
    carrier_id SERIAL PRIMARY KEY,
    carrier_code VARCHAR(30) UNIQUE NOT NULL,
    carrier_name VARCHAR(100) NOT NULL,
    service_level VARCHAR(50) DEFAULT 'STANDARD_GROUND',
    standard_delivery_hours INT DEFAULT 48,
    contact_phone VARCHAR(50)
);

-- 29. Shipments
CREATE TABLE IF NOT EXISTS retail_ops.shipments (
    shipment_id SERIAL PRIMARY KEY,
    shipment_number VARCHAR(60) UNIQUE NOT NULL,
    order_id INT REFERENCES retail_ops.orders(order_id),
    carrier_id INT REFERENCES retail_ops.carriers(carrier_id),
    warehouse_id INT REFERENCES retail_ops.warehouses_and_dc(warehouse_id),
    tracking_number VARCHAR(100) UNIQUE,
    shipping_cost DECIMAL(10,2) NOT NULL,
    is_on_time_flag SMALLINT DEFAULT 1,
    dispatched_at TIMESTAMP WITH TIME ZONE,
    promised_delivery_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE
);

-- 30. Shipment Packages
CREATE TABLE IF NOT EXISTS retail_ops.shipment_packages (
    package_id SERIAL PRIMARY KEY,
    shipment_id INT REFERENCES retail_ops.shipments(shipment_id) ON DELETE CASCADE,
    weight_kg DECIMAL(8,3) NOT NULL,
    length_cm DECIMAL(8,2),
    width_cm DECIMAL(8,2),
    height_cm DECIMAL(8,2),
    tracking_barcode VARCHAR(100)
);

-- 31. Customer Returns (RMA)
CREATE TABLE IF NOT EXISTS retail_ops.customer_returns (
    return_id SERIAL PRIMARY KEY,
    rma_number VARCHAR(60) UNIQUE NOT NULL,
    order_id INT REFERENCES retail_ops.orders(order_id),
    customer_id INT REFERENCES retail_ops.customers(customer_id),
    return_reason VARCHAR(100) NOT NULL,
    refund_status VARCHAR(30) DEFAULT 'COMPLETED',
    total_refund_amount DECIMAL(14,2) NOT NULL,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 32. Return Line Items
CREATE TABLE IF NOT EXISTS retail_ops.return_items (
    return_item_id SERIAL PRIMARY KEY,
    return_id INT REFERENCES retail_ops.customer_returns(return_id) ON DELETE CASCADE,
    order_item_id INT REFERENCES retail_ops.order_items(order_item_id),
    product_id INT REFERENCES retail_ops.products(product_id),
    quantity_returned INT NOT NULL,
    restock_status VARCHAR(50) DEFAULT 'RETURNED_TO_INVENTORY',
    inspection_notes TEXT
);
"""

SEED_DATA_SCRIPT = """
-- 1. Customer Segments
INSERT INTO retail_ops.customer_segments (segment_code, segment_name, discount_tier_pct, min_spend_annual)
VALUES 
  ('SEG-VIP', 'Enterprise VIP Platinum', 15.00, 10000.00),
  ('SEG-GOLD', 'Preferred Gold Tier', 10.00, 5000.00),
  ('SEG-SILVER', 'Loyal Silver Member', 5.00, 1500.00),
  ('SEG-STANDARD', 'Standard Retail Consumer', 0.00, 0.00)
ON CONFLICT (segment_code) DO NOTHING;

-- 2. Customers
INSERT INTO retail_ops.customers (segment_id, first_name, last_name, email, phone, street_address, city, state, postal_code, loyalty_tier)
VALUES
  (1, 'Eleanor', 'Vance', 'eleanor.vance@enterprise-retail.com', '+1-555-0192', '742 Evergreen Terrace', 'Springfield', 'IL', '62704', 'PLATINUM'),
  (2, 'Marcus', 'Aurelius', 'marcus.aurelius@stoicgoods.io', '+1-555-0144', '1200 Market Street', 'San Francisco', 'CA', '94102', 'GOLD'),
  (3, 'Sophia', 'Chen', 'sophia.chen@techvibe.co', '+1-555-0188', '450 Lexington Ave', 'New York', 'NY', '10017', 'SILVER'),
  (4, 'Liam', 'OConnor', 'liam.oconnor@dublinmart.org', '+1-555-0177', '88 Franklin St', 'Boston', 'MA', '02110', 'BRONZE')
ON CONFLICT DO NOTHING;

-- 3. Customer Addresses
INSERT INTO retail_ops.customer_addresses (customer_id, address_type, street, city, state, postal_code, is_default)
VALUES
  (1, 'SHIPPING', '742 Evergreen Terrace', 'Springfield', 'IL', '62704', TRUE),
  (1, 'BILLING', '900 Corporate Pkwy', 'Chicago', 'IL', '60601', FALSE),
  (2, 'SHIPPING', '1200 Market Street', 'San Francisco', 'CA', '94102', TRUE),
  (3, 'SHIPPING', '450 Lexington Ave', 'New York', 'NY', '10017', TRUE)
ON CONFLICT DO NOTHING;

-- 4. Customer Preferences
INSERT INTO retail_ops.customer_preferences (customer_id, preferred_channel, marketing_opt_in, preferred_currency)
VALUES
  (1, 'OMNICHANNEL', TRUE, 'USD'),
  (2, 'ONLINE_DIRECT', TRUE, 'USD'),
  (3, 'IN_STORE', FALSE, 'USD'),
  (4, 'MOBILE_APP', TRUE, 'USD')
ON CONFLICT DO NOTHING;

-- 5. Loyalty Accounts
INSERT INTO retail_ops.loyalty_accounts (customer_id, card_number, points_balance, lifetime_points, tier_status)
VALUES
  (1, 'LOYAL-8890-PLAT', 14500, 32000, 'PLATINUM'),
  (2, 'LOYAL-5521-GOLD', 6200, 15400, 'GOLD'),
  (3, 'LOYAL-3319-SILV', 2100, 4800, 'SILVER')
ON CONFLICT (card_number) DO NOTHING;

-- 6. Loyalty Transactions
INSERT INTO retail_ops.loyalty_transactions (loyalty_id, points_change, reason_code, reference_order_id)
VALUES
  (1, 450, 'PURCHASE_ACCRUAL', 1),
  (1, -200, 'DISCOUNT_REDEMPTION', 1),
  (2, 300, 'PURCHASE_ACCRUAL', 2)
ON CONFLICT DO NOTHING;

-- 7. Promotions and Coupons
INSERT INTO retail_ops.promotions_and_coupons (promo_code, discount_type, discount_value, min_order_value, start_date, end_date)
VALUES
  ('SUMMER2026', 'PERCENTAGE', 15.00, 100.00, '2026-06-01', '2026-08-31'),
  ('WELCOME50', 'FIXED_AMOUNT', 50.00, 250.00, '2026-01-01', '2026-12-31'),
  ('FREESHIP', 'PERCENTAGE', 10.00, 50.00, '2026-01-01', '2026-12-31')
ON CONFLICT (promo_code) DO NOTHING;

-- 8. Product Departments
INSERT INTO retail_ops.product_departments (department_code, department_name, manager_name)
VALUES
  ('DEP-TECH', 'Consumer Electronics & Computing', 'David Rossi'),
  ('DEP-APPAREL', 'Apparel, Footwear & Accessories', 'Elena Rostova'),
  ('DEP-HOME', 'Home Living & Kitchen Essentials', 'Grace Tanaka')
ON CONFLICT (department_code) DO NOTHING;

-- 9. Product Categories
INSERT INTO retail_ops.product_categories (department_id, category_code, category_name)
VALUES
  (1, 'CAT-AUDIO', 'High-Fidelity Audio & ANC Headphones'),
  (1, 'CAT-SMART', 'Smartphones & Mobile Wearables'),
  (2, 'CAT-OUTER', 'Performance Outerwear & Jackets'),
  (3, 'CAT-COOK', 'Precision Cookware & Appliances')
ON CONFLICT DO NOTHING;

-- 10. Product Brands
INSERT INTO retail_ops.product_brands (brand_code, brand_name, tier_level)
VALUES
  ('BRD-SONY', 'Sony Audio Solutions', 'PREMIUM'),
  ('BRD-APPLE', 'Apple Ecosystem', 'LUXURY'),
  ('BRD-PATAG', 'Patagonia Eco Gear', 'PREMIUM'),
  ('BRD-BREV', 'Breville Kitchencraft', 'PREMIUM')
ON CONFLICT (brand_code) DO NOTHING;

-- 11. Products
INSERT INTO retail_ops.products (sku, barcode_upc, product_name, category_id, brand_id, department_id, unit_cost, unit_price)
VALUES
  ('SKU-WH1000XM5', '027242923546', 'Sony WH-1000XM5 Wireless Noise Canceling Headphones', 1, 1, 1, 240.00, 399.99),
  ('SKU-IPHONE16PRO', '195949012345', 'Apple iPhone 16 Pro Max 256GB Titanium', 2, 2, 1, 780.00, 1199.00),
  ('SKU-PATAG-JACKET', '888336491823', 'Patagonia Nano Puff Insulated Cold-Weather Jacket', 3, 3, 2, 95.00, 239.00),
  ('SKU-BREV-ESPRESSO', '021614055219', 'Breville Barista Touch Impress Espresso Machine', 4, 4, 3, 490.00, 899.95)
ON CONFLICT (sku) DO NOTHING;

-- 12. Product Attributes
INSERT INTO retail_ops.product_attributes (product_id, color, size, weight_kg, material, release_season)
VALUES
  (1, 'Midnight Black', 'Standard Over-Ear', 0.250, 'Recycled ABS / Memory Foam', 'Fall 2025'),
  (2, 'Natural Titanium', '6.9 inch Display', 0.227, 'Grade 5 Titanium & Ceramic Shield', 'Fall 2025'),
  (3, 'Forge Grey', 'Medium Mens', 0.337, '100% Recycled Ripstop Polyester', 'Winter 2025'),
  (4, 'Brushed Stainless Steel', 'Countertop Pro', 11.200, 'Die-cast Stainless Steel', 'Spring 2026')
ON CONFLICT DO NOTHING;

-- 13. Suppliers
INSERT INTO retail_ops.suppliers (supplier_code, company_name, contact_name, contact_email, country, lead_time_days, rating)
VALUES
  ('SUP-TOKYO', 'Tokyo High-Tech Microelectronics Corp', 'Hiroshi Sato', 'sato@tokyotech.jp', 'Japan', 12, 4.85),
  ('SUP-PACIFIC', 'Pacific Rim Global Apparel Logistics', 'Mei-Ling Zhou', 'zhou@pacificapparel.com', 'Vietnam', 18, 4.60),
  ('SUP-SYDNEY', 'Sydney Appliance Engineering Pty Ltd', 'Oliver Wright', 'wright@sydneyeng.com.au', 'Australia', 14, 4.90)
ON CONFLICT (supplier_code) DO NOTHING;

-- 14. Purchase Orders
INSERT INTO retail_ops.purchase_orders (po_number, supplier_id, order_date, expected_date, status, total_amount)
VALUES
  ('PO-2026-001', 1, '2026-01-10', '2026-01-24', 'RECEIVED', 72000.00),
  ('PO-2026-002', 2, '2026-01-15', '2026-02-05', 'CONFIRMED', 28500.00),
  ('PO-2026-003', 3, '2026-02-01', '2026-02-18', 'IN_TRANSIT', 49000.00)
ON CONFLICT (po_number) DO NOTHING;

-- 15. Purchase Order Lines
INSERT INTO retail_ops.purchase_order_lines (po_id, product_id, quantity_ordered, quantity_received, unit_cost, line_total)
VALUES
  (1, 1, 300, 300, 240.00, 72000.00),
  (2, 3, 300, 0, 95.00, 28500.00),
  (3, 4, 100, 0, 490.00, 49000.00)
ON CONFLICT DO NOTHING;

-- 16. Store Channels
INSERT INTO retail_ops.store_channels (channel_code, channel_name, commission_pct)
VALUES
  ('CHN-ONLINE', 'Direct E-Commerce Digital Storefront', 1.50),
  ('CHN-FLAGSHIP', 'Metropolitan Flagship Retail Experience', 0.00),
  ('CHN-OUTLET', 'Suburban Value Outlet Retail Center', 0.00)
ON CONFLICT (channel_code) DO NOTHING;

-- 17. Stores
INSERT INTO retail_ops.stores (channel_id, store_code, store_name, channel_type, region, street_address, city, state, postal_code, square_footage, manager_name, opened_date)
VALUES
  (1, 'STR-WEB-01', 'Omnichannel Digital Global Store', 'online', 'North America Digital', '1 OneLake Way', 'Redmond', 'WA', '98052', 0, 'Sarah Jenkins', '2020-01-01'),
  (2, 'STR-NY-01', 'Manhattan 5th Avenue Flagship', 'brick_and_mortar', 'US Northeast', '767 5th Ave', 'New York', 'NY', '10153', 25000, 'Antonio Rossi', '2018-09-15'),
  (2, 'STR-SF-01', 'San Francisco Union Square Store', 'brick_and_mortar', 'US West Coast', '300 Post St', 'San Francisco', 'CA', '94108', 18000, 'Maya Lin', '2019-11-20'),
  (3, 'STR-CHI-01', 'Chicago Michigan Ave Store', 'brick_and_mortar', 'US Midwest', '800 N Michigan Ave', 'Chicago', 'IL', '60611', 14500, 'Brian Kowalski', '2021-04-10')
ON CONFLICT (store_code) DO NOTHING;

-- 18. Warehouses and Distribution Centers
INSERT INTO retail_ops.warehouses_and_dc (warehouse_code, facility_name, facility_type, city, state, total_capacity_sqft)
VALUES
  ('DC-EAST-01', 'Northeast Automated Logistics Hub', 'CENTRAL_FULFILLMENT', 'Allentown', 'PA', 450000),
  ('DC-WEST-01', 'Pacific Omnichannel Fulfillment Depot', 'REGIONAL_DC', 'Tracy', 'CA', 380000),
  ('DC-CENTRAL-01', 'Midwest Cross-Dock Distribution Center', 'CROSS_DOCK', 'Plainfield', 'IN', 310000)
ON CONFLICT (warehouse_code) DO NOTHING;

-- 19. Inventory Positions
INSERT INTO retail_ops.inventory_positions (warehouse_id, store_id, product_id, quantity_on_hand, quantity_reserved, safety_stock_level)
VALUES
  (1, 1, 1, 450, 35, 50),
  (1, 1, 2, 280, 40, 40),
  (2, 2, 3, 120, 10, 20),
  (3, 4, 4, 65, 5, 15)
ON CONFLICT DO NOTHING;

-- 20. Inventory Snapshots
INSERT INTO retail_ops.inventory_snapshots (snapshot_date, store_id, product_id, quantity_on_hand, reorder_point, unit_holding_cost, stockout_risk_flag)
VALUES
  ('2026-02-15', 1, 1, 480, 60, 0.45, 0),
  ('2026-02-15', 1, 2, 310, 50, 0.65, 0),
  ('2026-02-15', 2, 3, 18, 25, 0.35, 1),
  ('2026-02-15', 3, 4, 12, 15, 0.85, 1)
ON CONFLICT DO NOTHING;

-- 21. Inventory Adjustments
INSERT INTO retail_ops.inventory_adjustments (product_id, warehouse_id, store_id, adjustment_type, quantity_adjusted, reason)
VALUES
  (1, 1, NULL, 'RECEIVING_SURPLUS', 5, 'Supplier over-delivery on verified PO-2026-001'),
  (3, NULL, 2, 'DAMAGED_IN_STORE', -1, 'Customer display unit minor cosmetic wear')
ON CONFLICT DO NOTHING;

-- 22. Orders
INSERT INTO retail_ops.orders (order_number, customer_id, store_id, channel_id, order_status, payment_status, gross_amount, discount_amount, net_amount, tax_amount, shipping_fee)
VALUES
  ('ORD-2026-9001', 1, 1, 1, 'DELIVERED', 'PAID', 1598.99, 159.90, 1439.09, 115.13, 0.00),
  ('ORD-2026-9002', 2, 2, 2, 'DELIVERED', 'PAID', 1199.00, 0.00, 1199.00, 107.91, 15.00),
  ('ORD-2026-9003', 3, 3, 2, 'SHIPPED', 'PAID', 239.00, 23.90, 215.10, 18.28, 9.99),
  ('ORD-2026-9004', 4, 1, 1, 'PROCESSING', 'PAID', 899.95, 50.00, 849.95, 68.00, 0.00)
ON CONFLICT (order_number) DO NOTHING;

-- 23. Order Items
INSERT INTO retail_ops.order_items (order_id, product_id, line_number, quantity, unit_price, discount_rate, line_total, estimated_profit)
VALUES
  (1, 1, 1, 1, 399.99, 0.10, 359.99, 119.99),
  (1, 2, 2, 1, 1199.00, 0.10, 1079.10, 299.10),
  (2, 2, 1, 1, 1199.00, 0.00, 1199.00, 419.00),
  (3, 3, 1, 1, 239.00, 0.10, 215.10, 120.10),
  (4, 4, 1, 1, 899.95, 0.05, 849.95, 359.95)
ON CONFLICT DO NOTHING;

-- 24. Order Taxes
INSERT INTO retail_ops.order_taxes (order_id, jurisdiction, tax_rate, tax_amount)
VALUES
  (1, 'State of Illinois Sales Tax', 0.0800, 115.13),
  (2, 'State of California / SF District', 0.0900, 107.91),
  (3, 'State of New York / NYC Metro', 0.0850, 18.28),
  (4, 'State of Washington Digital Tax', 0.0800, 68.00)
ON CONFLICT DO NOTHING;

-- 25. Order Payment Transactions
INSERT INTO retail_ops.order_payment_transactions (order_id, payment_method, gateway_reference, authorization_code, amount_charged, fee_deducted)
VALUES
  (1, 'VISA_SIGNATURE', 'gw_txn_9948123', 'AUTH_92819', 1554.22, 38.85),
  (2, 'APPLE_PAY_AMEX', 'gw_txn_8819230', 'AUTH_77192', 1321.91, 33.05),
  (3, 'MASTERCARD_WORLD', 'gw_txn_4412901', 'AUTH_11823', 243.37, 6.08),
  (4, 'PAYPAL_INSTANT', 'gw_txn_2209182', 'AUTH_55928', 917.95, 22.95)
ON CONFLICT DO NOTHING;

-- 26. Carriers
INSERT INTO retail_ops.carriers (carrier_code, carrier_name, service_level, standard_delivery_hours, contact_phone)
VALUES
  ('CAR-FEDEX', 'FedEx Express Ground & Air', 'PRIORITY_OVERNIGHT', 24, '+1-800-463-3339'),
  ('CAR-UPS', 'United Parcel Service Worldwide', 'GROUND_COMMERCIAL', 48, '+1-800-742-5877'),
  ('CAR-DHL', 'DHL Express Supply Chain', 'EXPRESS_WORLDWIDE', 36, '+1-800-225-5345')
ON CONFLICT (carrier_code) DO NOTHING;

-- 27. Shipments
INSERT INTO retail_ops.shipments (shipment_number, order_id, carrier_id, warehouse_id, tracking_number, shipping_cost, is_on_time_flag, dispatched_at, promised_delivery_at, delivered_at)
VALUES
  ('SHP-2026-001', 1, 1, 1, '1Z9999999999999991', 18.50, 1, '2026-02-10 14:00:00Z', '2026-02-12 17:00:00Z', '2026-02-11 15:30:00Z'),
  ('SHP-2026-002', 2, 2, 2, '1Z8888888888888882', 14.00, 1, '2026-02-11 11:30:00Z', '2026-02-13 18:00:00Z', '2026-02-13 16:45:00Z'),
  ('SHP-2026-003', 3, 3, 1, '1Z7777777777777773', 12.20, 1, '2026-02-14 09:00:00Z', '2026-02-16 17:00:00Z', NULL)
ON CONFLICT (shipment_number) DO NOTHING;

-- 28. Shipment Packages
INSERT INTO retail_ops.shipment_packages (shipment_id, weight_kg, length_cm, width_cm, height_cm, tracking_barcode)
VALUES
  (1, 1.450, 32.0, 24.0, 12.0, 'BC-FEDEX-991'),
  (2, 0.850, 20.0, 15.0, 8.0, 'BC-UPS-882'),
  (3, 0.650, 28.0, 20.0, 6.0, 'BC-DHL-773')
ON CONFLICT DO NOTHING;

-- 29. Customer Returns
INSERT INTO retail_ops.customer_returns (rma_number, order_id, customer_id, return_reason, refund_status, total_refund_amount)
VALUES
  ('RMA-2026-01', 1, 1, 'Customer preferred alternative headphone finish', 'COMPLETED', 359.99)
ON CONFLICT (rma_number) DO NOTHING;

-- 30. Return Items
INSERT INTO retail_ops.return_items (return_id, order_item_id, product_id, quantity_returned, restock_status, inspection_notes)
VALUES
  (1, 1, 1, 1, 'RETURNED_TO_INVENTORY', 'Factory seal unbroken, passed automated QA inspection')
ON CONFLICT DO NOTHING;
"""


def main():
    print(f"Connecting to PostgreSQL Neon DB...")
    conn = psycopg2.connect(POSTGRES_URL)
    conn.autocommit = True
    cur = conn.cursor()

    print("Executing 32-table DDL script...")
    cur.execute(DDL_SCRIPT)

    print("Executing seed data script...")
    cur.execute(SEED_DATA_SCRIPT)

    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'retail_ops' ORDER BY table_name;")
    tables = [r[0] for r in cur.fetchall()]
    print(f"✅ Successfully provisioned {len(tables)} tables in schema 'retail_ops':")
    for idx, t in enumerate(tables, 1):
        print(f"  {idx:02d}. {t}")

    cur.close()
    conn.close()
    print("✨ Database schema & seed complete!")


if __name__ == "__main__":
    main()
