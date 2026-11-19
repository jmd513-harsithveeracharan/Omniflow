import React, { useState } from 'react';
import { Key, ShieldCheck, Database, Clock } from 'lucide-react';

interface ColumnContract {
  name: string;
  data_type?: string;
  type?: string;
  is_primary_key?: boolean;
  is_pk?: boolean;
  is_nullable?: boolean;
  nullable?: boolean;
  is_pii?: boolean;
  pii?: boolean;
  foreign_key?: string;
  layer?: string;
}

interface TableContract {
  table_name: string;
  layer?: string;
  primary_key?: string;
  watermark_column?: string;
  columns?: ColumnContract[];
}

interface DeltaSchemaPaneProps {
  schemaContracts?: Record<string, TableContract>;
  tables?: Array<Record<string, unknown>>;
  domain?: string;
}

function cleanText(str?: string): string {
  if (!str) return '';
  return str
    .replace(/\\?\$?\\to\\?\$?/g, '→')
    .replace(/\\rightarrow/g, '→')
    .replace(/\$/g, '')
    .trim();
}

export const DeltaSchemaPane: React.FC<DeltaSchemaPaneProps> = ({
  schemaContracts,
  tables,
  domain = 'postgres_medallion',
}) => {
  // Build a unified dictionary of tables
  const tableEntries: TableContract[] = React.useMemo(() => {
    if (schemaContracts && Object.keys(schemaContracts).length > 0) {
      return Object.values(schemaContracts);
    }
    if (tables && tables.length > 0) {
      return tables.map((t) => {
        const tName = String(t.name || t.table_name || 'source_crm.customers');
        return {
          table_name: tName,
          layer: 'Silver',
          primary_key: String(t.primary_key || 'id'),
          watermark_column: String(t.watermark_column || 'updated_at'),
          columns: [
            { name: String(t.primary_key || 'id'), data_type: 'BIGINT', is_primary_key: true, is_nullable: false },
            { name: String(t.watermark_column || 'updated_at'), data_type: 'TIMESTAMPTZ', is_primary_key: false, is_nullable: false },
            { name: '_ingested_at', data_type: 'TIMESTAMP', is_primary_key: false, is_nullable: false },
          ],
        };
      });
    }
    // High-quality fallback for PostgreSQL CRM
    return [
      {
        table_name: 'source_crm.customers',
        layer: 'Silver',
        primary_key: 'customer_id',
        watermark_column: 'updated_at',
        columns: [
          { name: 'customer_id', data_type: 'BIGINT', is_primary_key: true, is_nullable: false },
          { name: 'first_name', data_type: 'VARCHAR(64)', is_pii: true, is_nullable: true },
          { name: 'last_name', data_type: 'VARCHAR(64)', is_pii: true, is_nullable: true },
          { name: 'email', data_type: 'VARCHAR(128) (SHA-256)', is_pii: true, is_nullable: false },
          { name: 'phone', data_type: 'VARCHAR(32)', is_pii: true, is_nullable: true },
          { name: 'updated_at', data_type: 'TIMESTAMPTZ', is_nullable: false },
          { name: '_ingested_at', data_type: 'TIMESTAMP', is_nullable: false },
        ],
      },
      {
        table_name: 'source_crm.orders',
        layer: 'Silver',
        primary_key: 'order_id',
        watermark_column: 'updated_at',
        columns: [
          { name: 'order_id', data_type: 'BIGINT', is_primary_key: true, is_nullable: false },
          { name: 'customer_id', data_type: 'BIGINT', foreign_key: 'dim_customer', is_nullable: false },
          { name: 'total_amount', data_type: 'DECIMAL(12,2)', is_nullable: false },
          { name: 'status', data_type: 'VARCHAR(32)', is_nullable: false },
          { name: 'updated_at', data_type: 'TIMESTAMPTZ', is_nullable: false },
          { name: '_ingested_at', data_type: 'TIMESTAMP', is_nullable: false },
        ],
      },
    ];
  }, [schemaContracts, tables]);

  const [activeTableIdx, setActiveTableIdx] = useState(0);
  const currentTable = tableEntries[activeTableIdx] || tableEntries[0];

  if (!currentTable) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '260px', color: '#94a3b8' }}>
        <Database width={32} height={32} style={{ opacity: 0.35, marginBottom: '10px' }} />
        <p style={{ margin: 0, fontSize: '13px' }}>No schema contracts defined for this plan.</p>
      </div>
    );
  }

  const columns = currentTable.columns || [];
  const pkCol = currentTable.primary_key || 'id';
  const wmCol = currentTable.watermark_column || 'updated_at';

  return (
    <div className="wb-view-pane active" style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', height: '100%', minHeight: 0, background: '#090a0f' }}>
      {/* Table Selector Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', overflowX: 'auto', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(0,0,0,0.3)' }}>
        <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '4px', whiteSpace: 'nowrap' }}>
          Tables ({tableEntries.length}):
        </span>
        {tableEntries.map((tbl, idx) => (
          <button
            key={tbl.table_name || idx}
            type="button"
            onClick={() => setActiveTableIdx(idx)}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              border: activeTableIdx === idx ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.08)',
              background: activeTableIdx === idx ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.02)',
              color: activeTableIdx === idx ? '#34d399' : '#cbd5e1',
            }}
          >
            {tbl.table_name}
          </button>
        ))}
      </div>

      {/* Table Metadata Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#f8fafc', fontFamily: 'monospace' }}>
            lh_silver.{currentTable.table_name.replace('.', '_')}
          </h4>
          <span style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', fontWeight: 500 }}>
            Silver Delta Table ({domain})
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: '#fbbf24' }}>
            <Key width={12} height={12} />
            <span>PK: {pkCol}</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: '#94a3b8' }}>
            <Clock width={12} height={12} />
            <span>CDC: {wmCol}</span>
          </span>
        </div>
      </div>

      {/* Table Columns View */}
      <div style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'auto', padding: '16px 20px' }}>
        <table className="schema-data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'left', color: '#94a3b8' }}>
              <th style={{ padding: '8px 12px' }}>Column Name</th>
              <th style={{ padding: '8px 12px' }}>Data Type</th>
              <th style={{ padding: '8px 12px' }}>Nullable</th>
              <th style={{ padding: '8px 12px' }}>Key / Constraints</th>
              <th style={{ padding: '8px 12px' }}>Layer Treatment</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((c, cIdx) => {
              const isPk = c.is_primary_key || c.is_pk || c.name === pkCol;
              const isPii = c.is_pii || c.pii || ['email', 'phone', 'first_name', 'last_name', 'street_address'].includes(c.name.toLowerCase());
              const isAudit = ['_ingested_at', '_batch_run_id', '_source_schema'].includes(c.name.toLowerCase());
              const isWm = c.name === wmCol;
              const dType = c.data_type || c.type || (isPk ? 'BIGINT' : isAudit ? 'TIMESTAMP' : 'VARCHAR(128)');

              let constraintText = 'None';
              if (isPk) constraintText = 'Yes (Primary Key)';
              else if (c.foreign_key) constraintText = cleanText(`FK → ${c.foreign_key}`);
              else if ((c as any).primary_key && String((c as any).primary_key).toLowerCase() !== 'false') constraintText = cleanText(String((c as any).primary_key));
              else if (isWm) constraintText = 'Watermark (CDC)';
              else if (isAudit) constraintText = 'Audit Column';

              let layerText = cleanText(c.layer || (c as any).layer_treatment || 'Silver Delta MERGE');
              if (isPii) layerText = '🛡️ Salted SHA-256 Masked';
              else if (isAudit) layerText = 'System Metadata';

              return (
                <tr
                  key={c.name || cIdx}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    background: isPk ? 'rgba(251, 191, 36, 0.03)' : (isPii ? 'rgba(16, 185, 129, 0.03)' : 'transparent'),
                  }}
                >
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: isPk ? '#fbbf24' : (isPii ? '#34d399' : '#f1f5f9'), fontWeight: isPk ? 600 : 400 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isPk && <Key width={12} height={12} style={{ color: '#fbbf24' }} />}
                      {isPii && <ShieldCheck width={12} height={12} style={{ color: '#34d399' }} />}
                      <span>{c.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#93c5fd' }}>
                    <code>{dType}</code>
                  </td>
                  <td style={{ padding: '8px 12px', color: (c.is_nullable || c.nullable) && !isPk ? '#94a3b8' : '#e2e8f0' }}>
                    {isPk ? 'No' : (c.is_nullable || c.nullable ? 'Yes' : 'No')}
                  </td>
                  <td style={{ padding: '8px 12px', color: isPk ? '#fbbf24' : (c.foreign_key ? '#c084fc' : (isWm ? '#67e8f9' : '#94a3b8')) }}>
                    {constraintText}
                  </td>
                  <td style={{ padding: '8px 12px', color: isPii ? '#34d399' : (isAudit ? '#94a3b8' : '#38bdf8') }}>
                    {layerText}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
