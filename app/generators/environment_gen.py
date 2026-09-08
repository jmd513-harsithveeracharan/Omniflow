"""
app/generators/environment_gen.py
---------------------------------
Generates Microsoft Fabric custom Spark Environment YAML and configuration definitions.
"""

import base64
from typing import Any


def generate_environment_conda_yaml(
    pip_packages: list[str] | None = None,
    conda_channels: list[str] | None = None,
    environment_name: str = "custom_spark_env",
) -> str:
    """Generates standard conda environment.yml for Fabric Spark custom runtimes."""
    channels = conda_channels or ["conda-forge", "default"]
    packages = pip_packages or ["delta-spark>=3.0.0", "sqlglot>=25.0.0", "pandas>=2.0.0", "pyarrow>=14.0.0"]

    channels_str = "\n".join([f"  - {c}" for c in channels])
    pip_str = "\n".join([f"      - {p}" for p in packages])

    return f"""name: {environment_name}
channels:
{channels_str}
dependencies:
  - python=3.10
  - pip
  - pip:
{pip_str}
"""


def package_environment_definition_parts(
    conda_yaml: str,
    spark_properties: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    """
    Packages Conda YAML and Spark properties into Base64 inline definition parts.
    """
    parts = []

    # 1. Conda YAML specification
    encoded_yaml = base64.b64encode(conda_yaml.encode("utf-8")).decode("utf-8")
    parts.append({
        "path": "environment.yml",
        "payload": encoded_yaml,
        "payloadType": "InlineBase64",
    })

    # 2. Custom Spark Properties if provided
    if spark_properties:
        props_lines = [f"{k}={v}" for k, v in spark_properties.items()]
        props_str = "\n".join(props_lines)
        encoded_props = base64.b64encode(props_str.encode("utf-8")).decode("utf-8")
        parts.append({
            "path": "spark-properties.conf",
            "payload": encoded_props,
            "payloadType": "InlineBase64",
        })

    return parts
