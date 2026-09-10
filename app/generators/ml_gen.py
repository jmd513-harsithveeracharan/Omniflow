"""
app/generators/ml_gen.py
------------------------
Generates Microsoft Fabric Synapse Data Science items: ML Experiments
(MLExperiment) and ML Models (MLModel) with MLflow tracking definitions.
"""

from __future__ import annotations

import base64
import json
from typing import Any


def _b64(content: str) -> str:
    """Encodes a UTF-8 string to Base64."""
    return base64.b64encode(content.encode("utf-8")).decode("utf-8")


def generate_ml_experiment_definition(
    experiment_name: str,
    description: str = "",
    tags: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Generates the structured JSON configuration for an ML Experiment."""
    return {
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/ml/experiment/1.0.0/schema.json",
        "experimentName": experiment_name,
        "description": description or f"MLflow Experiment ({experiment_name})",
        "artifactLocation": f"Files/experiments/{experiment_name}",
        "tags": tags or {"framework": "mlflow", "task": "customer_churn_prediction", "tier": "Gold"},
    }


def package_ml_experiment_definition_parts(
    experiment_name: str,
    config: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Packages ML Experiment parts into Base64 payload."""
    cfg = config or generate_ml_experiment_definition(experiment_name)
    return [
        {
            "path": "experiment.json",
            "payload": _b64(json.dumps(cfg, indent=2)),
            "payloadType": "InlineBase64",
        }
    ]


def generate_ml_model_definition(
    model_name: str,
    flavor: str = "spark",  # spark, sklearn, pytorch, lightgbm
    metrics: dict[str, float] | None = None,
) -> dict[str, Any]:
    """Generates the structured JSON configuration for an ML Model."""
    return {
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/ml/model/1.0.0/schema.json",
        "modelName": model_name,
        "flavor": flavor,
        "currentVersion": "1.0.0",
        "benchmarkMetrics": metrics or {"accuracy": 0.942, "f1_score": 0.918, "auc_roc": 0.965},
    }


def package_ml_model_definition_parts(
    model_name: str,
    config: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Packages ML Model parts into Base64 payload."""
    cfg = config or generate_ml_model_definition(model_name)
    return [
        {
            "path": "model.json",
            "payload": _b64(json.dumps(cfg, indent=2)),
            "payloadType": "InlineBase64",
        }
    ]
