import React, { useState, useEffect } from 'react';
import { FileCode, X, Upload, Sparkles, Check, AlertCircle, Play, Eye, Edit3 } from 'lucide-react';

interface IntakeSpecModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (intakeJson: string, resume: boolean) => void;
}

const TEMPLATES = [
  {
    name: 'Global Express Delivery & Fleet Logistics Platform',
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
    name: 'Order-to-Cash Commercial Revenue Platform',
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
  const [resume, setResume] = useState(false);
  const [isValid, setIsValid] = useState(true);
  const [lineCount, setLineCount] = useState(0);
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');

  useEffect(() => {
    if (isOpen) {
      const initial = JSON.stringify(TEMPLATES[selectedTemplateIndex].json, null, 2);
      setJsonText(initial);
      setIsValid(true);
      setLineCount(initial.split('\n').length);
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

  const handleSubmit = () => {
    if (!isValid) {
      alert('Please correct JSON syntax errors before running.');
      return;
    }
    onSubmit(jsonText, resume);
    onClose();
  };

  // Syntax highlighting parser
  const renderSyntaxHighlighted = (code: string) => {
    const tokens = code.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let color = '#fbbf24'; // number in amber
        let weight = '400';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            color = '#38bdf8'; // JSON key in sky blue
            weight = '600';
          } else {
            color = '#34d399'; // string in emerald green
          }
        } else if (/true|false/.test(match)) {
          color = '#c084fc'; // boolean in purple
          weight = '600';
        } else if (/null/.test(match)) {
          color = '#f87171'; // null in rose red
        }
        return `<span style="color:${color};font-weight:${weight}">${match}</span>`;
      }
    );
    return { __html: tokens };
  };

  return (
    <div
      className="sso-modal-backdrop"
      style={{
        display: 'flex',
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(10px)',
        zIndex: 1200,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        className="connections-modal-card"
        style={{
          width: '740px',
          maxWidth: '94vw',
          background: '#0f1117',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 30px 60px rgba(0,0,0,0.75)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.015)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileCode width={20} height={20} style={{ color: '#10b981' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', margin: 0, letterSpacing: '-0.01em' }}>
                  Project Intake Specification
                </h3>
                <span
                  style={{
                    fontSize: '10px',
                    fontFamily: '"JetBrains Mono", monospace',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}
                >
                  Tenali AI Engine
                </span>
              </div>
              <p style={{ fontSize: '11.5px', color: '#94a3b8', margin: '2px 0 0 0' }}>
                Structured architectural input for autonomous Medallion engineering and folder containment.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: '6px' }}
          >
            <X width={18} height={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Controls bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '260px' }}>
              <select
                value={selectedTemplateIndex}
                onChange={(e) => handleTemplateChange(Number(e.target.value))}
                style={{
                  width: '100%',
                  background: '#181b22',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '9px',
                  color: '#f8fafc',
                  fontSize: '12px',
                  fontWeight: 500,
                  padding: '8px 12px',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {TEMPLATES.map((t, idx) => (
                  <option key={t.file} value={idx}>
                    {t.name} ({t.file})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Toggle View Mode */}
              <div style={{ display: 'inline-flex', background: '#181b22', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <button
                  type="button"
                  onClick={() => setViewMode('preview')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 500,
                    background: viewMode === 'preview' ? 'rgba(16, 185, 129, 0.2)' : 'none',
                    color: viewMode === 'preview' ? '#34d399' : '#94a3b8',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <Eye width={12} height={12} /> Colors
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('edit')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 500,
                    background: viewMode === 'edit' ? 'rgba(16, 185, 129, 0.2)' : 'none',
                    color: viewMode === 'edit' ? '#34d399' : '#94a3b8',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <Edit3 width={12} height={12} /> Edit
                </button>
              </div>

              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  background: '#181b22',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '9px',
                  color: '#e2e8f0',
                  fontSize: '11.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <Upload width={13} height={13} style={{ color: '#38bdf8' }} />
                <span>Upload JSON</span>
                <input type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>

              <button
                type="button"
                onClick={handleFormat}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  background: '#181b22',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '9px',
                  color: '#e2e8f0',
                  fontSize: '11.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <Sparkles width={13} height={13} style={{ color: '#fbbf24' }} />
                <span>Format</span>
              </button>
            </div>
          </div>

          {/* Validation Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isValid ? (
                <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                  <Check width={12} height={12} /> Valid JSON Syntax
                </span>
              ) : (
                <span style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                  <AlertCircle width={12} height={12} /> Invalid JSON Syntax
                </span>
              )}
              <span>• {lineCount} lines</span>
            </div>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10.5px', color: '#38bdf8' }}>
              Target: Workspace Root & Medallion Folders
            </span>
          </div>

          {/* JSON Body: Color Highlighted Preview OR Interactive Textarea */}
          <div
            style={{
              position: 'relative',
              borderRadius: '12px',
              border: `1px solid ${isValid ? 'rgba(255,255,255,0.1)' : 'rgba(239,68,68,0.5)'}`,
              background: '#07090e',
              overflow: 'hidden',
            }}
          >
            {viewMode === 'preview' ? (
              <pre
                style={{
                  margin: 0,
                  padding: '14px 18px',
                  height: '250px',
                  overflowY: 'auto',
                  fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
                  fontSize: '12px',
                  lineHeight: '1.6',
                  color: '#e2e8f0',
                  letterSpacing: '0.01em',
                  whiteSpace: 'pre-wrap',
                }}
                dangerouslySetInnerHTML={renderSyntaxHighlighted(jsonText)}
              />
            ) : (
              <textarea
                value={jsonText}
                onChange={(e) => handleTextChange(e.target.value)}
                spellCheck={false}
                style={{
                  width: '100%',
                  height: '250px',
                  background: 'transparent',
                  border: 'none',
                  color: '#e2e8f0',
                  fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
                  fontSize: '12px',
                  lineHeight: '1.6',
                  padding: '14px 18px',
                  outline: 'none',
                  resize: 'none',
                  letterSpacing: '0.01em',
                }}
              />
            )}
          </div>

          {/* Options: Fast Resume Mode with clear explanation */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px 14px' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={resume}
                onChange={(e) => setResume(e.target.checked)}
                style={{ accentColor: '#10b981', cursor: 'pointer', marginTop: '2px' }}
              />
              <div>
                <div style={{ fontSize: '12px', fontWeight: 500, color: '#f8fafc' }}>
                  Fast Resume Mode (Reuse Cached Planning Models)
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
                  Skips re-generating already synthesized star schemas and tools, accelerating iterative testing.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            padding: '16px 24px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: 'none',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '9px',
              color: '#94a3b8',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
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
              gap: '7px',
              padding: '8px 20px',
              background: '#10b981',
              border: 'none',
              borderRadius: '9px',
              color: '#09090b',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)',
            }}
          >
            <Play width={13} height={13} fill="#09090b" />
            <span>Launch Autonomous Pipeline</span>
          </button>
        </div>
      </div>
    </div>
  );
};
