from __future__ import annotations

import json
import os
import uuid
from typing import Any

import psycopg2
from psycopg2.extras import Json

from omniflow.db.seed_data import BASE_TOOLS, CORE_AGENTS, CORE_STANDARDS

NEON_URI = (
    os.getenv("NEON_DATABASE_URL")
    or os.getenv("DATABASE_URL")
    or os.getenv("POSTGRES_URI")
    or ""
)


class PostgresRepository:
    """Unified PostgreSQL repository for OmniFlow dynamic agents, tools, tasks, runs, and artifacts."""

    def __init__(self, db_uri: str = ""):
        self.db_uri = db_uri or NEON_URI or os.getenv("NEON_DATABASE_URL", "") or os.getenv("DATABASE_URL", "")

    def _connect(self):
        if not self.db_uri:
            raise ValueError(
                "CRITICAL: PostgreSQL connection string not configured!\n"
                "Please set NEON_DATABASE_URL or DATABASE_URL in your .env or omniflow/.env file."
            )
        return psycopg2.connect(self.db_uri, connect_timeout=8)
        return psycopg2.connect(self.db_uri, connect_timeout=8)

    def bootstrap_registry(self, reset_synthesized_tools: bool = True) -> dict[str, int]:
        """Ensures only the 5 core agents exist, seeds engineering_standards & base tools,
        and resets synthesized tools so Research Agent dynamic tool creation is demonstrated live.
        """
        with self._connect() as conn, conn.cursor() as cur:
            # 1. Remove deprecated sub-planners so only the 5 requested agents exist
            deprecated = ("bronze_planner_agent", "silver_planner_agent", "gold_planner_agent")
            cur.execute(
                "DELETE FROM agent_tools WHERE agent_id IN (SELECT agent_id FROM agents WHERE agent_name IN %s);",
                (deprecated,),
            )
            cur.execute(
                "UPDATE agent_runs SET agent_id = NULL WHERE agent_id IN (SELECT agent_id FROM agents WHERE agent_name IN %s);",
                (deprecated,),
            )
            cur.execute(
                "UPDATE tasks SET assigned_agent_id = NULL WHERE assigned_agent_id IN (SELECT agent_id FROM agents WHERE agent_name IN %s);",
                (deprecated,),
            )
            cur.execute("DELETE FROM agents WHERE agent_name IN %s;", (deprecated,))

            # 2. If reset_synthesized_tools is enabled, remove dynamically synthesized tools prior to run
            if reset_synthesized_tools:
                dyn_tools = ("build_sap_rfc_cdc_connector_tool", "build_direct_lake_bim_tool")
                cur.execute(
                    "DELETE FROM agent_tools WHERE tool_id IN (SELECT tool_id FROM tools WHERE tool_name IN %s);",
                    (dyn_tools,),
                )
                cur.execute(
                    "UPDATE tool_runs SET tool_id = NULL WHERE tool_id IN (SELECT tool_id FROM tools WHERE tool_name IN %s);",
                    (dyn_tools,),
                )
                cur.execute("DELETE FROM tools WHERE tool_name IN %s;", (dyn_tools,))

            # 3. Seed engineering_standards if missing
            for std in CORE_STANDARDS:
                cur.execute(
                    "SELECT standard_id FROM engineering_standards WHERE standard_name = %s;",
                    (std["standard_name"],),
                )
                if not cur.fetchone():
                    cur.execute(
                        """
                        INSERT INTO engineering_standards
                            (standard_id, standard_type, standard_name, target_layer, rule_markdown, regex_pattern, is_mandatory)
                        VALUES (%s, %s, %s, %s, %s, %s, %s);
                        """,
                        (
                            str(uuid.uuid4()),
                            std["standard_type"],
                            std["standard_name"],
                            std["target_layer"],
                            std["rule_markdown"],
                            std["regex_pattern"],
                            std["is_mandatory"],
                        ),
                    )

            # 4. Upsert the 5 Core Agents
            agent_ids: dict[str, str] = {}
            for ag in CORE_AGENTS:
                cur.execute("SELECT agent_id FROM agents WHERE agent_name = %s;", (ag["agent_name"],))
                row = cur.fetchone()
                if row:
                    aid = str(row[0])
                    cur.execute(
                        """
                        UPDATE agents
                        SET display_name = %s, description = %s, agent_type = %s,
                            model_provider = %s, model_name = %s, system_prompt = %s,
                            status = 'active', updated_at = NOW()
                        WHERE agent_id = %s;
                        """,
                        (
                            ag["display_name"],
                            ag["description"],
                            ag["agent_type"],
                            ag["model_provider"],
                            ag["model_name"],
                            ag["system_prompt"],
                            aid,
                        ),
                    )
                else:
                    aid = str(uuid.uuid4())
                    cur.execute(
                        """
                        INSERT INTO agents
                            (agent_id, agent_name, display_name, description, agent_type,
                             model_provider, model_name, system_prompt, status, max_iterations, requires_approval)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'active', 5, false);
                        """,
                        (
                            aid,
                            ag["agent_name"],
                            ag["display_name"],
                            ag["description"],
                            ag["agent_type"],
                            ag["model_provider"],
                            ag["model_name"],
                            ag["system_prompt"],
                        ),
                    )
                agent_ids[ag["agent_name"]] = aid

            # 5. Upsert Base Tools & Bindings
            for tl in BASE_TOOLS:
                cur.execute("SELECT tool_id FROM tools WHERE tool_name = %s;", (tl["tool_name"],))
                trow = cur.fetchone()
                if trow:
                    tid = str(trow[0])
                    cur.execute(
                        """
                        UPDATE tools
                        SET display_name = %s, description = %s, endpoint = %s,
                            input_schema = %s, output_schema = %s, status = 'active', updated_at = NOW()
                        WHERE tool_id = %s;
                        """,
                        (
                            tl["display_name"],
                            tl["description"],
                            tl["endpoint"],
                            Json(tl["input_schema"]),
                            Json(tl["output_schema"]),
                            tid,
                        ),
                    )
                else:
                    tid = str(uuid.uuid4())
                    cur.execute(
                        """
                        INSERT INTO tools
                            (tool_id, tool_name, display_name, description, tool_type, provider,
                             endpoint, http_method, input_schema, output_schema, risk_level, requires_approval, status, version)
                        VALUES (%s, %s, %s, %s, 'PYTHON_FUNC', 'omniflow_internal', %s, 'LOCAL', %s, %s, 'low', false, 'active', '1.0.0');
                        """,
                        (
                            tid,
                            tl["tool_name"],
                            tl["display_name"],
                            tl["description"],
                            tl["endpoint"],
                            Json(tl["input_schema"]),
                            Json(tl["output_schema"]),
                        ),
                    )
                for aname in tl["agents"]:
                    aid = agent_ids[aname]
                    cur.execute(
                        """
                        INSERT INTO agent_tools (agent_id, tool_id, permission_level, enabled)
                        VALUES (%s, %s, 'execute', true)
                        ON CONFLICT (agent_id, tool_id) DO UPDATE SET enabled = true;
                        """,
                        (aid, tid),
                    )
            conn.commit()
            return {"agents_seeded": len(agent_ids), "base_tools_seeded": len(BASE_TOOLS)}

    def get_all_active_tools(self) -> dict[str, dict[str, Any]]:
        """Returns a dictionary of all active tools currently registered in PostgreSQL."""
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT tool_id::text, tool_name, display_name, description, endpoint
                FROM tools
                WHERE status = 'active';
                """
            )
            return {
                r[1]: {
                    "tool_id": r[0],
                    "tool_name": r[1],
                    "display_name": r[2],
                    "description": r[3],
                    "endpoint": r[4],
                }
                for r in cur.fetchall()
            }

    def register_synthesized_tool(
        self,
        tool_name: str,
        display_name: str,
        description: str,
        endpoint: str,
        input_schema: dict[str, Any],
        output_schema: dict[str, Any],
        bind_to_agent: str = "executor_agent",
    ) -> str:
        """Called by Research Agent to dynamically persist a newly created tool into PostgreSQL."""
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT tool_id::text FROM tools WHERE tool_name = %s;", (tool_name,))
            existing = cur.fetchone()
            if existing:
                tid = existing[0]
            else:
                tid = str(uuid.uuid4())
                cur.execute(
                    """
                    INSERT INTO tools
                        (tool_id, tool_name, display_name, description, tool_type, provider,
                         endpoint, http_method, input_schema, output_schema, risk_level, requires_approval, status, version)
                    VALUES (%s, %s, %s, %s, 'SYNTHESIZED_PYTHON_TOOL', 'research_agent', %s, 'LOCAL', %s, %s, 'low', false, 'active', '1.0.0');
                    """,
                    (
                        tid,
                        tool_name,
                        display_name,
                        description,
                        endpoint,
                        Json(input_schema),
                        Json(output_schema),
                    ),
                )
            cur.execute("SELECT agent_id::text FROM agents WHERE agent_name = %s;", (bind_to_agent,))
            arow = cur.fetchone()
            if arow:
                cur.execute(
                    """
                    INSERT INTO agent_tools (agent_id, tool_id, permission_level, enabled)
                    VALUES (%s, %s, 'execute', true)
                    ON CONFLICT (agent_id, tool_id) DO UPDATE SET enabled = true;
                    """,
                    (arow[0], tid),
                )
            conn.commit()
            return tid
