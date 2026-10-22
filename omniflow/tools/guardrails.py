from __future__ import annotations

import ast
import re
from typing import Any

DISALLOWED_MODULES = {"ctypes", "winreg", "pty"}
DISALLOWED_CALLS = {"system", "spawn"}
SECRET_PATTERNS = [
    re.compile(r"""(?i)(?:password|api_key|client_secret|private_key)\s*=\s*['"][^'"]{8,}['"]"""),
    re.compile(r"""ghp_[A-Za-z0-9_]{36}"""),
    re.compile(r"""eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}"""),
]


class CodeSecurityVisitor(ast.NodeVisitor):
    def __init__(self) -> None:
        self.violations: list[str] = []

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            base_mod = alias.name.split(".")[0]
            if base_mod in DISALLOWED_MODULES:
                self.violations.append(f"Disallowed import of dangerous module: '{alias.name}'")
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        if node.module and node.module.split(".")[0] in DISALLOWED_MODULES:
            self.violations.append(f"Disallowed import-from of dangerous module: '{node.module}'")
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        if isinstance(node.func, ast.Attribute) and node.func.attr in DISALLOWED_CALLS:
            self.violations.append(f"Disallowed call to system execution function: '{node.func.attr}'")
        self.generic_visit(node)


def validate_synthesized_python_code(code_str: str) -> dict[str, Any]:
    """AST guardrail validating dynamically synthesized code for syntax validity, safety, and plain-text secrets."""
    try:
        parsed_ast = ast.parse(code_str)
    except SyntaxError as e:
        return {"is_safe": False, "violations": [f"SyntaxError in synthesized code: {e}"]}

    visitor = CodeSecurityVisitor()
    visitor.visit(parsed_ast)

    for pattern in SECRET_PATTERNS:
        if pattern.search(code_str):
            visitor.violations.append("Detected potential hardcoded secret or plain-text API key pattern.")

    return {
        "is_safe": len(visitor.violations) == 0,
        "violations": visitor.violations,
        "ast_nodes_count": len(list(ast.walk(parsed_ast))),
    }

