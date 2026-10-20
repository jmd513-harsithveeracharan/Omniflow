# OmniFlow Enterprise Multi-Agent Architecture & Target Project Structure

## 1. Core 5-Agent Roster (Zero Hardcoded Layer Sub-Planners)

All 5 agents are dynamically loaded at runtime from **Neon PostgreSQL** (`agents`, `tools`, `agent_tools` tables):

1. **Planner Agent (`planner_agent`)**
   - **Input**: A 50–100+ word natural-language project plan submitted via CLI or API.
   - **Pass 1 (Macro Plan)**: Queries `engineering_standards` in PostgreSQL and decomposes the natural-language prompt into high-level architectural phases.
   - **Pass 2 (Step Refinement)**: Refines each macro phase into concrete engineering steps with explicit upstream step dependencies and required tool mappings.
   - **Database Write**: Logs execution trace and structured plan to `agent_runs`.

2. **Task Organizer Agent (`task_organizer_agent`)**
   - **Responsibility**: Takes the planned steps and constructs a `NetworkX` Directed Acyclic Graph (`nx.DiGraph`), verifies acyclicity (`is_directed_acyclic_graph`), computes parallel execution waves and critical path, and assigns UUIDs to every task.
   - **Database Write**: Inserts topologically ordered tasks with `dependency_ids` (`uuid[]`) into `tasks` and logs to `agent_runs`.

3. **Tool Checker Agent (`tool_checker_agent`)**
   - **Responsibility**: Audits every task in the DAG against the live PostgreSQL `tools` table and local Python runtime (`tool_registry.py`) to verify whether each task's `required_tool` is available.
   - **Output**: Marks each task's tool as `AVAILABLE` or `MISSING`. If any required tools are missing, triggers the Research Agent.

4. **Research & Tool Creator Agent (`research_agent`)**
   - **Responsibility**: Triggered automatically when `tool_checker_agent` detects missing tools. Researches the required Fabric API/schema specification, synthesizes executable Python tool code into `omniflow/agents/synthesized_tools.py`, binds the callable into `tool_registry` in memory, and registers the new tool in PostgreSQL (`tools` and `agent_tools` tables).
   - **Re-Verification**: After synthesis, `tool_checker_agent` runs Pass 2 to confirm `6/6` tools are available.

5. **Worker / Executor Agent (`executor_agent`)**
   - **Responsibility**: Traverses the validated DAG in topological dependency order, invokes the bound tool for each task (including newly synthesized tools), generates the actual Fabric artifacts on disk (`omniflow/generated_artifacts/<project_code>/`), and commits all outputs to PostgreSQL (`artifacts`, `tool_runs`, `tasks`, and `runs`).
