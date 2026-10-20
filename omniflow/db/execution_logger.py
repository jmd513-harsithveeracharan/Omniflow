from __future__ import annotations

import uuid
from typing import Any

import psycopg2
from psycopg2.extras import Json

from omniflow.agents.schemas import OrganizedTask
from omniflow.db.postgres_repo import NEON_URI


class ExecutionDatabaseLogger:
    """Persists all runtime records (projects, runs, agent_runs, tasks, tool_runs, artifacts) into PostgreSQL."""

    def __init__(self, db_uri: str = NEON_URI):
        self.db_uri = db_uri

    def _connect(self):
        return psycopg2.connect(self.db_uri, connect_timeout=8)

    def upsert_project(self, project_code: str, project_name: str, description: str) -> str:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT project_id::text FROM projects WHERE project_code = %s;", (project_code,))
            row = cur.fetchone()
            if row:
                pid = row[0]
                cur.execute(
                    """
                    UPDATE projects
                    SET project_name = %s, description = %s, status = 'active', updated_at = NOW()
                    WHERE project_id = %s;
                    """,
                    (project_name, description, pid),
                )
            else:
                pid = str(uuid.uuid4())
                cur.execute(
                    """
                    INSERT INTO projects
                        (project_id, project_code, project_name, description, primary_language,
                         target_platform, status, created_by)
                    VALUES (%s, %s, %s, %s, 'PySpark / T-SQL', 'Microsoft Fabric', 'active', 'omniflow_cli');
                    """,
                    (pid, project_code, project_name, description),
                )
            conn.commit()
            return pid

    def create_run(self, project_id: str, request_text: str, user_id: str) -> str:
        run_id = str(uuid.uuid4())
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO runs
                    (run_id, project_id, user_id, request, request_type, status, priority, started_at, current_step)
                VALUES (%s, %s, %s, %s, 'MEDALLION_BUILD_PLAN', 'running', 1, NOW(), 'planner_agent');
                """,
                (run_id, project_id, user_id, request_text),
            )
            conn.commit()
        return run_id

    def update_run_status(
        self,
        run_id: str,
        current_step: str,
        status: str = "running",
        final_result: dict[str, Any] | None = None,
    ) -> None:
        with self._connect() as conn, conn.cursor() as cur:
            if final_result is not None:
                cur.execute(
                    """
                    UPDATE runs
                    SET current_step = %s, status = %s, final_result = %s, completed_at = NOW()
                    WHERE run_id = %s;
                    """,
                    (current_step, status, Json(final_result), run_id),
                )
            else:
                cur.execute(
                    "UPDATE runs SET current_step = %s, status = %s WHERE run_id = %s;",
                    (current_step, status, run_id),
                )
            conn.commit()

    def get_agent_id(self, agent_name: str) -> str | None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT agent_id::text FROM agents WHERE agent_name = %s;", (agent_name,))
            row = cur.fetchone()
            return row[0] if row else None

    def log_agent_run(
        self,
        run_id: str,
        agent_id: str,
        input_payload: dict[str, Any],
        reasoning_summary: str,
        output_payload: dict[str, Any],
        task_id: str | None = None,
        status: str = "completed",
    ) -> str:
        agent_run_id = str(uuid.uuid4())
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO agent_runs
                    (agent_run_id, run_id, task_id, agent_id, input, reasoning_summary,
                     output, status, iteration_count, started_at, completed_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 1, NOW(), NOW());
                """,
                (
                    agent_run_id,
                    run_id,
                    task_id,
                    agent_id,
                    Json(input_payload),
                    reasoning_summary,
                    Json(output_payload),
                    status,
                ),
            )
            conn.commit()
        return agent_run_id

    def insert_dag_tasks(
        self, run_id: str, executor_agent_id: str, tasks: list[OrganizedTask]
    ) -> None:
        with self._connect() as conn, conn.cursor() as cur:
            for t in tasks:
                cur.execute(
                    """
                    INSERT INTO tasks
                        (task_id, run_id, task_name, description, task_type, assigned_agent_id,
                         sequence_no, dependency_ids, status, priority, input_data, started_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s::uuid[], 'pending', 1, %s, NOW());
                    """,
                    (
                        t.task_id,
                        run_id,
                        f"[{t.step_code}] {t.task_name}",
                        t.description,
                        t.task_type,
                        executor_agent_id,
                        t.sequence_no,
                        t.dependency_task_ids,
                        Json(
                            {
                                "required_tool": t.required_tool,
                                "artifact_type": t.artifact_type,
                                "target_artifact_name": t.target_artifact_name,
                                "parameters": t.parameters,
                            }
                        ),
                    ),
                )
            conn.commit()

    def complete_dag_task(self, task_id: str, output_data: dict[str, Any], status: str = "completed") -> None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                UPDATE tasks
                SET status = %s, output_data = %s, completed_at = NOW()
                WHERE task_id = %s;
                """,
                (status, Json(output_data), task_id),
            )
            conn.commit()

    def log_tool_run(
        self,
        agent_run_id: str,
        tool_id: str | None,
        input_payload: dict[str, Any],
        output_payload: dict[str, Any],
        execution_time_ms: int,
        status: str = "completed",
    ) -> str:
        tool_run_id = str(uuid.uuid4())
        with self._connect() as conn, conn.cursor() as cur:
            # Validate tool_id exists to satisfy foreign key constraint
            valid_tool_id = None
            if tool_id:
                try:
                    cur.execute("SELECT tool_id::text FROM tools WHERE tool_id = %s::uuid;", (tool_id,))
                    r = cur.fetchone()
                    if r:
                        valid_tool_id = r[0]
                except Exception:
                    pass
                if not valid_tool_id:
                    cur.execute("SELECT tool_id::text FROM tools WHERE tool_name = %s LIMIT 1;", (tool_id,))
                    r2 = cur.fetchone()
                    if r2:
                        valid_tool_id = r2[0]

            cur.execute(
                """
                INSERT INTO tool_runs
                    (tool_run_id, agent_run_id, tool_id, input, output, http_status,
                     status, execution_time_ms, started_at, completed_at)
                VALUES (%s, %s, %s, %s, %s, 200, %s, %s, NOW(), NOW());
                """,
                (
                    tool_run_id,
                    agent_run_id,
                    valid_tool_id,
                    Json(input_payload),
                    Json(output_payload),
                    status,
                    execution_time_ms,
                ),
            )
            conn.commit()
        return tool_run_id

    def insert_artifact(
        self,
        run_id: str,
        task_id: str,
        artifact_type: str,
        artifact_name: str,
        definition: dict[str, Any],
        definition_hash: str,
    ) -> str:
        artifact_id = str(uuid.uuid4())
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO artifacts
                    (artifact_id, run_id, task_id, artifact_type, artifact_name, version,
                     definition, definition_hash, action, status, created_at)
                VALUES (%s, %s, %s, %s, %s, '1.0.0', %s, %s, 'CREATE', 'generated', NOW());
                """,
                (
                    artifact_id,
                    run_id,
                    task_id,
                    artifact_type,
                    artifact_name,
                    Json(definition),
                    definition_hash,
                ),
            )
            conn.commit()
        return artifact_id

    def record_fabric_item(
        self,
        item_name: str,
        item_type: str,
        fabric_item_id: str | None,
        layer: str = "curated",
        status: str = "active",
        definition: dict[str, Any] | None = None,
    ) -> None:
        """Persists deployed Microsoft Fabric items into the fabric_items table."""
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO fabric_items
                    (item_id, item_name, item_type, fabric_item_id, layer, status, definition, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), NOW());
                """,
                (str(uuid.uuid4()), item_name, item_type, fabric_item_id, layer, status, Json(definition or {})),
            )
            conn.commit()

    def record_blast_zone_impact(
        self,
        project_id: str | None,
        impacted_tables: list[str],
        risk_score: int = 15,
        action: str = "MEDALLION_PROMOTION",
    ) -> str:
        """Logs downstream impact blast-zone reach in blast_zone_impacts table."""
        impact_id = str(uuid.uuid4())
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO blast_zone_impacts
                    (impact_id, project_id, mutation_action, risk_score, impacted_downstream_tables,
                     requires_human_approval, computed_at)
                VALUES (%s, %s, %s, %s, %s, false, NOW());
                """,
                (impact_id, project_id, action, risk_score, impacted_tables),
            )
            conn.commit()
        return impact_id

    def record_project_memory(
        self,
        project_id: str,
        title: str,
        content: str,
        run_id: str,
        memory_type: str = "RUN_COMPLETION",
        importance: int = 5,
    ) -> str:
        """Records episodic learnings and run summaries in project_memory table."""
        mem_id = str(uuid.uuid4())
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO project_memory
                    (memory_id, project_id, memory_type, title, content, importance, confidence,
                     source_run_id, status, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, 1.0, %s, 'ACTIVE', NOW(), NOW());
                """,
                (mem_id, project_id, memory_type, title, content, importance, run_id),
            )
            conn.commit()
        return mem_id

    def record_session_checkpoint(
        self,
        step: int,
        active_agent: str,
        snapshot: dict[str, Any],
    ) -> str:
        """Records durable session checkpoints across agent stages."""
        chk_id = str(uuid.uuid4())
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO session_checkpoints
                    (checkpoint_id, checkpoint_step, active_agent, state_snapshot,
                     human_approval_required, created_at)
                VALUES (%s, %s, %s, %s, false, NOW());
                """,
                (chk_id, step, active_agent, Json(snapshot)),
            )
            conn.commit()
        return chk_id

    def record_token_usage(
        self,
        model_name: str,
        prompt_tokens: int,
        completion_tokens: int,
        agent_name: str = "agent",
        run_id: str | None = None,
        project_id: str | None = None,
        cached_tokens: int = 0,
        cost_usd: float = 0.0,
    ) -> str:
        """Persists LLM token consumption into the llm_token_logs table."""
        log_id = str(uuid.uuid4())
        try:
            with self._connect() as conn, conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO llm_token_logs
                        (log_id, project_id, run_id, model_name, agent_name, prompt_tokens,
                         completion_tokens, cached_tokens, total_cost_usd, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW());
                    """,
                    (
                        log_id,
                        project_id,
                        run_id,
                        model_name,
                        agent_name,
                        prompt_tokens,
                        completion_tokens,
                        cached_tokens,
                        cost_usd,
                    ),
                )
                conn.commit()
        except Exception:
            pass
        return log_id

    def fetch_run_verification_stats(self, run_id: str) -> dict[str, Any]:
        """Queries PostgreSQL to verify all records persisted for the given run_id."""
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT status, current_step FROM runs WHERE run_id = %s;", (run_id,))
            run_row = cur.fetchone()
            cur.execute("SELECT COUNT(*) FROM agent_runs WHERE run_id = %s;", (run_id,))
            agent_runs_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM tasks WHERE run_id = %s AND status = 'completed';", (run_id,))
            tasks_completed = cur.fetchone()[0]
            cur.execute(
                """
                SELECT COUNT(*) FROM tool_runs
                WHERE agent_run_id IN (SELECT agent_run_id FROM agent_runs WHERE run_id = %s);
                """,
                (run_id,),
            )
            tool_runs_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM artifacts WHERE run_id = %s;", (run_id,))
            artifacts_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM tools WHERE status = 'active';", ())
            active_tools_total = cur.fetchone()[0]
            cur.execute("SELECT agent_name FROM agents WHERE status = 'active' ORDER BY agent_name;", ())
            active_agents = [r[0] for r in cur.fetchall()]

            return {
                "run_id": run_id,
                "run_status": run_row[0] if run_row else "unknown",
                "final_step": run_row[1] if run_row else "unknown",
                "agent_runs_logged": agent_runs_count,
                "tasks_completed_in_db": tasks_completed,
                "tool_runs_logged": tool_runs_count,
                "artifacts_stored_in_db": artifacts_count,
                "active_tools_in_registry": active_tools_total,
                "active_agents_in_registry": active_agents,
            }


def log_llm_tokens(
    model_name: str,
    prompt_tokens: int,
    completion_tokens: int,
    agent_name: str = "llm_router",
    run_id: str | None = None,
    project_id: str | None = None,
) -> None:
    """Convenience helper to record token consumption from anywhere in the codebase."""
    try:
        ExecutionDatabaseLogger().record_token_usage(
            model_name=model_name,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            agent_name=agent_name,
            run_id=run_id,
            project_id=project_id,
        )
    except Exception:
        pass

