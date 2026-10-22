# scripts/push_omniflow.ps1
# Pushes ONLY the omniflow folder, docs, and configurations to jmd513-harsithveeracharan/Omniflow.git

param(
    [string]$Branch = "dev",
    [string]$CommitMessage = "feat: update omniflow multi-agent platform"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$tempDir = Join-Path $env:TEMP "omniflow_push_$(Get-Random)"

Write-Host "Creating clean staging environment at $tempDir..." -ForegroundColor Cyan

try {
    New-Item -ItemType Directory -Path $tempDir | Out-Null
    
    # 1. Copy omniflow folder
    $destOmni = Join-Path $tempDir "omniflow"
    New-Item -ItemType Directory -Path $destOmni | Out-Null
    Copy-Item -Path "$root\omniflow\*" -Destination $destOmni -Recurse -Exclude "__pycache__","generated_artifacts","synthesized_tools.py","test_run_result.json",".env","*.env"

    Get-ChildItem -Path $destOmni -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Get-ChildItem -Path $destOmni -Recurse -Directory -Filter "generated_artifacts" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path "$destOmni\agents\synthesized_tools.py") { Remove-Item -Force "$destOmni\agents\synthesized_tools.py" }
    if (Test-Path "$destOmni\test_run_result.json") { Remove-Item -Force "$destOmni\test_run_result.json" }

    # 2. Copy docs
    $destDocs = Join-Path $tempDir "docs"
    New-Item -ItemType Directory -Path $destDocs | Out-Null
    Copy-Item -Path "$root\docs\omniflow\*" -Destination $destDocs -Recurse -ErrorAction SilentlyContinue

    # 3. Create .gitignore, requirements.txt, and README.md
    @'
# Python
__pycache__/
*.py[cod]
*$py.class
*.pyo
*.pyd
.Python
env/
venv/
.venv/
dist/
build/
*.egg-info/

# Environment & Secrets
.env
*.env.local

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# OmniFlow Runtime Outputs & Generated Artifacts
omniflow/generated_artifacts/
omniflow/test_run_result.json
omniflow/agents/synthesized_tools.py
test_run_result.json
generated_artifacts/

# Logs & Traces
*.log
logs/
'@ | Set-Content -Path "$tempDir\.gitignore" -Encoding UTF8

    @'
pydantic>=2.0.0
psycopg2-binary>=2.9.9
networkx>=3.0
openai>=1.0.0
azure-identity>=1.15.0
requests>=2.31.0
sqlglot>=23.0.0
python-dotenv>=1.0.0
'@ | Set-Content -Path "$tempDir\requirements.txt" -Encoding UTF8

    @'
# OmniFlow — Microsoft Fabric Autonomous Multi-Agent Data Platform

OmniFlow is an enterprise-grade multi-agent autonomous framework that translates natural language project specifications and enterprise data catalogs into production-ready Microsoft Fabric Medallion Lakehouses, PySpark notebooks, Kimball star schemas, and Power BI Direct Lake models.

## Multi-Agent Architecture

OmniFlow coordinates a specialized roster of dynamic agents persisted in Neon PostgreSQL:

1. **Planner Agent (`planner_agent`)**: 2-pass architectural formulation (macro phases to granular engineering tasks).
2. **Task Organizer Agent (`task_organizer_agent`)**: NetworkX Directed Acyclic Graph (DAG) construction, topological wave calculation, and critical path analysis.
3. **Tool Checker Agent (`tool_checker_agent`)**: Two-pass schema verification against PostgreSQL tool registry and runtime bindings.
4. **Research Agent (`research_agent`)**: Autonomous on-demand tool synthesis with AST security guardrails when missing tools are detected in the DAG.
5. **Executor Agent (`executor_agent`)**: Topological wave execution generating verified PySpark notebooks, T-SQL DDL, Data Pipelines, and Tabular Object Models.
6. **Auditor Agent (`auditor_agent`)**: AST syntax verification, SHA-256 PII masking compliance, and Delta Lake ACID merge auditing.
7. **Fabric Deployer**: Direct Microsoft Fabric REST API integration deploying items into workspace containment folders.

## Project Structure

```
Omniflow/
├── omniflow/
│   ├── agents/          # Agent implementations & runtime schemas
│   ├── config/          # PostgreSQL registry bootstrap seeders
│   ├── db/              # Neon PostgreSQL repository & execution logger
│   ├── intake/          # Project intake JSON specifications & models
│   ├── tools/           # Fabric deployer, guardrails, & catalog introspection
│   ├── ui/              # Rich terminal execution dashboard
│   └── test_trio.py     # Master entry point CLI
├── docs/                # Architecture specifications & walkthrough guides
├── .gitignore
├── requirements.txt
└── README.md
```

## Quickstart

```bash
# Run with a project intake specification
python omniflow/test_trio.py --intake omniflow/intake/project_intake_healthcare.json
```
'@ | Set-Content -Path "$tempDir\README.md" -Encoding UTF8

    # 4. Git init, commit, and push
    Set-Location $tempDir
    git init -b $Branch | Out-Null
    git config user.name "jmd513-harsithveeracharan"
    git config user.email "harsithveeracharan@jmangroup.com"
    git add .
    git commit -m $CommitMessage
    git remote add origin git@github.com-office:jmd513-harsithveeracharan/Omniflow.git
    git push --force origin $Branch

    Write-Host "[SUCCESS] Pushed clean omniflow folder to Omniflow.git ($Branch)!" -ForegroundColor Green
}
finally {
    Set-Location $root
    if (Test-Path $tempDir) {
        Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
    }
}

