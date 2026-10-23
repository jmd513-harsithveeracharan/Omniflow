import React, { useState, useEffect, useRef } from 'react';
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
    // Always default to resume mode (true) so existing assets are reused
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

  return (
    <div
      className="sso-modal-backdrop"
      style={{
        display: 'flex',
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 7, 12, 0.82)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 10050,
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
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
            padding: '20px 24px 14px 24px',
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
                Define source schemas, project metadata, and target Medallion folder hierarchy.
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

        {/* Modal Body */}
        <div style={{ padding: '6px 24px 18px 24px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
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

              {/* Upload JSON Button (Clean grey icon) */}
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '34px',
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
                title="Upload JSON"
              >
                <Upload width={13} height={13} style={{ color: '#94a3b8' }} />
                <span>Upload</span>
                <input type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>

              {/* Format Button (Clean grey icon) */}
              <button
                type="button"
                onClick={handleFormat}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '34px',
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
                title="Format JSON"
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

            {/* Embedded Bottom Status Bar (Status & line count moved to the right) */}
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

        {/* Modal Footer (No divider border-top) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            padding: '10px 24px 20px 24px',
            background: 'transparent',
          }}
        >
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
  );
};
