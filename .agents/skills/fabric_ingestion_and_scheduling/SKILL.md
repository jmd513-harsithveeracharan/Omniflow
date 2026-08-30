---
name: fabric_ingestion_and_scheduling
description: Procedures for dynamic table discovery, strategy classification (Full vs. Incremental), DAG generation, and native Fabric Data Factory pipeline scheduling. Trigger when ingesting database tables or configuring pipeline schedules.
---

# Fabric Ingestion & Scheduling Playbook

## 1. Dynamic Ingestion Strategy Classifier
Analyze source table metadata:
- **Incremental (MERGE_UPSERT)**:
  - Requires: `primary_key` is present AND `watermark_column` (e.g. `updated_at`, `modified_date`, `timestamp`) is present AND `estimated_rows > 10,000`.
  - PySpark operation: `DeltaTable.forPath(...).merge(...)`.
- **Full (OVERWRITE)**:
  - Used when: No watermark column OR no primary key OR small lookup/dimension table (`< 10,000 rows`).
  - PySpark operation: `df.write.format('delta').mode('overwrite').save(...)`.

## 2. Dynamic Schedule Parsing
Translate human language into Fabric cron intervals:
- `"Nightly at 2am"` -> Cron `0 2 * * *` (Interval: 1440 mins)
- `"Every 3 hours"`   -> Cron `0 */3 * * *` (Interval: 180 mins)
- `"Hourly"`          -> Cron `0 * * * *` (Interval: 60 mins)

## 3. Fabric REST API Scheduling Call
Post schedule payload to Fabric Jobs API:
- Endpoint: `POST /v1/workspaces/{workspaceId}/items/{pipelineId}/jobs/Execute/schedules`
- Payload:
  ```json
  {
    "enabled": true,
    "configuration": {
      "type": "Cron",
      "interval": 180,
      "localTimeZoneId": "UTC"
    }
  }
  ```
