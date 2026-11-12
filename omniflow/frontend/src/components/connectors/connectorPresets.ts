import { ConnectorSummary } from '../../types';

export const CONNECTORS: ConnectorSummary[] = [
  {
    id: 'postgres',
    name: 'PostgreSQL Database',
    category: 'RDBMS',
    description: 'PostgreSQL 12+ on-prem or cloud (Azure Database, AWS RDS, GCP)',
    fields: [
      { name: 'host', label: 'Host / Endpoint', type: 'string', required: true, default: 'localhost' },
      { name: 'port', label: 'Port', type: 'number', required: true, default: 5432 },
      { name: 'database', label: 'Database Name', type: 'string', required: true, default: 'enterprise_dw' },
      { name: 'user', label: 'Username', type: 'string', required: true, default: 'postgres' },
      { name: 'password', label: 'Password', type: 'password', required: true, default: '********' },
    ],
  },
  {
    id: 'azure_sql',
    name: 'Azure SQL / Fabric SQL',
    category: 'Cloud DW',
    description: 'Native Azure SQL Database and Fabric SQL Analytics Endpoint',
    fields: [
      { name: 'server', label: 'Server FQDN', type: 'string', required: true, default: 'fabric-demo.database.windows.net' },
      { name: 'database', label: 'Database Name', type: 'string', required: true, default: 'sales_prod' },
    ],
  },
  {
    id: 'snowflake',
    name: 'Snowflake Data Cloud',
    category: 'Cloud DW',
    description: 'Enterprise Snowflake account with warehouse and schema discovery',
    fields: [
      { name: 'account', label: 'Account Identifier', type: 'string', required: true, default: 'xy12345.east-us-2' },
      { name: 'warehouse', label: 'Warehouse', type: 'string', required: true, default: 'COMPUTE_WH' },
    ],
  },
  {
    id: 'databricks',
    name: 'Databricks Unity Catalog',
    category: 'Lakehouse Compute',
    description: 'Delta Lake compute, Unity Catalog metadata, and Delta Sharing',
    fields: [
      { name: 'host', label: 'Server Hostname', type: 'string', required: true, default: 'adb-123456789.azuredatabricks.net' },
      { name: 'httpPath', label: 'HTTP Path', type: 'string', required: true, default: '/sql/1.0/warehouses/abc123def456' },
      { name: 'token', label: 'Personal Access Token', type: 'password', required: true, default: '********' },
    ],
  },
  {
    id: 'dbt',
    name: 'dbt Core / dbt Cloud',
    category: 'Transformations',
    description: 'SQL transformation DAGs, automated testing, and lineage graph',
    fields: [
      { name: 'account_id', label: 'dbt Account ID', type: 'string', required: true, default: '10482' },
      { name: 'project_id', label: 'Project ID', type: 'string', required: true, default: 'prd_gold_models' },
      { name: 'api_token', label: 'API Token', type: 'password', required: true, default: '********' },
    ],
  },
  {
    id: 'github',
    name: 'GitHub / Azure DevOps',
    category: 'Source Control',
    description: 'Git repository synchronization, CI/CD pipelines, and pull requests',
    fields: [
      { name: 'repo_url', label: 'Repository URL', type: 'string', required: true, default: 'https://github.com/org/fabric-pipeline' },
      { name: 'branch', label: 'Branch', type: 'string', required: true, default: 'main' },
    ],
  },
  {
    id: 'powerbi',
    name: 'Power BI Direct Lake',
    category: 'Business Intelligence',
    description: 'Direct Lake semantic models, report definitions, and workspace sync',
    fields: [
      { name: 'workspace_id', label: 'Workspace ID / Name', type: 'string', required: true, default: '' },
      { name: 'dataset_name', label: 'Dataset Name', type: 'string', required: true, default: 'Corporate_KPIs' },
    ],
  },
];

