"""
app/generators/graphql_gen.py
-----------------------------
Generates Microsoft Fabric GraphQL API schemas (SDL) and resolver bindings
over OneLake Lakehouse and Synapse Warehouse tables.
"""

from __future__ import annotations

import base64
from typing import Any


def generate_graphql_schema(
    api_name: str,
    tables: list[dict[str, Any]],
) -> str:
    """
    Generates GraphQL Schema Definition Language (SDL) types, queries, and filters.
    """
    sdl_lines = [
        f"# Microsoft Fabric GraphQL API Schema: {api_name}",
        "schema {",
        "  query: Query",
        "  mutation: Mutation",
        "}\n",
        "type Query {",
    ]

    type_defs = []
    mut_fields = []

    for tbl in tables:
        tname = tbl.get("name", "Item")
        singular = tname.rstrip("s")
        sdl_lines.append(f"  {tname}(filter: {singular}FilterInput, limit: Int = 100): [{singular}!]!")
        sdl_lines.append(f"  {singular.lower()}ById(id: ID!): {singular}\n")

        cols = tbl.get("columns", [])
        fields = []
        filter_fields = []

        for c in cols:
            cname = c.get("name", "id")
            ctype = c.get("type", "string").lower()
            gql_type = "String"
            if "int" in ctype or "long" in ctype:
                gql_type = "Int"
            elif "double" in ctype or "float" in ctype or "decimal" in ctype:
                gql_type = "Float"
            elif "bool" in ctype:
                gql_type = "Boolean"
            elif "id" in cname.lower() and ("pk" in str(c) or c.get("pk")):
                gql_type = "ID"

            fields.append(f"  {cname}: {gql_type}")
            filter_fields.append(f"  {cname}_eq: {gql_type}")

        type_defs.append(f"type {singular} {{\n" + "\n".join(fields) + "\n}")
        type_defs.append(f"input {singular}FilterInput {{\n" + "\n".join(filter_fields) + "\n}")
        mut_fields.append(f"  create{singular}(input: {singular}FilterInput!): {singular}")

    sdl_lines.append("}\n")
    sdl_lines.append("type Mutation {\n" + "\n".join(mut_fields) + "\n}\n")
    sdl_lines.extend(type_defs)

    return "\n".join(sdl_lines)


def package_graphql_definition_parts(
    schema_sdl: str,
) -> list[dict[str, Any]]:
    """
    Packages GraphQL schema SDL into Base64 inline definition parts format for Fabric API.
    """
    b64_sdl = base64.b64encode(schema_sdl.encode("utf-8")).decode("utf-8")
    return [
        {
            "path": "schema.graphql",
            "payload": b64_sdl,
            "payloadType": "InlineBase64",
        }
    ]
