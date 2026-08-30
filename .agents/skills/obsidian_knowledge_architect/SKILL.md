---
name: obsidian_knowledge_architect
description: Autonomous Knowledge Architect and Obsidian Developer for C:\Harsith_Obsidian. Builds interconnected knowledge graphs, Maps of Content (MOCs), Architecture Decision Records (ADRs), Dataview dashboards, Mermaid diagrams, and atomic concept notes across projects.
---

# Obsidian Knowledge Architect Playbook

## 1. Vault Target Location
- **Vault Root**: `C:\Harsith_Obsidian`
- **Default Project Folder**: `C:\Harsith_Obsidian\Projects\Fabric_AI`
- **Architecture Decisions**: `C:\Harsith_Obsidian\Architecture_Decision_Records`
- **Atomic Concept Hub**: `C:\Harsith_Obsidian\Concepts`
- **Daily / Session Logs**: `C:\Harsith_Obsidian\Logs`

## 2. Note Architecture Standards

Every generated Obsidian note must follow clean, modern PKM (Personal Knowledge Management) standards:

### A. YAML Frontmatter (Mandatory)
```yaml
---
title: "Note Title"
type: project-moc | adr | concept | log
tags:
  - fabric-ai
  - data-engineering
  - architecture
created: YYYY-MM-DD HH:mm:ss
updated: YYYY-MM-DD HH:mm:ss
status: active | draft | approved
aliases: ["Alternative Name", "Short Code"]
---
```

### B. Obsidian-Native Superpowers
1. **Bidirectional Wiki-Links (`[[...]]`)**:
   - Link all related entities, e.g. `[[lh_orders_silver]]`, `[[Delta Lake MERGE]]`, `[[ADR-004 LangGraph vs Native]]`.
2. **Mermaid Flowcharts**:
   - Visualize complex pipelines and state machines natively inside the note.
3. **Dataview Queries**:
   - Embed dynamic task and status aggregation blocks:
     ````dataview
     TABLE status, created, tags
     FROM "Projects/Fabric_AI"
     WHERE type = "adr"
     SORT created DESC
     ````
4. **Callouts & Alerts**:
   - Use `> [!NOTE]`, `> [!WARNING]`, `> [!TIP]` for highlighting key trade-offs.

## 3. Core Document Archetypes

### I. Project Map of Content (MOC)
- Acts as the central command hub for `Fabric_AI`.
- Contains: Executive Summary, System Architecture Diagram, Active Lakehouses, Notebooks, Pipelines, and linked ADRs.

### II. Architecture Decision Records (ADRs)
- Standard format:
  - **Context**: The problem / trade-off.
  - **Decision**: What was chosen (e.g. Native State Machine + pgvector + Zero-Data RAG).
  - **Status**: Proposed / Accepted.
  - **Consequences & Trade-offs**: Pros, Cons, Mitigations.
  - **Mermaid Architecture Graph**.

### III. Atomic Concept Notes
- Reusable, cross-project engineering concepts (e.g., `[[Delta Lake MERGE]]`, `[[AST SQLGlot Transpilation]]`, `[[Fabric Data Factory Triggers]]`).
- Connected into the global 3D Obsidian Graph View.

## 4. Operating Rules
1. Never overwrite user notes without preserving existing user content.
2. Ensure all `[[WikiLinks]]` point to valid or intended target notes to avoid dead graph nodes.
3. Keep notes scannable, dense, and beautifully formatted with headers, tables, and callouts.
