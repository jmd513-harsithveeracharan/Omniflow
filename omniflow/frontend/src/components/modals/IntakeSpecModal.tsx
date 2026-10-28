import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  FileCode,
  X,
  Upload,
  Sparkles,
  Check,
  AlertCircle,
  Play,
  Code2,
  Edit3,
  Copy,
  ChevronDown,
} from 'lucide-react';

interface IntakeSpecModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (intakeJson: string, resume: boolean) => void;
}

const TEMPLATES = [
  {
    name: 'Global Cross-Border Payments & Fraud Intelligence',
    file: 'project_intake_fintech.json',
    json: {
      "project_context": {
            "project_summary": {
                  "project_code": "PRJ-FINTECH-PAYMENTS",
                  "project_name": "Global Cross-Border Payments & Fraud Intelligence Platform",
                  "business_domain": "Fintech, International Wire Settlement & Anti-Money Laundering (AML)",
                  "enterprise_tier": "Tier-1 Mission Critical",
                  "sla_target_minutes": 5,
                  "target_rpo_minutes": 1,
                  "target_rto_minutes": 15,
                  "compliance_frameworks": [
                        "PCI-DSS v4.0 Level 1",
                        "SOC2 Type II",
                        "GDPR Article 32 (PII Pseudonymization)",
                        "FinCEN Travel Rule (Bank Secrecy Act)",
                        "ISO 20022 Financial Messaging Standard"
                  ],
                  "data_classification": "Confidential / Highly Restricted Financial & PII"
            },
            "solution_summary": {
                  "target_architecture": "Microsoft Fabric Medallion Architecture (Bronze Ingestion -> Stage Curation -> Silver Harmonization -> Gold Analytics)",
                  "target_folder_structure": {
                        "root_folder": "Fintech_Payments_Platform",
                        "subfolders": {
                              "raw": "01 Raw Ingestion",
                              "stage": "02 Stage & Curation",
                              "silver": "03 Silver Harmonized",
                              "gold": "04 Gold Star Schema",
                              "semantic": "05 Semantic & Reporting"
                        }
                  },
                  "expected_deliverables": [
                        "Fabric Raw Lakehouse (lh_fintech_raw_bronze in '01 Raw Ingestion')",
                        "Fabric Eventstream & ADF Ingestion Pipeline (pl_fintech_swift_wire_batch in '01 Raw Ingestion')",
                        "PySpark SHA-256 PII Masking & Data Sanitization Notebook (nb_fintech_pii_masking in '02 Stage & Curation')",
                        "PySpark Sanctions & OFAC Screening Fuzzy Matcher (nb_fintech_aml_screening in '02 Stage & Curation')",
                        "PySpark SCD-Type 2 Account History Tracker (nb_fintech_account_scd2 in '02 Stage & Curation')",
                        "Fabric Curated Delta Lakehouse (lh_fintech_curated_silver in '03 Silver Harmonized')",
                        "Great Expectations Data Quality Reconciliation Suite (ge_fintech_quality_suite in '03 Silver Harmonized')",
                        "Fabric Gold Analytical Warehouse (wh_fintech_analytics_gold in '04 Gold Star Schema')",
                        "T-SQL Kimball Star Schema DDL with FactWireSettlement & Conformed Dimensions (ddl_fintech_star_schema.sql)",
                        "T-SQL Stored Procedure for Daily Net Settlement Balancing (sp_fintech_daily_net_settlement in '04 Gold Star Schema')",
                        "Power BI Direct Lake Semantic Model (sm_fintech_payments_direct_lake in '05 Semantic & Reporting')",
                        "NetworkX Column Lineage Graph & Blast-Zone Risk Matrix (dag_fintech_lineage.json)"
                  ],
                  "delta_lake_optimization": {
                        "liquid_clustering_keys": [
                              "settlement_date",
                              "currency_pair",
                              "sending_institution_bic"
                        ],
                        "z_order_columns": [
                              "uetr_transaction_id",
                              "sender_account_id",
                              "aml_risk_score"
                        ],
                        "vacuum_retention_hours": 168,
                        "auto_compact_enabled": true,
                        "optimize_write_enabled": true
                  }
            }
      },
      "retrieved_context": {
            "data_sources": [
                  {
                        "source_name": "SWIFT Alliance Gateway & ISO 20022 Financial Switch",
                        "source_type": "Real-time Message Broker & Streaming Store",
                        "protocol": "AMQP / Kafka Event Hubs",
                        "ingestion_frequency": "Continuous Micro-Batch (60 seconds)",
                        "tables": [
                              {
                                    "table_name": "wire_transfers",
                                    "primary_key": "uetr_transaction_id",
                                    "watermark_column": "settlement_timestamp",
                                    "row_count": 18500000,
                                    "pii_columns": [
                                          "sender_iban",
                                          "receiver_iban",
                                          "beneficiary_name",
                                          "remittance_details"
                                    ],
                                    "columns": [
                                          {
                                                "name": "uetr_transaction_id",
                                                "type": "string",
                                                "is_pk": true,
                                                "description": "Unique End-to-End Transaction Reference (UUIDv4)"
                                          },
                                          {
                                                "name": "message_type",
                                                "type": "string",
                                                "description": "ISO 20022 message type: pacs.008, pacs.009, or MT103"
                                          },
                                          {
                                                "name": "sender_account_id",
                                                "type": "string",
                                                "description": "Internal customer account identifier"
                                          },
                                          {
                                                "name": "sender_iban",
                                                "type": "string",
                                                "is_pii": true,
                                                "masking": "SHA-256",
                                                "description": "Debtor International Bank Account Number"
                                          },
                                          {
                                                "name": "sender_bic",
                                                "type": "string",
                                                "description": "Ordering Institution BIC (Bank Identifier Code)"
                                          },
                                          {
                                                "name": "receiver_iban",
                                                "type": "string",
                                                "is_pii": true,
                                                "masking": "SHA-256",
                                                "description": "Creditor International Bank Account Number"
                                          },
                                          {
                                                "name": "receiver_bic",
                                                "type": "string",
                                                "description": "Beneficiary Institution BIC"
                                          },
                                          {
                                                "name": "beneficiary_name",
                                                "type": "string",
                                                "is_pii": true,
                                                "masking": "HASH_WITH_SALT",
                                                "description": "Legal Name of the Beneficiary Entity"
                                          },
                                          {
                                                "name": "instructed_amount",
                                                "type": "decimal(18,4)",
                                                "description": "Gross wire transfer value in originating currency"
                                          },
                                          {
                                                "name": "instructed_currency",
                                                "type": "string",
                                                "description": "ISO 4217 3-letter currency code (e.g. USD, EUR, GBP)"
                                          },
                                          {
                                                "name": "settlement_amount_usd",
                                                "type": "decimal(18,4)",
                                                "description": "Standardized equivalent amount in USD"
                                          },
                                          {
                                                "name": "exchange_rate_applied",
                                                "type": "decimal(12,6)",
                                                "description": "FX spot rate applied at execution timestamp"
                                          },
                                          {
                                                "name": "remittance_details",
                                                "type": "string",
                                                "is_pii": true,
                                                "masking": "REDACT_REGEX",
                                                "description": "Unstructured payment narrative & invoice references"
                                          },
                                          {
                                                "name": "clearing_channel",
                                                "type": "string",
                                                "description": "Fedwire, CHIPS, TARGET2, or SEPA Instant"
                                          },
                                          {
                                                "name": "status",
                                                "type": "string",
                                                "description": "SETTLED, PENDING_AML, REJECTED, or INVESTIGATION"
                                          },
                                          {
                                                "name": "created_at",
                                                "type": "timestamp",
                                                "description": "Initial message ingress timestamp"
                                          },
                                          {
                                                "name": "settlement_timestamp",
                                                "type": "timestamp",
                                                "description": "Final ledger clearing timestamp"
                                          }
                                    ]
                              },
                              {
                                    "table_name": "settlement_batches",
                                    "primary_key": "batch_id",
                                    "watermark_column": "cleared_at",
                                    "row_count": 420000,
                                    "pii_columns": [],
                                    "columns": [
                                          {
                                                "name": "batch_id",
                                                "type": "string",
                                                "is_pk": true,
                                                "description": "Clearing house net batch identifier"
                                          },
                                          {
                                                "name": "clearing_network",
                                                "type": "string",
                                                "description": "Network name: Fedwire, CHIPS, or TARGET2"
                                          },
                                          {
                                                "name": "total_wire_count",
                                                "type": "integer",
                                                "description": "Number of transactions aggregated in this batch"
                                          },
                                          {
                                                "name": "gross_debit_amount_usd",
                                                "type": "decimal(20,4)",
                                                "description": "Total outgoing debits in USD"
                                          },
                                          {
                                                "name": "gross_credit_amount_usd",
                                                "type": "decimal(20,4)",
                                                "description": "Total incoming credits in USD"
                                          },
                                          {
                                                "name": "net_settlement_amount_usd",
                                                "type": "decimal(20,4)",
                                                "description": "Net liquidity movement with central clearing bank"
                                          },
                                          {
                                                "name": "reconciliation_status",
                                                "type": "string",
                                                "description": "BALANCED, DISCREPANCY_FLAGGED, or PENDING"
                                          },
                                          {
                                                "name": "cleared_at",
                                                "type": "timestamp",
                                                "description": "Federal clearing confirmation timestamp"
                                          }
                                    ]
                              }
                        ]
                  },
                  {
                        "source_name": "Core Banking Ledger & Customer RDBMS (Oracle Exadata)",
                        "source_type": "Relational Database Management System",
                        "protocol": "JDBC / Log-based Change Data Capture (CDC)",
                        "ingestion_frequency": "Hourly Micro-Batch",
                        "tables": [
                              {
                                    "table_name": "customer_accounts",
                                    "primary_key": "account_id",
                                    "watermark_column": "updated_at",
                                    "row_count": 320000,
                                    "pii_columns": [
                                          "account_holder_name",
                                          "tax_identifier_ssn",
                                          "phone_number",
                                          "billing_address",
                                          "email"
                                    ],
                                    "columns": [
                                          {
                                                "name": "account_id",
                                                "type": "string",
                                                "is_pk": true,
                                                "description": "Primary internal bank account number"
                                          },
                                          {
                                                "name": "customer_cif_id",
                                                "type": "string",
                                                "description": "Customer Information File (CIF) master identifier"
                                          },
                                          {
                                                "name": "account_holder_name",
                                                "type": "string",
                                                "is_pii": true,
                                                "masking": "HASH_WITH_SALT",
                                                "description": "Full legal name of account owner"
                                          },
                                          {
                                                "name": "account_type",
                                                "type": "string",
                                                "description": "COMMERCIAL_CHECKING, NOSTRO, VOSTRO, or TREASURY"
                                          },
                                          {
                                                "name": "tax_identifier_ssn",
                                                "type": "string",
                                                "is_pii": true,
                                                "masking": "FULL_MASK",
                                                "description": "SSN or Tax Identification Number"
                                          },
                                          {
                                                "name": "domicile_country_code",
                                                "type": "string",
                                                "description": "ISO 3166-1 alpha-2 jurisdiction code"
                                          },
                                          {
                                                "name": "kyc_status",
                                                "type": "string",
                                                "description": "VERIFIED, ENHANCED_DUE_DILIGENCE, or SUSPENDED"
                                          },
                                          {
                                                "name": "risk_tier",
                                                "type": "string",
                                                "description": "LOW, MEDIUM, HIGH, PEP_ASSOCIATED"
                                          },
                                          {
                                                "name": "current_balance_usd",
                                                "type": "decimal(18,4)",
                                                "description": "Real-time ledger balance in USD"
                                          },
                                          {
                                                "name": "credit_limit_usd",
                                                "type": "decimal(18,4)",
                                                "description": "Authorized intraday overdraft credit limit"
                                          },
                                          {
                                                "name": "phone_number",
                                                "type": "string",
                                                "is_pii": true,
                                                "masking": "REDACT_REGEX",
                                                "description": "Verified contact phone"
                                          },
                                          {
                                                "name": "billing_address",
                                                "type": "string",
                                                "is_pii": true,
                                                "masking": "REDACT_REGEX",
                                                "description": "Primary registered address"
                                          },
                                          {
                                                "name": "email",
                                                "type": "string",
                                                "is_pii": true,
                                                "masking": "PARTIAL_MASK",
                                                "description": "Operational email address"
                                          },
                                          {
                                                "name": "created_at",
                                                "type": "timestamp",
                                                "description": "Account opening timestamp"
                                          },
                                          {
                                                "name": "updated_at",
                                                "type": "timestamp",
                                                "description": "Last profile alteration timestamp"
                                          }
                                    ]
                              },
                              {
                                    "table_name": "general_ledger_entries",
                                    "primary_key": "journal_entry_id",
                                    "watermark_column": "posted_at",
                                    "row_count": 48000000,
                                    "pii_columns": [],
                                    "columns": [
                                          {
                                                "name": "journal_entry_id",
                                                "type": "string",
                                                "is_pk": true,
                                                "description": "Double-entry accounting journal UUID"
                                          },
                                          {
                                                "name": "account_id",
                                                "type": "string",
                                                "description": "Associated customer or internal ledger account"
                                          },
                                          {
                                                "name": "gl_account_code",
                                                "type": "string",
                                                "description": "Chart of accounts code (e.g. 10100 Cash, 20100 Wire Payable)"
                                          },
                                          {
                                                "name": "entry_type",
                                                "type": "string",
                                                "description": "DEBIT or CREDIT"
                                          },
                                          {
                                                "name": "amount_usd",
                                                "type": "decimal(18,4)",
                                                "description": "Monetary value in USD"
                                          },
                                          {
                                                "name": "source_reference_id",
                                                "type": "string",
                                                "description": "Foreign reference: uetr_transaction_id or batch_id"
                                          },
                                          {
                                                "name": "posted_at",
                                                "type": "timestamp",
                                                "description": "Ledger posting timestamp"
                                          }
                                    ]
                              }
                        ]
                  },
                  {
                        "source_name": "Sanctions Screening & Watchlist Regulatory Feed (OFAC / UN / EU)",
                        "source_type": "External Government & Regulatory SFTP Stream",
                        "protocol": "SFTP / Secure XML Parser",
                        "ingestion_frequency": "Every 4 Hours",
                        "tables": [
                              {
                                    "table_name": "sanction_entities",
                                    "primary_key": "entity_id",
                                    "watermark_column": "last_reviewed_date",
                                    "row_count": 85000,
                                    "pii_columns": [
                                          "entity_legal_name",
                                          "alias_names"
                                    ],
                                    "columns": [
                                          {
                                                "name": "entity_id",
                                                "type": "string",
                                                "is_pk": true,
                                                "description": "OFAC SDN or EU Sanction Entity Identifier"
                                          },
                                          {
                                                "name": "entity_legal_name",
                                                "type": "string",
                                                "is_pii": true,
                                                "description": "Designated individual or institutional legal name"
                                          },
                                          {
                                                "name": "alias_names",
                                                "type": "string",
                                                "is_pii": true,
                                                "description": "Comma-separated known aliases (AKAs)"
                                          },
                                          {
                                                "name": "sanction_program",
                                                "type": "string",
                                                "description": "SDNT, UKRAINE-EO14024, CYBER2, or TERRORISM"
                                          },
                                          {
                                                "name": "country_of_origin",
                                                "type": "string",
                                                "description": "Country of nationality or primary domicile"
                                          },
                                          {
                                                "name": "date_of_birth_or_inc",
                                                "type": "string",
                                                "description": "Date of birth or corporate incorporation"
                                          },
                                          {
                                                "name": "listing_date",
                                                "type": "date",
                                                "description": "Date added to active global sanction list"
                                          },
                                          {
                                                "name": "last_reviewed_date",
                                                "type": "timestamp",
                                                "description": "Regulatory list version refresh timestamp"
                                          }
                                    ]
                              }
                        ]
                  },
                  {
                        "source_name": "Real-time AML Fraud Signals & Device Telemetry (Event Hubs)",
                        "source_type": "Distributed Streaming Telemetry",
                        "protocol": "Azure Event Hubs Kafka Protocol",
                        "ingestion_frequency": "Sub-Second Real-Time",
                        "tables": [
                              {
                                    "table_name": "aml_risk_signals",
                                    "primary_key": "signal_id",
                                    "watermark_column": "detected_at",
                                    "row_count": 640000,
                                    "pii_columns": [],
                                    "columns": [
                                          {
                                                "name": "signal_id",
                                                "type": "string",
                                                "is_pk": true,
                                                "description": "Risk rule evaluation trigger identifier"
                                          },
                                          {
                                                "name": "uetr_transaction_id",
                                                "type": "string",
                                                "description": "Associated wire transaction identifier"
                                          },
                                          {
                                                "name": "risk_rule_name",
                                                "type": "string",
                                                "description": "VELOCITY_SPIKE, STRUCTURING_SMURFING, or HIGH_RISK_GEO"
                                          },
                                          {
                                                "name": "risk_score",
                                                "type": "integer",
                                                "description": "Calculated ML risk probability (0 to 100)"
                                          },
                                          {
                                                "name": "sanction_match_confidence",
                                                "type": "decimal(5,2)",
                                                "description": "Jaro-Winkler string similarity percentage on beneficiary"
                                          },
                                          {
                                                "name": "client_ip_country",
                                                "type": "string",
                                                "description": "GeoIP country code of the initiating terminal"
                                          },
                                          {
                                                "name": "recommended_action",
                                                "type": "string",
                                                "description": "AUTO_APPROVE, HOLD_FOR_REVIEW, or IMMEDIATE_BLOCK"
                                          },
                                          {
                                                "name": "detected_at",
                                                "type": "timestamp",
                                                "description": "Signal generation timestamp"
                                          }
                                    ]
                              }
                        ]
                  },
                  {
                        "source_name": "Global Foreign Exchange Market Rates (Refinitiv FX Feed)",
                        "source_type": "Market Data Stream",
                        "protocol": "WebSocket FIX / REST API",
                        "ingestion_frequency": "Every 15 Seconds",
                        "tables": [
                              {
                                    "table_name": "fx_spot_rates",
                                    "primary_key": "currency_pair_id",
                                    "watermark_column": "quote_timestamp",
                                    "row_count": 9500000,
                                    "pii_columns": [],
                                    "columns": [
                                          {
                                                "name": "currency_pair_id",
                                                "type": "string",
                                                "is_pk": true,
                                                "description": "Base and quote currency string (e.g. EURUSD, GBPUSD)"
                                          },
                                          {
                                                "name": "bid_price",
                                                "type": "decimal(12,6)",
                                                "description": "Institutional bid rate"
                                          },
                                          {
                                                "name": "ask_price",
                                                "type": "decimal(12,6)",
                                                "description": "Institutional ask rate"
                                          },
                                          {
                                                "name": "mid_market_rate",
                                                "type": "decimal(12,6)",
                                                "description": "Calculated mid-market reference exchange rate"
                                          },
                                          {
                                                "name": "market_source",
                                                "type": "string",
                                                "description": "Reuters, Bloomberg, or Internal FX Desk"
                                          },
                                          {
                                                "name": "quote_timestamp",
                                                "type": "timestamp",
                                                "description": "Tick quote timestamp"
                                          }
                                    ]
                              }
                        ]
                  }
            ]
      },
      "data_quality_reconciliation": {
            "suite_name": "Fintech_Wire_Settlement_Audit_Suite",
            "strict_mode": true,
            "rules": [
                  {
                        "target_table": "wire_transfers",
                        "assertion": "expect_column_values_to_not_be_null",
                        "column": "uetr_transaction_id",
                        "tolerance": 0.0
                  },
                  {
                        "target_table": "wire_transfers",
                        "assertion": "expect_column_values_to_be_between",
                        "column": "instructed_amount",
                        "min_value": 0.01,
                        "max_value": 100000000.0,
                        "action_on_failure": "QUARANTINE_ROW"
                  },
                  {
                        "target_table": "customer_accounts",
                        "assertion": "expect_column_values_to_match_regex",
                        "column": "tax_identifier_ssn",
                        "regex": "^[A-Fa-f0-9]{64}$",
                        "description": "Ensure 100% of SSNs in Silver/Gold are SHA-256 hashed before ingestion"
                  },
                  {
                        "target_table": "settlement_batches",
                        "assertion": "expect_column_values_to_be_in_set",
                        "column": "reconciliation_status",
                        "value_set": [
                              "BALANCED",
                              "DISCREPANCY_FLAGGED",
                              "PENDING"
                        ]
                  }
            ]
      },
      "analytical_gold_models": {
            "fact_tables": [
                  {
                        "name": "Fact_WireSettlement",
                        "grain": "One row per settled or attempted wire transaction",
                        "primary_key": "SettlementKey",
                        "foreign_keys": [
                              "CustomerKey",
                              "SanctionKey",
                              "CurrencyKey",
                              "DateKey"
                        ],
                        "measures": [
                              "SettlementAmountUSD",
                              "InstructedAmount",
                              "ExchangeRateApplied",
                              "AMLScore",
                              "ProcessingLatencySeconds"
                        ]
                  }
            ],
            "dimension_tables": [
                  {
                        "name": "Dim_CustomerAccount",
                        "type": "SCD Type 2",
                        "surrogate_key": "CustomerKey",
                        "natural_key": "account_id"
                  },
                  {
                        "name": "Dim_SanctionEntity",
                        "type": "SCD Type 1",
                        "surrogate_key": "SanctionKey",
                        "natural_key": "entity_id"
                  },
                  {
                        "name": "Dim_CurrencyPair",
                        "type": "SCD Type 1",
                        "surrogate_key": "CurrencyKey",
                        "natural_key": "currency_pair_id"
                  },
                  {
                        "name": "Dim_Date",
                        "type": "Conformed Role-Playing",
                        "surrogate_key": "DateKey",
                        "natural_key": "calendar_date"
                  }
            ],
            "power_bi_dax_kpis": [
                  {
                        "name": "Total Settlement Volume USD",
                        "expression": "SUM(Fact_WireSettlement[SettlementAmountUSD])",
                        "format": "$#,##0.00"
                  },
                  {
                        "name": "AML Block Rate %",
                        "expression": "DIVIDE(CALCULATE(COUNTROWS(Fact_WireSettlement), Fact_WireSettlement[Status] = \"REJECTED\"), COUNTROWS(Fact_WireSettlement)) * 100",
                        "format": "0.00%"
                  },
                  {
                        "name": "Average Processing Time Sec",
                        "expression": "AVERAGE(Fact_WireSettlement[ProcessingLatencySeconds])",
                        "format": "#,##0.0s"
                  },
                  {
                        "name": "5-Min SLA Compliance %",
                        "expression": "DIVIDE(CALCULATE(COUNTROWS(Fact_WireSettlement), Fact_WireSettlement[ProcessingLatencySeconds] <= 300), COUNTROWS(Fact_WireSettlement)) * 100",
                        "format": "0.00%"
                  }
            ]
      }
    }
  },
  {
    name: 'Global Express Delivery (Fleet Logistics)',
    file: 'project_intake_delivery.json',
    json: {
      project_context: {
        project_summary: {
          project_code: 'PRJ-GLOBAL-DELIVERY',
          project_name: 'Global Express Delivery & Courier Logistics Platform',
          business_domain: 'Courier Logistics, Fleet Telemetry & Order Fulfillment',
          sla_target_minutes: 15,
        },
        solution_summary: {
          target_architecture: 'Microsoft Fabric Medallion Architecture (Bronze -> Silver -> Gold)',
          target_folder_structure: {
            root_folder: 'Delivery_Logistics_Platform',
            subfolders: {
              raw: '01 Raw',
              stage: '02 Stage',
              silver: '03 Silver',
              gold: '04 Gold',
            },
          },
          expected_deliverables: [
            "Fabric Raw Lakehouse (lh_delivery_raw_bronze in '01 Raw')",
            "Fabric Batch Ingestion Pipeline (pl_delivery_raw_batch in '01 Raw')",
            "PySpark Staging & Deduplication Notebook (nb_delivery_curation in '02 Stage')",
            "Fabric Curated Lakehouse (lh_delivery_curated_silver in '03 Silver')",
            "Fabric Gold Analytical Warehouse (wh_delivery_analytics_gold in '04 Gold')",
            "Power BI Direct Lake Semantic Model (sm_delivery_direct_lake in '04 Gold')",
            'Great Expectations Data Quality Reconciliation Suite',
            'NetworkX Column Lineage DAG',
          ],
        },
      },
      retrieved_context: {
        data_sources: [
          {
            source_name: 'Express Delivery & Fleet Management System',
            tables: [
              {
                table_name: 'shipments',
                primary_key: 'shipment_id',
                watermark_column: 'updated_at',
                row_count: 850000,
                pii_columns: [],
              },
              {
                table_name: 'couriers',
                primary_key: 'courier_id',
                watermark_column: 'updated_at',
                row_count: 12500,
                pii_columns: ['full_name', 'phone_number', 'email_address'],
              },
              {
                table_name: 'telemetry_pings',
                primary_key: 'ping_id',
                watermark_column: 'ping_time',
                row_count: 4200000,
                pii_columns: [],
              },
            ],
          },
        ],
      },
    },
  },
  {
    name: 'Healthcare Clinical & Claims Analytics',
    file: 'project_intake_healthcare.json',
    json: {
      project_context: {
        project_summary: {
          project_code: 'PRJ-HEALTHCARE-CLAIMS',
          project_name: 'Healthcare Clinical & Claims Intelligence Platform',
          business_domain: 'Healthcare Operations & Claims Analytics',
        },
        solution_summary: {
          target_architecture: 'Microsoft Fabric Medallion Architecture (Bronze -> Silver -> Gold)',
          target_folder_structure: {
            root_folder: 'Healthcare_Analytics_Platform',
            subfolders: {
              raw: '01 Raw',
              stage: '02 Stage',
              silver: '03 Silver',
              gold: '04 Gold',
            },
          },
          expected_deliverables: [
            'Fabric Lakehouses (lh_healthcare_bronze, lh_healthcare_silver)',
            'Fabric Warehouse (wh_healthcare_gold)',
            'PySpark Curation Notebook with SHA-256 PII masking',
            'ADF Ingestion Pipeline',
            'Kimball Star Schema DDL',
            'Great Expectations Data Quality Suite',
            'NetworkX Lineage Graph',
          ],
        },
      },
      retrieved_context: {
        data_sources: [
          {
            source_name: 'Clinical Claims & Encounters RDBMS',
            tables: [
              {
                table_name: 'patients',
                primary_key: 'patient_id',
                watermark_column: 'updated_at',
                pii_columns: ['ssn', 'first_name', 'last_name', 'email', 'phone', 'dob'],
              },
              {
                table_name: 'claims',
                primary_key: 'claim_id',
                watermark_column: 'submitted_date',
                pii_columns: [],
              },
              {
                table_name: 'encounters',
                primary_key: 'encounter_id',
                watermark_column: 'encounter_date',
                pii_columns: [],
              },
            ],
          },
        ],
      },
    },
  },
  {
    name: 'Global Supply Chain & Inventory Fulfillment',
    file: 'project_intake_supplychain.json',
    json: {
      project_context: {
        project_summary: {
          project_code: 'PRJ-SUPPLYCHAIN-OPS',
          project_name: 'Global Supply Chain & Inventory Fulfillment',
          business_domain: 'Logistics, Procurement & Inventory Operations',
        },
        solution_summary: {
          target_architecture: 'Microsoft Fabric Medallion Architecture (Bronze -> Silver -> Gold)',
          target_folder_structure: {
            root_folder: 'SupplyChain_Ops_Platform',
            subfolders: {
              raw: '01 Raw',
              stage: '02 Stage',
              silver: '03 Silver',
              gold: '04 Gold',
            },
          },
          expected_deliverables: [
            'Fabric Lakehouses (lh_supplychain_bronze, lh_supplychain_silver)',
            'Fabric Warehouse (wh_supplychain_gold)',
            'PySpark Ingestion & Silver Deduplication Notebook',
            'Kimball Star Schema Star Model',
            'Data Quality Reconciliation Suite',
          ],
        },
      },
      retrieved_context: {
        data_sources: [
          {
            source_name: 'SAP ERP Logistics',
            tables: [
              { table_name: 'purchase_orders', primary_key: 'po_id', watermark_column: 'updated_at' },
              { table_name: 'shipments', primary_key: 'shipment_id', watermark_column: 'ship_date' },
              { table_name: 'inventory_levels', primary_key: 'sku_id', watermark_column: 'as_of_time' },
            ],
          },
        ],
      },
    },
  },
  {
    name: 'Order-to-Cash Commercial Revenue',
    file: 'project_intake.json',
    json: {
      project_context: {
        project_summary: {
          project_code: 'PRJ-COMMERCIAL-REV',
          project_name: 'Order-to-Cash Commercial Revenue Platform',
          business_domain: 'Commercial Revenue & Order Operations',
        },
        solution_summary: {
          target_architecture: 'Microsoft Fabric Medallion Architecture (Bronze -> Silver -> Gold)',
          target_folder_structure: {
            root_folder: 'Commercial_Revenue_Platform',
            subfolders: {
              raw: '01 Raw',
              stage: '02 Stage',
              silver: '03 Silver',
              gold: '04 Gold',
            },
          },
          expected_deliverables: [
            'Fabric Lakehouses (lh_commercial_rev_bronze, lh_commercial_rev_silver)',
            'Fabric Warehouse (wh_commercial_rev_gold)',
            'PySpark Notebook with Delta ACID MERGE',
            'T-SQL Gold Star Schema DDL',
          ],
        },
      },
      retrieved_context: {
        data_sources: [
          {
            source_name: 'Salesforce CRM & Billing',
            tables: [
              { table_name: 'orders', primary_key: 'order_id', watermark_column: 'order_date' },
              { table_name: 'customers', primary_key: 'customer_id', watermark_column: 'updated_at', pii_columns: ['email', 'phone'] },
              { table_name: 'line_items', primary_key: 'item_id', watermark_column: 'created_at' },
            ],
          },
        ],
      },
    },
  },
];

export const IntakeSpecModal: React.FC<IntakeSpecModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0);
  const [jsonText, setJsonText] = useState('');
  const [isValid, setIsValid] = useState(true);
  const [lineCount, setLineCount] = useState(0);
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');
  const [copied, setCopied] = useState(false);

  const gutterRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      const initial = JSON.stringify(TEMPLATES[selectedTemplateIndex].json, null, 2);
      setJsonText(initial);
      setIsValid(true);
      setLineCount(initial.split('\n').length);
      setViewMode('preview');
      setCopied(false);
    }
  }, [isOpen, selectedTemplateIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleTemplateChange = (idx: number) => {
    setSelectedTemplateIndex(idx);
    const text = JSON.stringify(TEMPLATES[idx].json, null, 2);
    setJsonText(text);
    setIsValid(true);
    setLineCount(text.split('\n').length);
  };

  const handleTextChange = (val: string) => {
    setJsonText(val);
    setLineCount(val.split('\n').length);
    try {
      JSON.parse(val);
      setIsValid(true);
    } catch {
      setIsValid(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result || '');
        const parsed = JSON.parse(text);
        const formatted = JSON.stringify(parsed, null, 2);
        setJsonText(formatted);
        setIsValid(true);
        setLineCount(formatted.split('\n').length);
        setViewMode('preview');
      } catch (err) {
        alert('File is not valid JSON: ' + (err instanceof Error ? err.message : String(err)));
      }
    };
    reader.readAsText(file);
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const formatted = JSON.stringify(parsed, null, 2);
      setJsonText(formatted);
      setIsValid(true);
      setLineCount(formatted.split('\n').length);
    } catch (err) {
      alert('Cannot format invalid JSON: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = () => {
    if (!isValid) {
      alert('Please correct JSON syntax errors before running.');
      return;
    }
    // Fast Resume Mode is always enabled by default
    onSubmit(jsonText, true);
    onClose();
  };

  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Syntax highlighting parser
  const renderSyntaxHighlighted = (code: string) => {
    const tokens = code.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let color = '#fbbf24'; // amber for number
        let weight = '400';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            color = '#60a5fa'; // sky blue for JSON key
            weight = '500';
          } else {
            color = '#34d399'; // emerald for string values
          }
        } else if (/true|false/.test(match)) {
          color = '#c084fc'; // purple for boolean
          weight = '600';
        } else if (/null/.test(match)) {
          color = '#f87171'; // rose red for null
        }
        return `<span style="color:${color};font-weight:${weight}">${match}</span>`;
      }
    );
    return { __html: tokens };
  };

  const lines = jsonText.split('\n');

  // Render via portal to document.body for true viewport centering and blur effect
  const modalContent = (
    <div
      className="sso-modal-backdrop"
      style={{
        display: 'flex',
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 99999,
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        className="connections-modal-card"
        style={{
          width: '780px',
          maxWidth: '95vw',
          maxHeight: '92vh',
          background: '#0d1017',
          border: '1px solid rgba(255, 255, 255, 0.09)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 28px 70px -12px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.04)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (No divider border-bottom) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px 10px 24px',
            background: 'transparent',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '9px',
                background: 'rgba(16, 185, 129, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileCode width={19} height={19} style={{ color: '#10b981' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', margin: 0, letterSpacing: '-0.01em' }}>
                Project Intake Specification
              </h3>
              <p style={{ fontSize: '11.5px', color: '#94a3b8', margin: '2px 0 0 0' }}>
                Define project metadata, data sources, and architecture targets.
              </p>
            </div>
          </div>

          {/* Clean minimal close button without background or border */}
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.15s ease',
            }}
            title="Close"
          >
            <X width={18} height={18} />
          </button>
        </div>

        {/* Modal Body (Tightened vertical spacing) */}
        <div style={{ padding: '8px 24px 12px 24px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
          {/* Controls Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            {/* Template Selector with Custom Chevron */}
            <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '380px' }}>
              <select
                value={selectedTemplateIndex}
                onChange={(e) => handleTemplateChange(Number(e.target.value))}
                style={{
                  width: '100%',
                  height: '34px',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  background: '#141822',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                  fontSize: '12px',
                  fontWeight: 500,
                  padding: '0 32px 0 12px',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {TEMPLATES.map((t, idx) => (
                  <option key={t.file} value={idx}>
                    {t.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                width={14}
                height={14}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  pointerEvents: 'none',
                }}
              />
            </div>

            {/* Action Buttons & View Mode Segment */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Segmented View Mode Switcher */}
              <div
                style={{
                  display: 'inline-flex',
                  background: '#141822',
                  padding: '2px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setViewMode('preview')}
                  style={{
                    height: '28px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 500,
                    background: viewMode === 'preview' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                    color: viewMode === 'preview' ? '#f1f5f9' : '#94a3b8',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Code2 width={13} height={13} style={{ color: '#94a3b8' }} />
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('edit')}
                  style={{
                    height: '28px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 500,
                    background: viewMode === 'edit' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                    color: viewMode === 'edit' ? '#f1f5f9' : '#94a3b8',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Edit3 width={13} height={13} style={{ color: '#94a3b8' }} />
                  <span>Edit</span>
                </button>
              </div>

              {/* Upload JSON Button */}
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '32px',
                  padding: '0 12px',
                  background: '#141822',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  color: '#94a3b8',
                  fontSize: '11.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                title="Upload JSON file"
              >
                <Upload width={13} height={13} style={{ color: '#94a3b8' }} />
                <span>Upload</span>
                <input type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>

              {/* Format Button */}
              <button
                type="button"
                onClick={handleFormat}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '32px',
                  padding: '0 12px',
                  background: '#141822',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  color: '#94a3b8',
                  fontSize: '11.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                title="Format JSON structure"
              >
                <Sparkles width={13} height={13} style={{ color: '#94a3b8' }} />
                <span>Format</span>
              </button>
            </div>
          </div>

          {/* IDE Editor Frame with Line Numbers & Floating Copy Button */}
          <div
            style={{
              position: 'relative',
              borderRadius: '10px',
              border: `1px solid ${isValid ? 'rgba(255, 255, 255, 0.1)' : 'rgba(239, 68, 68, 0.5)'}`,
              background: '#080a0f',
              overflow: 'hidden',
              boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.6)',
            }}
          >
            {/* Floating Copy Button in JSON Body */}
            <button
              type="button"
              onClick={handleCopy}
              style={{
                position: 'absolute',
                top: '10px',
                right: '12px',
                zIndex: 10,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 8px',
                background: 'rgba(20, 24, 34, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(4px)',
                borderRadius: '6px',
                color: copied ? '#34d399' : '#94a3b8',
                fontSize: '11px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Copy JSON"
            >
              {copied ? <Check width={12} height={12} /> : <Copy width={12} height={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            {/* Editor Workspace (Line Gutter + Code) */}
            <div
              style={{
                display: 'flex',
                height: '350px',
                overflow: 'hidden',
                fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
                fontSize: '12px',
                lineHeight: '1.65',
              }}
            >
              {/* Line Numbers Gutter */}
              <div
                ref={gutterRef}
                style={{
                  width: '44px',
                  background: '#07080d',
                  borderRight: '1px solid rgba(255, 255, 255, 0.06)',
                  padding: '12px 8px 12px 0',
                  textAlign: 'right',
                  color: '#475569',
                  userSelect: 'none',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                {lines.map((_, i) => (
                  <div key={i} style={{ height: '19.8px' }}>
                    {i + 1}
                  </div>
                ))}
              </div>

              {/* Code Content */}
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                {viewMode === 'preview' ? (
                  <pre
                    style={{
                      margin: 0,
                      padding: '12px 16px',
                      height: '100%',
                      overflowY: 'auto',
                      overflowX: 'auto',
                      color: '#e2e8f0',
                      letterSpacing: '0.01em',
                      whiteSpace: 'pre',
                      boxSizing: 'border-box',
                    }}
                    dangerouslySetInnerHTML={renderSyntaxHighlighted(jsonText)}
                  />
                ) : (
                  <textarea
                    ref={textareaRef}
                    value={jsonText}
                    onChange={(e) => handleTextChange(e.target.value)}
                    onScroll={handleScroll}
                    spellCheck={false}
                    style={{
                      width: '100%',
                      height: '100%',
                      background: 'transparent',
                      border: 'none',
                      color: '#e2e8f0',
                      fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
                      fontSize: '12px',
                      lineHeight: '1.65',
                      padding: '12px 16px',
                      outline: 'none',
                      resize: 'none',
                      whiteSpace: 'pre',
                      overflowY: 'auto',
                      overflowX: 'auto',
                      boxSizing: 'border-box',
                    }}
                  />
                )}
              </div>
            </div>

            {/* Embedded Bottom Status Bar (Valid JSON & lines count on right) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                padding: '8px 14px',
                background: '#0b0d14',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                fontSize: '11px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isValid ? (
                  <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 500 }}>
                    <Check width={12} height={12} /> Valid JSON Spec
                  </span>
                ) : (
                  <span style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 500 }}>
                    <AlertCircle width={12} height={12} /> Syntax Error (Invalid JSON)
                  </span>
                )}
                <span style={{ color: '#475569' }}>•</span>
                <span style={{ color: '#94a3b8' }}>{lineCount} lines</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer (No divider border-top, balanced bottom-left status) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 24px 18px 24px',
            background: 'transparent',
          }}
        >
          {/* Subtle bottom-left indicator so it never feels empty */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            <span style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 500 }}>
              Omniflow Autonomous Engine Ready
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#94a3b8',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 22px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                transition: 'transform 0.1s ease',
              }}
            >
              <Play width={12} height={12} fill="#ffffff" />
              <span>Launch</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? ReactDOM.createPortal(modalContent, document.body) : modalContent;
};
